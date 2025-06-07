import axios from 'axios';
import * as cheerio from 'cheerio';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('content-service');

export async function extractContent(url: string, cssSelector?: string): Promise<string> {
  try {
    logger.debug('Extracting content', { url, cssSelector });
    const response = await axios.get(url);
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
    
    logger.debug('Content extracted', { 
      url,
      contentLength: cleanedContent.length 
    });
    
    return cleanedContent;
  } catch (error) {
    logger.error('Error extracting content', {
      error: error instanceof Error ? error.message : String(error),
      url
    });
    throw error;
  }
} 