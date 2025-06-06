import { loadConfig, FeedConfig, AppConfig } from './config';
import { fetchFeed, RSSItem } from './rss';
import { extractContent } from './extract';
import { summarizeAndExtract } from './ai';
import { isArticleProcessed, insertArticle } from './db';
import { sendDiscordNotification, sendTelegramNotification, formatNotification } from './notify';
import { randomDelay, retry } from './utils';
import winston from 'winston';
import axios from 'axios';
import Parser from 'rss-parser';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

async function processFeed(feed: FeedConfig, config: AppConfig) {
  logger.info(`Starting to process feed: ${feed.name}`, { feed_url: feed.rss_url });
  const items = await fetchFeed(feed);
  logger.info(`Retrieved ${items.length} items from feed: ${feed.name}`);
  
  for (const item of items) {
    const url = item.link || item.guid;
    if (!url) {
      logger.warn('Skipping item without URL', { title: item.title });
      continue;
    }

    logger.debug('Checking if article is already processed', { url, title: item.title });
    if (await isArticleProcessed(url)) {
      logger.info(`Article already processed, skipping`, { url, title: item.title });
      continue;
    }

    const title = item.title || 'Untitled';
    logger.info(`Processing new article`, { 
      url, 
      title,
      published_date: item.isoDate,
      feed_name: feed.name 
    });

    try {
      logger.debug('Starting content extraction', { url, selector: feed.css_selector });
      const extractedContent = await retry(
        async () => {
          const extracted = await extractContent(url, feed.css_selector);
          logger.debug('Content extraction result', { 
            url,
            content_length: extracted?.length,
            is_empty: !extracted,
            is_failed: extracted === 'Failed to extract content',
            is_no_content: extracted === 'No content found'
          });

          if (!extracted || extracted === 'Failed to extract content' || extracted === 'No content found') {
            throw new Error('Failed to extract content');
          }
          return extracted;
        },
        config.retry.max_attempts,
        config.retry.initial_delay_seconds
      );

      if (!extractedContent) {
        logger.error('Content extraction failed - no content returned', { url });
        continue;
      }

      logger.info(`Content extraction successful`, { 
        url,
        content_length: extractedContent.length,
        title
      });

      logger.debug('Starting AI processing', { url, title });
      const result = await retry(
        async () => {
          try {
            const aiResult = await summarizeAndExtract(extractedContent, title);
            logger.debug('AI processing result', {
              url,
              has_summary: !!aiResult.summary,
              has_keywords: !!aiResult.keywords,
              summary_length: aiResult.summary?.length,
              keywords_length: aiResult.keywords?.length
            });
            return aiResult;
          } catch (error) {
            logger.error(`Error in summarizeAndExtract`, { 
              url,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
          }
        },
        config.retry.max_attempts,
        config.retry.initial_delay_seconds
      );

      if (!result || !result.summary || !result.keywords) {
        logger.error('Invalid AI processing result', { 
          url,
          has_result: !!result,
          has_summary: !!result?.summary,
          has_keywords: !!result?.keywords
        });
        continue;
      }

      const { summary, keywords } = result;
      logger.info(`AI processing successful`, { 
        url,
        summary_length: summary.length,
        keywords_length: keywords.length
      });

      logger.debug('Inserting article into database', { url });
      await insertArticle({
        feed_name: feed.name,
        article_url: url,
        title,
        content: extractedContent,
        summary,
        keywords,
        published_at: item.isoDate ? new Date(item.isoDate) : new Date(),
        processed_at: new Date(),
        notification_sent: false,
      });
      logger.info(`Article inserted into database`, { url });

      const message = formatNotification({ 
        title, 
        url, 
        summary, 
        keywords 
      });

      // Notification logic
      const notify = feed.override_notify || (config.default_notify_discord ? 'discord' : config.default_notify_telegram ? 'telegram' : '');
      logger.debug('Preparing to send notification', { 
        url,
        notify_type: notify,
        has_discord_webhook: !!(feed.override_discord_webhook || config.default_discord_webhook),
        has_telegram_token: !!(feed.override_telegram_bot_token || config.default_telegram_bot_token)
      });

      if (notify === 'discord' && (feed.override_discord_webhook || config.default_discord_webhook)) {
        await sendDiscordNotification(feed.override_discord_webhook || config.default_discord_webhook, message);
        logger.info(`Discord notification sent`, { url });
      } else if (notify === 'telegram' && (feed.override_telegram_bot_token || config.default_telegram_bot_token)) {
        await sendTelegramNotification(
          feed.override_telegram_bot_token || config.default_telegram_bot_token,
          feed.override_telegram_chat_id || config.default_telegram_chat_id,
          message
        );
        logger.info(`Telegram notification sent`, { url });
      }

      logger.info(`Article processing completed successfully`, { url });

      // Add delay between processing articles (30-60 seconds)
      const delay = Math.floor(Math.random() * (60 - 30 + 1) + 30) * 1000;
      logger.info('Adding cooldown between articles', { 
        delay_seconds: Math.floor(delay / 1000),
        next_article: item.title
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (err) {
      logger.error(`Failed to process article`, { 
        url,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      });
    }
  }
}

async function main() {
  logger.info('Starting application');
  try {
    const config = loadConfig();
    logger.info('Configuration loaded', { 
      feed_count: config.feeds.length,
      feeds: config.feeds.map(f => f.name)
    });

    for (const feed of config.feeds) {
      await processFeed(feed, config);
    }
    logger.info('All feeds processed successfully');
  } catch (err) {
    logger.error('Fatal error in main process', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error('Unhandled error in main process', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  });
  process.exit(1);
}); 