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
    
    // Check if RSS processing is enabled
    if (!config.rss_processing?.enabled) {
      logger.info('RSS processing is disabled in configuration');
      return;
    }
    
    let totalNewArticles = 0;
    let totalFeedsWithNews = 0;
    let totalFeedsWithoutNews = 0;
    
    for (const feed of config.feeds) {
      const items = await fetchFeed(feed.url);
      
      logger.info(`Fetched ${items.length} items from ${feed.name}`);
      
      // Apply max articles limit if configured
      const maxArticles = config.rss_processing.max_articles_per_feed;
      const itemsToProcess = maxArticles ? items.slice(0, maxArticles) : items;
      
      if (maxArticles && items.length > maxArticles) {
        logger.info(`Limited to ${maxArticles} articles for ${feed.name} (had ${items.length})`);
      }
      
      let newArticlesInFeed = 0;
      let todayArticlesInFeed = 0;
      
      for (const item of itemsToProcess) {
        const url = item.link || item.guid || '';
        
        if (!url) {
          logger.debug('Skipping item without URL', { title: item.title });
          continue;
        }
        
        // Check if article is from today (only if today_only is enabled)
        if (config.rss_processing.today_only && !isToday(item.isoDate)) {
          logger.debug('Skipping article not from today', { 
            url, 
            title: item.title,
            published: item.isoDate 
          });
          continue;
        }
        
        // Count articles from today (for logging purposes)
        if (isToday(item.isoDate)) {
          todayArticlesInFeed++;
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
            published: item.isoDate,
            content: item.content,
            description: item.description
          }
        });
        
        newArticlesInFeed++;
        logger.info('Added job to queue', { 
          url, 
          title: item.title,
          feed: feed.name 
        });
      }
      
      // Log results for this feed
      if (config.rss_processing.today_only) {
        if (todayArticlesInFeed === 0) {
          logger.info(`No articles from today found in ${feed.name}`);
          totalFeedsWithoutNews++;
        } else {
          logger.info(`Found ${todayArticlesInFeed} articles from today in ${feed.name}, ${newArticlesInFeed} were new`);
          if (newArticlesInFeed > 0) {
            totalFeedsWithNews++;
          } else {
            totalFeedsWithoutNews++;
          }
        }
      } else {
        if (newArticlesInFeed === 0) {
          logger.info(`No new articles found in ${feed.name}`);
          totalFeedsWithoutNews++;
        } else {
          logger.info(`Found ${newArticlesInFeed} new articles in ${feed.name}`);
          totalFeedsWithNews++;
        }
      }
      
      totalNewArticles += newArticlesInFeed;
    }
    
    // Log overall summary
    if (totalNewArticles === 0) {
      if (config.rss_processing.today_only) {
        logger.info(`RSS processing completed: No new articles from today found across all feeds`);
      } else {
        logger.info(`RSS processing completed: No new articles found across all feeds`);
      }
    } else {
      logger.info(`RSS processing completed: ${totalNewArticles} new articles queued from ${totalFeedsWithNews} feeds (${totalFeedsWithoutNews} feeds had no new articles)`);
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