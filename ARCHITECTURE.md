# NewsRSS Architecture

## Overview

NewsRSS is a distributed system that processes RSS feeds, summarizes articles using AI, and sends notifications. The system is designed to be scalable, maintainable, and fault-tolerant.

## Components

### 1. Main Process (`main.ts`)
- Monitors configured RSS feeds
- Creates jobs for new articles
- Pushes jobs to Redis queue
- Handles scheduling (interval/cron)

### 2. Worker Process (`worker.ts`)
- Consumes jobs from Redis queue
- Extracts article content
- Processes content with AI
- Stores results in database
- Sends notifications

### 3. Redis Queue
- Job distribution
- Decouples producer (main) from consumer (worker)
- Enables horizontal scaling
- Provides job persistence

### 4. PostgreSQL Database
- Stores processed articles
- Tracks notification status
- Prevents duplicate processing

### 5. AI Service
- Uses OpenAI-compatible API
- Configurable model and endpoint
- Handles article summarization
- Extracts key topics

### 6. Discord Integration
- Sends plain text notifications (not embed)
- Format:
  ```
  Tiêu đề bài báo
  "Tóm tắt bài báo"
  Keywords
  kw1, kw2, kw3
  ```
- No introductory/boilerplate text

## Data Flow

```
+-------------+     +-------------+     +-------------+
|  RSS Feeds  | --> | Main Process| --> | Redis Queue |
+-------------+     +-------------+     +-------------+
                                           |
                                           v
+-------------+     +-------------+     +-------------+
|  Database   | <-- |   Worker    | <-- | AI Service  |
+-------------+     +-------------+     +-------------+
        |
        v
+-------------+
|  Discord    |
+-------------+
```

## Configuration

### Environment Variables
```env
# Redis Configuration
REDIS_URL=redis://localhost:6379

# PostgreSQL Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/newsrss?sslmode=disable

# OpenAI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com  # Or your local inference server (no /openai/v1)
OPENAI_TEXT_MODEL=gpt-3.5-turbo  # Or your preferred model

# Discord Configuration
DISCORD_WEBHOOK_URL=your-webhook-url
```

### Feed Configuration (`config.yaml`)
```yaml
feeds:
  - name: "Tech News"
    url: "https://example.com/feed.xml"
    category: "technology"
    css_selector: "article.content"

scheduling:
  mode: "interval"  # or "cron" or "manual"
  interval:
    minutes: 30
```

## Scaling

The system can be scaled horizontally by:
1. Running multiple worker processes
2. Using multiple Redis instances
3. Distributing workers across machines

## Error Handling

- Retries for transient failures
- Dead letter queue for failed jobs
- Comprehensive logging
- Error notifications

## Monitoring

- Detailed logging
- Job processing metrics
- Error tracking
- Performance monitoring

## Security

- Environment variable management
- API key protection
- Webhook URL security
- Input validation

## Future Improvements

1. **High Availability**
   - Redis cluster
   - Database replication
   - Load balancing

2. **Enhanced Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Alerting

3. **Advanced Features**
   - Custom AI models
   - Multiple notification channels
   - Content filtering
   - User preferences 