# NewsRSS Architecture

## Overview

NewsRSS is a scalable RSS feed processing system with AI-powered Vietnamese summarization and Discord notifications. The architecture consists of producer-consumer processes communicating through Redis queues, with PostgreSQL for persistence.

## System Components

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│                 │    │              │    │                 │
│   Main Process  │───▶│ Redis Queue  │───▶│ Worker Process  │
│   (Producer)    │    │              │    │   (Consumer)    │
│                 │    │              │    │                 │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                                           │
         │                                           │
         ▼                                           ▼
┌─────────────────┐                         ┌─────────────────┐
│                 │                         │                 │
│  PostgreSQL DB  │◀────────────────────────│  AI Service     │
│                 │                         │  (Vietnamese)   │
└─────────────────┘                         └─────────────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │                 │
                                            │ Discord Service │
                                            │                 │
                                            └─────────────────┘
```

## Data Flow

### Main Process (Producer)
1. **Feed Monitoring**: Reads RSS feeds from configured sources
2. **Change Detection**: Compares against stored articles in PostgreSQL
3. **Job Creation**: Creates processing jobs for new articles
4. **Queue Publishing**: Pushes jobs to Redis queue

### Worker Process (Consumer)
1. **Job Consumption**: Pulls jobs from Redis queue
2. **Content Extraction**: Fetches and extracts article content
3. **AI Processing**: Generates Vietnamese summaries and keywords
4. **Database Storage**: Saves processed articles to PostgreSQL
5. **Notification**: Sends formatted notifications to Discord

## Detailed Component Design

### 1. Main Process (`src/main.ts`)

**Responsibilities:**
- RSS feed parsing and monitoring
- Article deduplication
- Job queue management
- Scheduling (interval/cron based)

**Key Features:**
- Configurable feed sources via YAML
- Database persistence for processed articles
- Graceful error handling and logging

### 2. Worker Process (`src/worker.ts`)

**Responsibilities:**
- Queue job processing
- Content extraction and cleaning
- AI integration and response processing
- Discord notification dispatch

**Processing Pipeline:**
```
Job → Content Extraction → AI Processing → Database Storage → Discord Notification
```

### 3. AI Service (`src/services/ai.ts`)

**Design Philosophy:**
- **Vietnamese-first**: All prompts and responses in Vietnamese
- **Robust extraction**: Multiple fallback strategies for parsing AI responses
- **Error resilience**: Always returns valid Vietnamese content

**Processing Strategy:**
```typescript
// Vietnamese prompt structure
const prompt = `
Hãy phân tích bài viết sau bằng tiếng Việt:
- Tóm tắt 2-3 câu chính
- Liệt kê 5 từ khóa quan trọng

Định dạng trả lời:
SUMMARY: [Tóm tắt bằng tiếng Việt]
KEYWORDS: [từ khóa 1, từ khóa 2, từ khóa 3, từ khóa 4, từ khóa 5]
`;
```

**Extraction Logic:**
1. **Regex Pattern Matching**: Primary extraction method
2. **Line-by-line parsing**: Secondary fallback
3. **Vietnamese content detection**: Validates response language
4. **Default fallbacks**: Ensures system continues working

### 4. Discord Service (`src/services/discord.ts`)

**Notification Format:**
- **Embed structure** with title as hyperlink
- **Clean summary** in quotes without boilerplate
- **Keywords field** at bottom
- **Vietnamese content** throughout

**Implementation:**
```typescript
const embed = {
  title: article.title,
  url: article.url,
  description: `"${summary}"`,
  fields: [
    {
      name: "Keywords",
      value: keywords.join(", "),
      inline: false
    }
  ]
};
```

### 5. Database Layer (`src/services/db.ts`)

**Technology**: PostgreSQL with Knex.js ORM

**Schema Design:**
```sql
CREATE TABLE articles (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  url TEXT NOT NULL UNIQUE,
  summary TEXT,
  keywords TEXT,
  content TEXT,
  category VARCHAR(100),
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Key Features:**
- Unique constraint on URLs for deduplication
- Sufficient field lengths for Vietnamese content
- Timestamp tracking for auditing
- Category support for feed organization

### 6. Queue System (`src/services/queue.ts`)

**Technology**: Redis with reliable queue processing

**Job Structure:**
```typescript
interface ProcessingJob {
  articleId: string;
  url: string;
  title: string;
  category: string;
  publishedAt: Date;
  retryCount?: number;
}
```

**Features:**
- Job persistence in Redis
- Retry mechanisms for failed jobs
- Graceful error handling
- Queue monitoring and health checks

### 7. Logging System (`src/utils/logger.ts`)

**Design**: Winston-based with environment-aware configuration

**Production Mode** (`NODE_ENV=production`):
- Info level and above
- Clean, structured output
- Minimal debugging noise

**Development Mode** (`NODE_ENV=development`):
- Debug level and above
- Detailed request/response logging
- Full error stack traces

**Service-specific Loggers:**
```typescript
export const aiLogger = logger.child({ service: 'ai' });
export const discordLogger = logger.child({ service: 'discord' });
export const queueLogger = logger.child({ service: 'queue' });
```

## Configuration Management

### Environment Variables
```env
# Core Services
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=disable

# AI Configuration
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.groq.com  # Flexible provider support
OPENAI_TEXT_MODEL=mixtral-8x7b-32768

# Notifications
DISCORD_WEBHOOK_URL=your-webhook

# System
NODE_ENV=production  # Controls logging verbosity
```

### Feed Configuration (`config/config.yaml`)
```yaml
feeds:
  - name: "VnExpress"
    url: "https://vnexpress.net/rss/suc-khoe.rss"
    category: "health"
    css_selector: ".fck_detail"

scheduling:
  mode: "interval"
  interval:
    minutes: 30
```

## Error Handling Strategy

### 1. Graceful Degradation
- AI failures don't stop the pipeline
- Vietnamese fallback content generated
- System continues processing other articles

### 2. Retry Mechanisms
- Failed jobs automatically retried
- Exponential backoff for transient failures
- Maximum retry limits to prevent infinite loops

### 3. Comprehensive Logging
- All errors logged with context
- Request/response debugging in development
- Clean error messages in production

### 4. Monitoring Points
- Queue depth monitoring
- AI service response times
- Database connection health
- Discord webhook status

## Security Considerations

### 1. Environment Variables
- Sensitive data in `.env` files
- No hardcoded API keys or credentials
- Environment-specific configurations

### 2. Database Security
- Connection string with SSL options
- Parameterized queries to prevent injection
- Limited database permissions

### 3. External API Security
- API key rotation support
- Rate limiting awareness
- Timeout configurations

## Scalability Design

### 1. Horizontal Scaling
- Multiple worker processes supported
- Redis queue distributes load
- Stateless worker design

### 2. Database Optimization
- Indexed URL column for fast lookups
- Efficient deduplication queries
- Configurable connection pooling

### 3. Memory Management
- Streaming content processing
- Limited job batch sizes
- Automatic resource cleanup

## Deployment Architecture

### Development
```
Local Machine:
├── Node.js processes
├── Local Redis instance
├── Local PostgreSQL
└── Direct API access
```

### Production
```
Production Server:
├── PM2 Process Manager
│   ├── Main Process (1 instance)
│   └── Worker Processes (N instances)
├── Redis Cluster
├── PostgreSQL with replication
└── Reverse Proxy (nginx)
```

## Performance Characteristics

### Throughput
- **RSS Processing**: ~100 feeds/minute
- **AI Processing**: Limited by API rate limits
- **Database Operations**: ~1000 ops/second
- **Discord Notifications**: ~50 messages/minute (webhook limits)

### Resource Usage
- **Memory**: ~200MB per worker process
- **CPU**: Low usage except during AI processing
- **Network**: Bandwidth dependent on article content size
- **Storage**: ~1KB per processed article

## Monitoring and Observability

### Key Metrics
- Articles processed per hour
- AI processing success rate
- Average response times
- Queue depth and processing lag
- Error rates by component

### Health Checks
- Database connectivity
- Redis availability
- AI service accessibility
- Discord webhook status

### Alerting
- Queue backlog thresholds
- Error rate spikes
- Service downtime detection
- Resource exhaustion warnings

## Future Enhancements

### Planned Features
1. **Web Dashboard**: Real-time monitoring interface
2. **Multiple Languages**: Support for other languages besides Vietnamese
3. **Content Classification**: Automatic categorization beyond manual config
4. **Sentiment Analysis**: Mood detection in article summaries
5. **Advanced Filtering**: User-configurable content filters

### Scalability Improvements
1. **Microservices**: Split into smaller, focused services
2. **Event Streaming**: Apache Kafka for high-throughput scenarios
3. **Caching Layer**: Redis caching for frequently accessed content
4. **Load Balancing**: Multiple AI provider support with failover 