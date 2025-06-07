import 'dotenv/config';
import { createServiceLogger } from './utils/logger';
import { popJob } from './services/queue';
import { extractContent } from './services/content';
import { summarizeAndExtract } from './services/ai';
import { sendNotification } from './services/notification';
import { isArticleProcessed, insertArticle, markNotificationSent } from './services/db';

const logger = createServiceLogger('worker');

async function processJob() {
  try {
    const job = await popJob();
    if (!job) {
      logger.debug('No jobs in queue');
      return;
    }

    logger.info('Processing job', {
      url: job.url,
      feed: job.feedName,
      category: job.category
    });

    // Check if already processed
    if (await isArticleProcessed(job.url)) {
      logger.info('Article already processed', { url: job.url });
      return;
    }

    // Extract content with fallback to RSS content
    let content = '';
    let contentSource = 'web-scraped';
    
    try {
      content = await extractContent(job.url, job.css_selector);
      if (!content) {
        throw new Error('No content extracted from web scraping');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('Web scraping failed, trying RSS content fallback', {
        url: job.url,
        error: errorMessage
      });
      
      // Try RSS content as fallback (prioritize longer content)
      const rssContent = job.meta?.content || '';
      const rssDescription = job.meta?.description || '';
      
      if (rssContent && rssContent.length >= 100) {
        content = rssContent;
        contentSource = 'rss-content';
        logger.info('Using RSS content as fallback', {
          url: job.url,
          contentLength: content.length,
          contentPreview: content.substring(0, 100) + '...'
        });
      } else if (rssDescription && rssDescription.length >= 50) {
        content = rssDescription;
        contentSource = 'rss-description';
        logger.info('Using RSS description as fallback', {
          url: job.url,
          contentLength: content.length,
          contentPreview: content.substring(0, 100) + '...'
        });
      } else if (rssContent) {
        // Use RSS content even if short
        content = rssContent;
        contentSource = 'rss-content-short';
        logger.info('Using short RSS content as fallback', {
          url: job.url,
          contentLength: content.length,
          warning: 'Content may be too short for optimal summarization'
        });
      } else {
        logger.error('No content available from web scraping or RSS', {
          url: job.url,
          originalError: errorMessage,
          rssContentLength: rssContent.length,
          rssDescriptionLength: rssDescription.length
        });
        return;
      }
    }

    if (!content || content.trim().length < 20) {
      logger.warn('Content too short or empty', { 
        url: job.url, 
        contentLength: content.length,
        contentSource,
        minLength: 20
      });
      return;
    }

    // Process with AI
    const result = await summarizeAndExtract(content, job.meta?.title || '');
    
    logger.debug('AI processing completed', {
      title: job.meta?.title,
      summaryLength: result.summary.length,
      keywordCount: result.keywords.length,
      contentSource
    });
    
    // Store in database
    await insertArticle({
      article_url: job.url,
      feed_name: job.feedName,
      category: job.category,
      title: job.meta?.title || 'No Title',
      content,
      summary: result.summary,
      keywords: result.keywords.join(', '),
      published_at: job.meta?.published ? new Date(job.meta.published) : new Date(),
      processed_at: new Date(),
      notification_sent: false
    });

    logger.debug('Sending notification', {
      title: job.meta?.title || 'No Title',
      category: job.category,
      contentSource
    });

    // Send notification
    await sendNotification(
      job.meta?.title || 'No Title',
      result.summary,
      result.keywords,
      job.url,
      job.category
    );

    // Mark notification as sent
    await markNotificationSent(job.url);

    logger.info('Job processed successfully', {
      url: job.url,
      feed: job.feedName,
      category: job.category,
      contentSource
    });
  } catch (error) {
    logger.error('Error processing job', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Start processing jobs
async function start() {
  logger.info('Worker started');
  while (true) {
    await processJob();
    // Wait for 5 seconds before checking for new jobs
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

start().catch(error => {
  logger.error('Error in worker process', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
}); 