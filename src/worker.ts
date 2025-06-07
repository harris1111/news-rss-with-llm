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

    // Extract content
    const content = await extractContent(job.url, job.css_selector);
    if (!content) {
      logger.warn('No content extracted', { url: job.url });
      return;
    }

    // Process with AI
    const result = await summarizeAndExtract(content, job.meta?.title || '');
    
    logger.debug('AI processing completed', {
      title: job.meta?.title,
      summaryLength: result.summary.length,
      keywordCount: result.keywords.length
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
      category: job.category
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
      category: job.category
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