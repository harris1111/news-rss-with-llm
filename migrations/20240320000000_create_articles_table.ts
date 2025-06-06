import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('articles', (table) => {
    table.increments('id').primary();
    table.string('feed_name');
    table.text('article_url').unique();
    table.text('title');
    table.text('content');
    table.text('summary');
    table.text('keywords');
    table.timestamp('published_at');
    table.timestamp('processed_at');
    table.boolean('notification_sent').defaultTo(false);
    table.index('article_url');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('articles');
} 