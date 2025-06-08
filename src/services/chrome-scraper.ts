import { createServiceLogger } from '../utils/logger';
import * as cheerio from 'cheerio';

const logger = createServiceLogger('chrome-scraper');

interface ChromeScrapingOptions {
  chromeUrl: string; // e.g., 'http://chrome:9222'
  timeout?: number;
}

interface ChromeTab {
  id: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

interface ChromeResponse {
  id: number;
  result?: any;
  error?: any;
}

interface ChromeVersion {
  Browser: string;
  webSocketDebuggerUrl: string;
}

export class ChromeScraper {
  private chromeUrl: string;
  private timeout: number;
  private nextId: number = 1;

  constructor(options: ChromeScrapingOptions) {
    this.chromeUrl = options.chromeUrl;
    this.timeout = options.timeout || 30000; // 30 seconds default
  }

  /**
   * Extract content from a URL using CSS selector via Chrome remote debugging
   */
  async extractContent(url: string, cssSelector?: string): Promise<string> {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds base delay
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let tab: ChromeTab | null = null;
      let ws: any = null;

      try {
        logger.debug('Chrome scraping attempt', { url, cssSelector, attempt });

        // Create a new tab
        tab = await this.createTab();
        logger.debug('Created Chrome tab', { tabId: tab.id, url });

        // Connect to WebSocket
        ws = await this.connectWebSocket(tab.webSocketDebuggerUrl);
        logger.debug('Connected to Chrome WebSocket', { tabId: tab.id });

        // Enable necessary domains
        await this.sendCommand(ws, 'Runtime.enable');
        await this.sendCommand(ws, 'Page.enable');
        await this.sendCommand(ws, 'DOM.enable');

        // Navigate to URL
        await this.sendCommand(ws, 'Page.navigate', { url });
        logger.debug('Navigated to URL', { url, tabId: tab.id });

        // Wait for page to load
        await this.waitForPageLoad(ws);
        logger.debug('Page loaded', { url, tabId: tab.id });

        // Wait a bit more for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract content using CSS selector
        const content = await this.extractContentFromPage(ws, cssSelector);
        
        if (!content || content.trim().length < 20) {
          throw new Error(`Content too short or empty (${content.length} chars)`);
        }

        logger.debug('Content extracted successfully', { 
          url,
          contentLength: content.length,
          attempt: attempt === 1 ? undefined : attempt
        });

        return content;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isLastAttempt = attempt === maxRetries;
        
        logger.warn(`Chrome scraping attempt ${attempt}/${maxRetries} failed`, {
          url,
          error: errorMessage,
          willRetry: !isLastAttempt
        });

        if (isLastAttempt) {
          logger.error('Chrome scraping failed after all attempts', {
            url,
            totalAttempts: maxRetries,
            finalError: errorMessage
          });
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.debug(`Waiting ${delay}ms before retry`, { url, attempt });
        await new Promise(resolve => setTimeout(resolve, delay));

      } finally {
        // Cleanup
        if (ws) {
          try {
            ws.close();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
        if (tab) {
          try {
            await this.closeTab(tab.id);
          } catch (e) {
            logger.warn('Failed to close Chrome tab', { tabId: tab.id, error: e });
          }
        }
      }
    }

    throw new Error('Maximum retries exceeded');
  }

  /**
   * Create a new Chrome tab
   */
  private async createTab(): Promise<ChromeTab> {
    const response = await fetch(`${this.chromeUrl}/json/new?about:blank`, {
      method: 'PUT'
    });

    if (!response.ok) {
      throw new Error(`Failed to create Chrome tab: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ChromeTab>;
  }

  /**
   * Close a Chrome tab
   */
  private async closeTab(tabId: string): Promise<void> {
    try {
      await fetch(`${this.chromeUrl}/json/close/${tabId}`, {
        method: 'POST'
      });
    } catch (error) {
      // Don't throw on cleanup errors
      logger.debug('Error closing tab', { tabId, error });
    }
  }

  /**
   * Connect to Chrome WebSocket
   */
  private async connectWebSocket(wsUrl: string): Promise<any> {
    const { default: WebSocket } = await import('ws');
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket connection timeout'));
      }, this.timeout);

      ws.on('open', () => {
        clearTimeout(timeout);
        resolve(ws);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Send command to Chrome via WebSocket
   */
  private async sendCommand(ws: any, method: string, params?: any): Promise<any> {
    const id = this.nextId++;
    const command = { id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${method}`));
      }, this.timeout);

      const messageHandler = (data: Buffer) => {
        try {
          const response: ChromeResponse = JSON.parse(data.toString());
          
          if (response.id === id) {
            clearTimeout(timeout);
            ws.removeListener('message', messageHandler);
            
            if (response.error) {
              reject(new Error(`Chrome command error: ${JSON.stringify(response.error)}`));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignore JSON parse errors for other messages
        }
      };

      ws.on('message', messageHandler);
      ws.send(JSON.stringify(command));
    });
  }

