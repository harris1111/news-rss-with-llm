import 'dotenv/config';
import { createServiceLogger } from './utils/logger';
import { loadConfig } from './services/config';
import { searchNewsArticles } from './services/ai-search';
import { sendSearchResultsForCategory } from './services/discord-search';
import cron from 'node-cron';
import { formatInTimeZone } from 'date-fns-tz';

const logger = createServiceLogger('ai-search-app');

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
    logger.info('AI Search Application starting...');
    
    const config = await loadConfig();
    
    // Check if AI search is enabled
    if (!config.scheduling.ai_search?.enabled) {
      logger.error('AI search is disabled in configuration. Exiting.');
      process.exit(1);
    }
    
    // Start AI search scheduling
    startScheduling(config.scheduling.ai_search, processAISearch, 'AI search');
    
    // Initial run
    logger.info('Running initial AI search');
    await processAISearch();
    
    logger.info('AI Search Application started successfully');
    
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
    logger.error('Error in AI search application', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

main(); 