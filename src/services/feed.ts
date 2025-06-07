import Parser from 'rss-parser';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('feed-service');

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'content'],
      ['description', 'description']
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

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  try {
    logger.debug('Fetching feed', { url });
    const feed = await parser.parseURL(url);
    const items = feed.items.map(item => ({
      title: item.title || 'No Title',
      link: item.link,
      guid: item.guid,
      content: item.content || item.description,
      description: item.description,
      isoDate: item.isoDate
    }));
    
    logger.debug('Feed fetched successfully', {
      url,
      itemCount: items.length
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