import 'dotenv/config';
import { createServiceLogger } from './utils/logger';
import { loadConfig } from './services/config';
import { fetchFeed } from './services/feed';
import { pushJob } from './services/queue';
import { isArticleProcessed } from './services/db';
import cron from 'node-cron';
import { formatInTimeZone } from 'date-fns-tz';

const logger = createServiceLogger('rss-producer');

function isToday(dateString: string | undefined): boolean {
  if (!dateString) return false;
  
  const articleDate = new Date(dateString);
  
  // Check for invalid dates
  if (isNaN(articleDate.getTime())) {
    return false;
  }
  
  const today = new Date();
  
  // Use UTC for consistent timezone handling
  const todayStart = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ));
  const articleStart = new Date(Date.UTC(
    articleDate.getUTCFullYear(),
    articleDate.getUTCMonth(),
    articleDate.getUTCDate()
  ));
  
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

function startScheduling(schedulingConfig: any, processFunction: () => Promise<void>, name: string) {
  switch (schedulingConfig.mode) {
    case 'interval':
      if (!schedulingConfig.interval?.minutes) {
        throw new Error(`${name} interval minutes not configured`);
      }
      const intervalMs = schedulingConfig.interval.minutes * 60 * 1000;
      setInterval(processFunction, intervalMs);
      logger.info(`Started ${name} interval-based scheduling`, {
        intervalMinutes: schedulingConfig.interval.minutes
      });
      break;
      
    case 'cron':
      if (!schedulingConfig.cron?.expression) {
        throw new Error(`${name} cron expression not configured`);
      }
      const { expression, timezone } = schedulingConfig.cron;
      const tz = timezone || schedulingConfig.timezone || 'UTC';
      cron.schedule(expression, () => {
        const now = new Date();
        const zonedTime = formatInTimeZone(now, tz, 'yyyy-MM-dd HH:mm:ss');
        logger.debug(`${name} cron job triggered`, { time: zonedTime });
        processFunction();
      }, { timezone: tz });
      logger.info(`Started ${name} cron-based scheduling`, {
        expression,
        timezone: tz
      });
      break;
      
    case 'manual':
      logger.info(`${name} running in manual mode - no automatic scheduling`);
      break;
      
    default:
      throw new Error(`Unknown scheduling mode for ${name}: ${schedulingConfig.mode}`);
  }
}

async function main() {
  try {
    logger.info('RSS Processing Application starting...');
    
    const config = await loadConfig();
    
    // Start RSS processing scheduling
    startScheduling(config.scheduling.rss_processing, processFeeds, 'RSS processing');
    
    // Initial run
    logger.info('Running initial RSS processing');
    await processFeeds();
    
    logger.info('RSS Processing Application started successfully');
    
    // Keep the process running
    process.on('SIGINT', () => {
      logger.info('Received SIGINT. Gracefully shutting down...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM. Gracefully shutting down...');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Error in RSS processing application', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

main(); 