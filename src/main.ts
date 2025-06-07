import 'dotenv/config';
import { createServiceLogger } from './utils/logger';
import { loadConfig } from './services/config';
import { fetchFeed } from './services/feed';
import { pushJob } from './services/queue';
import { isArticleProcessed } from './services/db';
import cron from 'node-cron';
import { formatInTimeZone } from 'date-fns-tz';

const logger = createServiceLogger('producer');

function isToday(dateString: string | undefined): boolean {
  if (!dateString) return false;
  
  const articleDate = new Date(dateString);
  const today = new Date();
  
  // Reset time to start of day for comparison
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const articleStart = new Date(articleDate.getFullYear(), articleDate.getMonth(), articleDate.getDate());
  
  return todayStart.getTime() === articleStart.getTime();
}

async function processFeeds() {
  try {
    const config = await loadConfig();
    for (const feed of config.feeds) {
      const items = await fetchFeed(feed.url);
      
      logger.info(`Fetched ${items.length} items from ${feed.name}`);
      
      for (const item of items) {
        const url = item.link || item.guid || '';
        
        if (!url) {
          logger.debug('Skipping item without URL', { title: item.title });
          continue;
        }
        
        // Check if article is from today
        if (!isToday(item.isoDate)) {
          logger.debug('Skipping article not from today', { 
            url, 
            title: item.title,
            published: item.isoDate 
          });
          continue;
        }
        
        // Check if article is already processed
        if (await isArticleProcessed(url)) {
          logger.debug('Skipping already processed article', { 
            url, 
            title: item.title 
          });
          continue;
        }
        
        await pushJob({
          url,
          feedName: feed.name,
          category: feed.category || '',
          css_selector: feed.css_selector || '',
          meta: {
            title: item.title,
            published: item.isoDate
          }
        });
        
        logger.info('Added job to queue', { 
          url, 
          title: item.title,
          feed: feed.name 
        });
      }
    }
  } catch (error) {
    logger.error('Error in feed processing cycle', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function main() {
  try {
    const config = await loadConfig();
    
    switch (config.scheduling.mode) {
      case 'interval':
        if (!config.scheduling.interval?.minutes) {
          throw new Error('Interval minutes not configured');
        }
        const intervalMs = config.scheduling.interval.minutes * 60 * 1000;
        setInterval(processFeeds, intervalMs);
        logger.info('Started interval-based scheduling', {
          intervalMinutes: config.scheduling.interval.minutes
        });
        break;
        
      case 'cron':
        if (!config.scheduling.cron?.expression || !config.scheduling.cron?.timezone) {
          throw new Error('Cron expression or timezone not configured');
        }
        const { expression, timezone } = config.scheduling.cron;
        cron.schedule(expression, () => {
          const now = new Date();
          const zonedTime = formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm:ss');
          processFeeds();
        }, { timezone });
        logger.info('Started cron-based scheduling', {
          expression,
          timezone
        });
        break;
        
      case 'manual':
        logger.info('Running in manual mode - no automatic scheduling');
        break;
        
      default:
        throw new Error(`Unknown scheduling mode: ${config.scheduling.mode}`);
    }
    
    // Initial run
    await processFeeds();
  } catch (error) {
    logger.error('Error in main process', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

main(); 