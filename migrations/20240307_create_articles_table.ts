import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('articles', (table) => {
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
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('articles');
} 