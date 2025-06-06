import Parser from 'rss-parser';
import { FeedConfig } from './config';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml; q=0.9, */*; q=0.8',
  },
  customFields: {
    item: [
      ['title', 'title'],
      ['link', 'link'],
      ['guid', 'guid'],
      ['pubDate', 'isoDate'],
      ['content', 'content'],
      ['content:encoded', 'content'],
      ['description', 'contentSnippet'],
    ],
  },
});

export interface RSSItem {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
}

function normalizeUrl(url: string): string {
  // Remove any tracking parameters
  const cleanUrl = url.split('?')[0];
  // Ensure the URL is properly formatted
  return cleanUrl.replace(/\/+/g, '/').replace(/:\//, '://');
}

export async function fetchFeed(feed: FeedConfig): Promise<RSSItem[]> {
  try {
    console.log(`Fetching feed from: ${feed.rss_url}`);
    const feedData = await parser.parseURL(feed.rss_url);
    
    if (!feedData.items || feedData.items.length === 0) {
      console.log('No items found in feed');
      return [];
    }

    // Process and normalize URLs
    const items = feedData.items.map(item => {
      if (item.link) {
        item.link = normalizeUrl(item.link);
      }
      if (item.guid) {
        item.guid = normalizeUrl(item.guid);
      }
      return item;
    });

    console.log(`Found ${items.length} items in feed`);
    return items;
  } catch (error) {
    console.error(`Failed to fetch feed ${feed.name}:`, error);
    return [];
  }
} 