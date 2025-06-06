import knex from 'knex';
import dotenv from 'dotenv';
dotenv.config();

const db = knex({
  client: 'postgresql',
  connection: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DB || 'newsrss',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
  },
  pool: {
    min: 2,
    max: 10
  }
});

export interface Article {
  feed_name: string;
  article_url: string;
  title: string;
  content: string;
  summary: string;
  keywords: string;
  published_at: Date;
  processed_at: Date;
  notification_sent?: boolean;
}

export async function isArticleProcessed(article_url: string): Promise<boolean> {
  const result = await db('articles')
    .where({ article_url })
    .first();
  return !!result;
}

export async function insertArticle(article: Article): Promise<void> {
  await db('articles')
    .insert(article)
    .onConflict('article_url')
    .ignore();
} 