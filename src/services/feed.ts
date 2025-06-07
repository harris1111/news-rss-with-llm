import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('feed-service');

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['description', 'descriptionRaw']
    ]
  }
});

export interface FeedItem {
  title: string;
  link?: string;
  guid?: string;
  content?: string;
  description?: string;
  isoDate?: string;
}

function cleanHtmlContent(htmlContent: string): string {
  if (!htmlContent) return '';
  
  // Remove CDATA wrapper if present
  let cleaned = htmlContent.replace(/^\s*<!\[CDATA\[\s*/, '').replace(/\s*\]\]>\s*$/, '');
  
  // Parse HTML and extract text
  const $ = cheerio.load(cleaned);
  let textContent = $('body').length > 0 ? $('body').text() : $.root().text();
  
  // Clean up whitespace and formatting
  textContent = textContent
    .replace(/\s+/g, ' ')
    .trim();
  
  return textContent;
}

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  try {
    logger.debug('Fetching feed', { url });
    const feed = await parser.parseURL(url);
    const items = feed.items.map(item => {
      // Clean and process content
      const contentEncoded = item.contentEncoded ? cleanHtmlContent(item.contentEncoded) : '';
      const descriptionCleaned = item.descriptionRaw ? cleanHtmlContent(item.descriptionRaw) : '';
      const fallbackDescription = item.description ? cleanHtmlContent(item.description) : '';
      
      // Prioritize longer, more substantial content
      let bestContent = '';
      let bestDescription = '';
      
      if (contentEncoded && contentEncoded.length > 100) {
        bestContent = contentEncoded;
      } else if (descriptionCleaned && descriptionCleaned.length > 50) {
        bestContent = descriptionCleaned;
      } else if (fallbackDescription) {
        bestContent = fallbackDescription;
      }
      
      // Keep the best description for fallback
      if (descriptionCleaned) {
        bestDescription = descriptionCleaned;
      } else if (fallbackDescription) {
        bestDescription = fallbackDescription;
      }
      
      return {
        title: item.title || 'No Title',
        link: item.link,
        guid: item.guid,
        content: bestContent,
        description: bestDescription,
        isoDate: item.isoDate
      };
    });
    
    logger.debug('Feed fetched successfully', {
      url,
      itemCount: items.length,
      sampleContentLengths: items.slice(0, 3).map(item => ({
        title: item.title?.substring(0, 50) + '...',
        contentLength: item.content?.length || 0,
        descriptionLength: item.description?.length || 0
      }))
    });
    
    return items;
  } catch (error) {
    logger.error('Error fetching feed', {
      error: error instanceof Error ? error.message : String(error),
      url
    });
    throw error;
  }
} 