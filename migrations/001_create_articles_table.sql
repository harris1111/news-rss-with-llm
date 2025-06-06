CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  feed_name VARCHAR,
  article_url TEXT UNIQUE,
  title TEXT,
  content TEXT,
  summary TEXT,
  keywords TEXT,
  published_at TIMESTAMP,
  processed_at TIMESTAMP,
  notification_sent BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_article_url ON articles(article_url); 