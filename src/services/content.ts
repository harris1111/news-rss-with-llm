import axios from 'axios';
import * as cheerio from 'cheerio';
import { createServiceLogger } from '../utils/logger';
import { createChromeScraper, ChromeScraper } from './chrome-scraper';
import { loadConfig } from './config';

const logger = createServiceLogger('content-service');

// Cache for Chrome scraper instance
let chromeScraper: ChromeScraper | null = null;

// Configure axios with browser-like headers to avoid 403 errors
const httpClient = axios.create({
  timeout: 30000, // 30 second timeout
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0'
  }
});

export async function extractContent(url: string, cssSelector?: string, scrapingMode?: 1 | 2): Promise<string> {
  // Determine scraping mode - default to HTTP (1) if not specified
  const mode = scrapingMode || 1;
  
  logger.debug('Extracting content', { url, cssSelector, scrapingMode: mode });
  
  if (mode === 2) {
    // Chrome-based scraping
    return extractContentWithChrome(url, cssSelector);
  } else {
    // HTTP-based scraping (original method)
    return extractContentWithHttp(url, cssSelector);
  }
}

async function extractContentWithHttp(url: string, cssSelector?: string): Promise<string> {
  const maxRetries = 3;
  const baseDelay = 2000; // 2 seconds base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('HTTP scraping attempt', { url, cssSelector, attempt });
      
      const response = await httpClient.get(url);
      const $ = cheerio.load(response.data);
      
      let content = '';
      if (cssSelector) {
        content = $(cssSelector).text();
      } else {
        // Default selectors for common article containers
        const selectors = [
          'article',
          '.article-content',
          '.post-content',
          '.entry-content',
          '.articlebody', // For The Hacker News
          '.story-body',
          '.content',
          'main'
        ];
        
        for (const selector of selectors) {
          const element = $(selector);
          if (element.length > 0) {
            content = element.text();
            break;
          }
        }
      }
      
      // Clean up the content
      const cleanedContent = content
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!cleanedContent) {
        logger.warn('No content extracted from page', { 
          url,
          availableSelectors: cssSelector ? [cssSelector] : 'default selectors used',
          attempt
        });
      }
      
      logger.debug('HTTP content extracted', { 
        url,
        contentLength: cleanedContent.length,
        attempt: attempt === 1 ? undefined : attempt
      });
      
      return cleanedContent;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isLastAttempt = attempt === maxRetries;
      
      // Log the attempt
      logger.warn(`HTTP scraping attempt ${attempt}/${maxRetries} failed`, {
        url,
        error: errorMessage,
        willRetry: !isLastAttempt
      });
      
      // For 403 errors, provide helpful information on final attempt
      if (errorMessage.includes('403') && isLastAttempt) {
        logger.warn('Website blocked all requests (403 Forbidden)', {
          url,
          totalAttempts: maxRetries,
          suggestion: 'The website has strong anti-bot protection. Consider using Chrome scraping mode (2).'
        });
      }
      
      // If this is the last attempt, throw the error
      if (isLastAttempt) {
        throw error;
      }
      
      // Calculate delay with exponential backoff: 2s, 4s, 8s
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.debug(`Waiting ${delay}ms before retry`, { url, attempt });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw new Error('Maximum retries exceeded');
}

async function extractContentWithChrome(url: string, cssSelector?: string): Promise<string> {
  try {
    // Get Chrome URL from config
    const config = await loadConfig();
    const chromeUrl = config.rss_processing?.chrome_url || 'http://chrome:9222';
    
    // Initialize Chrome scraper if not already done
    if (!chromeScraper) {
      logger.info('Initializing Chrome scraper', { chromeUrl });
      chromeScraper = await createChromeScraper(chromeUrl);
    }
    
    // Extract content using Chrome
    const content = await chromeScraper.extractContent(url, cssSelector);
    
    logger.debug('Chrome content extracted', {
      url,
      contentLength: content.length,
      cssSelector
    });
    
    return content;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Chrome scraping failed', {
      url,
      cssSelector,
      error: errorMessage
    });
    
    // Reset Chrome scraper instance on failure (will be recreated on next attempt)
    chromeScraper = null;
    
    throw error;
  }
} 