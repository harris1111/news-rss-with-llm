import knex from 'knex';
import { createServiceLogger } from '../utils/logger';
import knexConfig from '../../knexfile';

const logger = createServiceLogger('db-service');

const db = knex(knexConfig.development);

export interface Article {
  article_url: string;
  feed_name: string;
  category: string;
  title: string;
  content: string;
  summary: string;
  keywords: string;
  published_at: Date;
  processed_at: Date;
  notification_sent: boolean;
}

// Initialize database tables
export async function initializeDatabase(): Promise<void> {
  try {
    const hasTable = await db.schema.hasTable('articles');
    if (!hasTable) {
      logger.info('Creating articles table');
      await db.schema.createTable('articles', (table) => {
        table.string('article_url', 1000).primary();
        table.string('feed_name', 100).notNullable();
        table.string('category', 100).notNullable();
        table.string('title', 500).notNullable();
        table.text('content').notNullable();
        table.text('summary').notNullable();
        table.text('keywords').notNullable();
        table.timestamp('published_at').notNullable();
        table.timestamp('processed_at').notNullable();
        table.boolean('notification_sent').notNullable().defaultTo(false);
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      logger.info('Articles table created successfully');
    } else {
      // Check if we need to add the category column
      const hasCategory = await db.schema.hasColumn('articles', 'category');
      if (!hasCategory) {
        logger.info('Adding category column to articles table');
        await db.schema.alterTable('articles', (table) => {
          table.string('category', 100).notNullable().defaultTo('uncategorized');
        });
      }
    }
  } catch (error) {
    logger.error('Error initializing database:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

export async function isArticleProcessed(url: string): Promise<boolean> {
  try {
    const result = await db('articles')
      .where('article_url', url)
      .select('article_url')
      .first();
    
    const exists = !!result;
    logger.debug('Article processing status checked', { 
      url, 
      exists
    });
    
    return exists;
  } catch (error) {
    logger.error('Error checking article processing status:', {
      error: error instanceof Error ? error.message : String(error),
      url
    });
    throw error;
  }
}

export async function insertArticle(article: Article): Promise<void> {
  try {
    // Validate required fields
    if (!article.article_url || !article.feed_name || !article.category || !article.title || 
        !article.content || !article.summary || !article.keywords || 
        !article.published_at || !article.processed_at) {
      throw new Error('Missing required fields in article data');
    }

    // Truncate strings to match column lengths
    const articleData = {
      article_url: article.article_url.substring(0, 1000),
      feed_name: article.feed_name.substring(0, 100),
      category: article.category.substring(0, 100),
      title: article.title.substring(0, 500),
      content: article.content,
      summary: article.summary,
      keywords: article.keywords,
      published_at: article.published_at,
      processed_at: article.processed_at,
      notification_sent: article.notification_sent || false
    };

    // Log the data being inserted (excluding content for brevity)
    logger.debug('Attempting to insert article', {
      url: articleData.article_url,
      title: articleData.title,
      feed: articleData.feed_name,
      category: articleData.category
    });

    // Check if article already exists
    const existing = await db('articles')
      .where('article_url', articleData.article_url)
      .first();

    if (existing) {
      logger.debug('Article already exists, skipping insert', {
        url: articleData.article_url
      });
      return;
    }

    // Insert the article
    await db('articles').insert(articleData);
    
    logger.debug('Article inserted successfully', {
      url: articleData.article_url,
      title: articleData.title
    });
  } catch (error) {
    // Enhanced error logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error inserting article:', {
      error: errorMessage,
      url: article.article_url,
      title: article.title,
      feed: article.feed_name,
      category: article.category,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

export async function markNotificationSent(url: string): Promise<void> {
  try {
    await db('articles')
      .where('article_url', url)
      .update({
        notification_sent: true,
        updated_at: db.fn.now()
      });
    logger.debug('Article marked as notification sent', { url });
  } catch (error) {
    logger.error('Error marking notification as sent:', {
      error: error instanceof Error ? error.message : String(error),
      url
    });
    throw error;
  }
}

// Initialize database on startup
initializeDatabase().catch(error => {
  logger.error('Failed to initialize database:', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
}); 