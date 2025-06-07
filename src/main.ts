import 'dotenv/config';
import { createServiceLogger } from './utils/logger';
import { loadConfig } from './services/config';
import { fetchFeed } from './services/feed';
import { pushJob } from './services/queue';
import { isArticleProcessed } from './services/db';
import { searchNewsArticles } from './services/ai-search';
import { sendSearchResultsForCategory } from './services/discord-search';
import cron from 'node-cron';
import { formatInTimeZone } from 'date-fns-tz';

const logger = createServiceLogger('producer');

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

async function processAISearch() {
  try {
    const config = await loadConfig();
    
    if (!config.ai_search_categories) {
      logger.debug('No AI search categories configured');
      return;
    }

    logger.info('Starting AI search processing');
    
    for (const [categoryKey, searchCategory] of Object.entries(config.ai_search_categories)) {
      if (!searchCategory.enabled) {
        logger.debug('Skipping disabled search category', { categoryKey });
        continue;
      }
      
      logger.info('Processing AI search for category', { 
        categoryKey,
        category: searchCategory.category 
      });
      
      try {
        const searchResult = await searchNewsArticles(searchCategory);
        
        if (searchResult && searchResult.articles.length > 0) {
          await sendSearchResultsForCategory(searchResult, categoryKey);
          logger.info('AI search completed for category', {
            categoryKey,
            articlesFound: searchResult.articles.length
          });
        } else {
          logger.warn('No articles found for search category', { categoryKey });
        }
      } catch (error) {
        logger.error('Error processing AI search for category', {
          error: error instanceof Error ? error.message : String(error),
          categoryKey
        });
      }
    }
    
    logger.info('AI search processing completed');
  } catch (error) {
    logger.error('Error in AI search processing cycle', {
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
    const config = await loadConfig();
    
    // Start RSS processing scheduling
    startScheduling(config.scheduling.rss_processing, processFeeds, 'RSS processing');
    
    // Start AI search scheduling if enabled
    if (config.scheduling.ai_search?.enabled) {
      startScheduling(config.scheduling.ai_search, processAISearch, 'AI search');
    } else {
      logger.info('AI search is disabled');
    }
    
    // Initial runs
    logger.info('Running initial RSS processing');
    await processFeeds();
    
    if (config.scheduling.ai_search?.enabled) {
      logger.info('Running initial AI search');
      await processAISearch();
    }
    
    logger.info('All scheduling started successfully');
  } catch (error) {
    logger.error('Error in main process', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

main(); 