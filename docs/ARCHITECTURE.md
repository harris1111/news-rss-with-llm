# NewsRSS Architecture Documentation

## Overview
NewsRSS is a distributed application that fetches RSS feeds, processes articles using AI, and sends notifications to Discord. It uses a producer/worker architecture with Redis as the message queue.

## Core Components

### 1. Producer (main.ts)
The producer is responsible for fetching RSS feeds and pushing jobs to Redis. It supports multiple scheduling modes for feed processing.

```typescript
async function processFeeds() {
  try {
    const config = await loadConfig();
    for (const feed of config.feeds) {
      const items = await fetchFeed(feed);
      for (const item of items) {
        await pushJob({
          url: item.link || item.guid,
          feedName: feed.name,
          category: feed.category || '',
          css_selector: feed.css_selector,
          meta: { title: item.title, published: item.isoDate }
        });
      }
    }
  } catch (error) {
    logger.error('Error in feed processing cycle:', error);
  }
}
```

**Scheduling Modes:**
1. **Interval Mode**
```typescript
case 'interval':
  const intervalMs = config.scheduling.interval.minutes * 60 * 1000;
  setInterval(processFeeds, intervalMs);
  break;
```

2. **Cron Mode**
```typescript
case 'cron':
  cron.schedule(cronExpression, () => {
    const zonedTime = zonedTimeToUtc(now, timezone);
    processFeeds();
  }, { timezone: timezone });
  break;
```

3. **Manual Mode**
```typescript
case 'manual':
  logger.info('Running in manual mode - no automatic scheduling');
  break;
```

**Key Functions:**
- `loadConfig()`: Loads application configuration from YAML
- `fetchFeed()`: Retrieves RSS feed items
- `pushJob()`: Pushes article processing jobs to Redis queue

### 2. Worker (worker.ts)
The worker processes jobs from Redis, extracts content, summarizes, and sends notifications.

```typescript
async function processJob(job: QueueJob, config: any) {
  // 1. Fetch article content
  const content = await extractContent(job.url, job.css_selector);
  // 2. Summarize and extract keywords
  const result = await summarizeAndExtract(content, job.meta?.title || '');
  // 3. Send Discord notification
  await sendDiscordNotification(
    job.meta?.title || 'No Title',
    result.summary,
    parseKeywords(result.keywords),
    job.url,
    job.category
  );
}
```

**Key Functions:**
- `extractContent()`: Extracts article content using CSS selectors
- `summarizeAndExtract()`: Uses AI to summarize content and extract keywords
- `sendDiscordNotification()`: Sends formatted notifications to Discord

### 3. Queue Management (queue.ts)
Handles Redis queue operations for job distribution.

```typescript
export async function pushJob(job: QueueJob) {
  await redis.lpush(QUEUE_NAME, JSON.stringify(job));
}

export async function popJob(): Promise<QueueJob | null> {
  const job = await redis.rpop(QUEUE_NAME);
  return job ? JSON.parse(job) : null;
}
```

### 4. Discord Integration (discord.ts)
Manages Discord webhook configuration and message formatting.

```typescript
export async function sendDiscordNotification(
  title: string,
  summary: string,
  keywords: string[],
  sourceUrl: string,
  category: string
): Promise<void> {
  const webhookUrl = config.categories[category] || config.default_webhook_url;
  const message = formatDiscordMessage(title, summary, keywords, sourceUrl);
  await axios.post(webhookUrl, message);
}
```

## Docker Compose Architecture

### Services

1. **Redis Service**
```yaml
redis:
  image: redis:7
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```
- Persistent storage for Redis data
- Exposed port for external access
- Automatic restart on failure

2. **Producer Service**
```yaml
newsrss-producer:
  build: .
  command: node dist/main.js
  env_file:
    - .env
  volumes:
    - ./config:/app/config
  depends_on:
    - redis
  restart: unless-stopped
```
- Environment variables from .env file
- Config volume mounted
- Depends on Redis
- Automatic restart policy

3. **Worker Service**
```yaml
newsrss-worker:
  build: .
  command: node dist/worker.js
  env_file:
    - .env
  depends_on:
    - redis
  restart: unless-stopped
  scale: 2
```
- Multiple instances for scaling
- Shared environment configuration
- Automatic restart policy

### Environment Configuration
```env
NODE_ENV=production
REDIS_URL=redis://redis:6379
OPENAI_API_KEY=your-api-key-here
```

## Data Flow
1. Producer fetches RSS feeds based on scheduling configuration
2. Jobs are pushed to Redis queue
3. Worker(s) pick up jobs
4. Content is extracted and processed
5. Notifications are sent to Discord

## Configuration
The application is configured via `config/config.yaml`:
- RSS feed definitions
- Discord webhook URLs
- Processing delays
- Retry strategies
- Scheduling configuration

## Environment Variables
- `NODE_ENV`: 'development' or 'production'
- `REDIS_URL`: Redis connection string
- `OPENAI_API_KEY`: OpenAI API key

## Logging
- Development: Detailed logs with all metadata
- Production: Essential logs with sensitive data masked

## Recommended Improvements (TODO)

### 1. Error Recovery
- Implement dead letter queue for failed jobs
- Add job retry mechanism with exponential backoff
- Store failed jobs in database for manual review

### 2. Monitoring
- Add health check endpoints
- Implement metrics collection (Prometheus)
- Add tracing for distributed debugging

### 3. Scaling
- Implement worker auto-scaling
- Add load balancing for workers
- Implement rate limiting per feed

### 4. Security
- Add webhook URL rotation
- Implement request signing
- Add IP whitelisting for Discord webhooks

### 5. Features
- Add support for more notification channels
- Implement content filtering
- Add user preferences for notifications
- Add support for custom AI models
- Implement content deduplication
- Add support for feed categories
- Implement feed health monitoring
- Add support for custom CSS selectors per feed

### 6. Performance
- Implement content caching
- Add batch processing for notifications
- Optimize database queries
- Implement connection pooling

### 7. Testing
- Add unit tests for all components
- Implement integration tests
- Add load testing
- Implement chaos testing

### 8. Documentation
- Add API documentation
- Create deployment guides
- Add troubleshooting guides
- Create user documentation 