  /**
   * Wait for page to finish loading
   */
  private async waitForPageLoad(ws: any): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(); // Don't fail, just continue
      }, this.timeout);

      const messageHandler = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.method === 'Page.loadEventFired') {
            clearTimeout(timeout);
            ws.removeListener('message', messageHandler);
            resolve();
          }
        } catch (error) {
          // Ignore JSON parse errors
        }
      };

      ws.on('message', messageHandler);
    });
  }

  /**
   * Extract content from the loaded page using CSS selectors
   */
  private async extractContentFromPage(ws: any, cssSelector?: string): Promise<string> {
    // Get the document
    const { root } = await this.sendCommand(ws, 'DOM.getDocument');

    let content = '';

    if (cssSelector) {
      // Use specific CSS selector
      try {
        const { nodeIds } = await this.sendCommand(ws, 'DOM.querySelectorAll', {
          nodeId: root.nodeId,
          selector: cssSelector
        });

        if (nodeIds && nodeIds.length > 0) {
          const textContent = await this.sendCommand(ws, 'DOM.getOuterHTML', {
            nodeId: nodeIds[0]
          });
          
          // Extract text from HTML
          const $ = cheerio.load(textContent.outerHTML);
          content = $.root().text();
        }
      } catch (error) {
        logger.warn('CSS selector failed, falling back to default selectors', {
          cssSelector,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Fall back to default selectors if no content found
    if (!content || content.trim().length < 20) {
      const defaultSelectors = [
        'article',
        '.article-content',
        '.post-content',
        '.entry-content',
        '.story-body',
        '.content',
        'main'
      ];

      for (const selector of defaultSelectors) {
        try {
          const { nodeIds } = await this.sendCommand(ws, 'DOM.querySelectorAll', {
            nodeId: root.nodeId,
            selector: selector
          });

          if (nodeIds && nodeIds.length > 0) {
            const textContent = await this.sendCommand(ws, 'DOM.getOuterHTML', {
              nodeId: nodeIds[0]
            });
            
            const $ = cheerio.load(textContent.outerHTML);
            const extractedContent = $.root().text();
            
            if (extractedContent && extractedContent.trim().length > 50) {
              content = extractedContent;
              logger.debug('Content extracted using default selector', { selector });
              break;
            }
          }
        } catch (error) {
          // Continue to next selector
          logger.debug('Default selector failed', { selector, error });
        }
      }
    }

    // Clean up the content
    const cleanedContent = content
      .replace(/\s+/g, ' ')
      .trim();

    return cleanedContent;
  }
}

// Export factory function for easier usage
export async function createChromeScraper(chromeUrl: string): Promise<ChromeScraper> {
  // Test connection to Chrome
  try {
    const response = await fetch(`${chromeUrl}/json/version`);
    if (!response.ok) {
      throw new Error(`Cannot connect to Chrome at ${chromeUrl}: ${response.status}`);
    }
    
    const version = await response.json() as ChromeVersion;
    logger.info('Connected to Chrome successfully', {
      chromeUrl,
      version: version.Browser,
      webSocketDebuggerUrl: version.webSocketDebuggerUrl
    });
    
    return new ChromeScraper({ chromeUrl });
  } catch (error) {
    logger.error('Failed to connect to Chrome', {
      chromeUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Cannot connect to Chrome container at ${chromeUrl}. Make sure Chrome container is running.`);
  }
} 