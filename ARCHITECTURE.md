# NewsRSS Architecture

## Overview

NewsRSS is a microservices-based RSS feed processing system with AI-powered Vietnamese summarization and AI news search capabilities. The system consists of two independent applications: RSS Processing Service and AI Search Service, each with their own deployment and scaling characteristics.

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        NewsRSS System                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
├─── RSS Processing Service ─────┬─── AI Search Service ──────────┤
│                                │                                │
│  ┌──────────────┐              │  ┌──────────────┐              │
│  │   Main       │              │  │ AI Search    │              │
│  │  Process     │              │  │    App       │              │
│  └──────────────┘              │  └──────────────┘              │
│         │                      │         │                      │
│         ▼                      │         ▼                      │
│  ┌──────────────┐              │  ┌──────────────┐              │
│  │   Redis      │              │  │   Discord    │              │
│  │   Queue      │              │  │   Search     │              │
│  └──────────────┘              │  │   Service    │              │
│         │                      │  └──────────────┘              │
│         ▼                      │                                │
│  ┌──────────────┐              │                                │
│  │   Worker     │              │                                │
│  │  Process     │              │                                │
│  └──────────────┘              │                                │
│         │                      │                                │
│         ▼                      │                                │
│  ┌──────────────┐              │                                │
│  │ PostgreSQL   │              │                                │
│  │  Database    │              │                                │
│  └──────────────┘              │                                │
│                                │                                │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### RSS Processing Service

#### Main Process (`main.ts`)
1. **RSS Feed Processing**:
   - Reads RSS feeds from configured sources
   - Filters articles (today-only, duplicate checking)
   - Creates processing jobs for new articles
   - Pushes jobs to Redis queue

#### Worker Process (`worker.ts`)
1. **RSS Job Processing**:
   - Pulls jobs from Redis queue
   - Fetches and extracts article content
   - Generates Vietnamese summaries and keywords
   - Saves processed articles to PostgreSQL
   - Sends formatted notifications to Discord

### AI Search Service

#### AI Search Application (`ai-search-app.ts`)
1. **AI Search Processing**:
   - Runs on independent schedule from RSS processing
   - Uses search-enabled AI models (Perplexity Sonar, etc.)
   - Searches for current news by category
   - Sends results directly to Discord (no queue/database dependency)

## Detailed Component Design

### RSS Processing Service

#### 1. Main Process (`src/main.ts`)

**Responsibilities:**
- **RSS feed parsing and monitoring**
- **RSS-only scheduling system** 
- Article deduplication
- Job queue management

**RSS Scheduling System:**
```typescript
// RSS Processing Schedule Only
startScheduling(config.scheduling.rss_processing, processFeeds, 'RSS processing');
```

**Key Features:**
- RSS-specific scheduling configuration
- Today-only filtering for RSS articles
- Pre-queue duplicate checking
- PostgreSQL-based deduplication

#### 2. Worker Process (`src/worker.ts`)

**Responsibilities:**
- Queue job processing (RSS articles only)
- Content extraction and cleaning
- AI integration and response processing
- Discord notification dispatch

**Processing Pipeline:**
```
RSS Job → Content Extraction → AI Processing → Database Storage → Discord Notification
```

### AI Search Service

#### 3. AI Search Application (`src/ai-search-app.ts`)

**Responsibilities:**
- **Independent AI search scheduling**
- **Category-based search execution**
- **Discord search notification management**

**AI Search Scheduling System:**
```typescript
// AI Search Schedule Only
startScheduling(config.scheduling.ai_search, processAISearch, 'AI search');
```

**Key Features:**
- Standalone operation (no database dependency)
- Independent scheduling from RSS processing
- Category-based search execution
- Enhanced Discord notifications

## Shared Services

### 4. AI Services

#### 4.1 AI Service (`src/services/ai.ts`) - RSS Summarization

**Enhanced Features:**
- **Customizable summary prompts** via configuration
- **Template variable replacement** (`{{content}}`)
- **Vietnamese-first design** maintained
- **Robust extraction** with multiple fallback strategies

**Configuration Integration:**
```typescript
const config = await loadConfig();
const summaryPrompt = config.ai_summarization?.summary_prompt || DEFAULT_SUMMARY_PROMPT;
const prompt = summaryPrompt.replace('{{content}}', content);
```

#### 4.2 AI Search Service (`src/services/ai-search.ts`) - News Search

**Enhanced Component Design:**
- **Search-enabled AI models** (Perplexity Sonar, OpenAI with search)
- **Separate API configuration** (different keys/endpoints)
- **Category-based prompting** 
- **Enhanced structured response parsing**
- **URL sanitization and validation**
- **Improved error handling**

**Enhanced Search Process:**
```typescript
const response = await searchClient.chat.completions.create({
  model: SEARCH_MODEL,
  messages: [
    { 
      role: 'system', 
      content: 'You are a news search assistant. Search for current, relevant news articles and provide structured results with clean titles, valid URLs, concise summaries, and accurate source names. Always provide complete URLs without any markdown formatting or brackets.'
    },
    { role: 'user', content: searchCategory.search_prompt }
  ]
});
```

**URL Cleaning Process:**
```typescript
function cleanUrl(url: string): string {
  // Remove markdown formatting, brackets, quotes
  let cleaned = url.replace(/[\[\]()"`]/g, '').trim();
  
  // Ensure proper URL format
  if (cleaned && !cleaned.match(/^https?:\/\//)) {
    if (cleaned.startsWith('www.') || cleaned.includes('.com')) {
      cleaned = `https://${cleaned}`;
    }
  }
  
  // Validate URL before returning
  try {
    new URL(cleaned);
    return cleaned;
  } catch {
    return '';
  }
}
```

### 5. Discord Services

#### 5.1 Discord Service (`src/services/discord.ts`) - RSS Notifications

**Unchanged Design:**
- Embed structure with title as hyperlink
- Clean summary in quotes without boilerplate
- Keywords field at bottom
- Vietnamese content throughout

#### 5.2 Discord Search Service (`src/services/discord-search.ts`) - Search Results

**Enhanced Component Design:**
- **Rich embed format** for multiple articles
- **Structured article listings** with sources and URLs
- **Category-specific webhooks** with fallback
- **Configurable webhook routing**
- **Date stamping** for all articles
- **Automatic keyword extraction**
- **URL sanitization** to prevent formatting issues

**Enhanced Embed Structure:**
```typescript
const embed = {
  title: `📰 Latest ${searchResult.category} News`,
  description: `Found ${searchResult.totalFound} recent articles (${currentDate})`,
  fields: searchResult.articles.map((article, index) => {
    const keywords = generateKeywords(article.title, article.summary);
    const cleanUrl = cleanUrl(article.url);
    
    return {
      name: `${index + 1}. ${article.title} (${currentDate})`,
      value: `${article.summary}
**Source:** ${article.source}
**Keywords:** ${keywords.join(', ')}
[Read more](${cleanUrl})`,
      inline: false
    };
  }),
  footer: {
    text: `AI News Search • ${searchResult.category} • ${currentDate}`
  }
};
```

**Keyword Extraction Algorithm:**
```typescript
function generateKeywords(title: string, summary: string): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  
  // Tech/AI keyword detection
  const techKeywords = ['artificial intelligence', 'ai', 'machine learning', ...];
  const foundKeywords = techKeywords.filter(keyword => text.includes(keyword));
  
  // Title-based keywords
  const titleWords = title.split(' ')
    .filter(word => word.length > 3)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .slice(0, 3);
  
  // Combine and return up to 5 keywords
  return [...foundKeywords, ...titleWords]
    .filter((keyword, index, arr) => arr.indexOf(keyword) === index)
    .slice(0, 5);
}
```

### 5. Database Layer (`src/services/db.ts`)

**Unchanged Design:**
- PostgreSQL with Knex.js ORM
- RSS articles stored for deduplication
- AI search results are ephemeral (not stored)

**Enhanced Usage:**
- Pre-queue duplicate checking in main process
- Today-only filtering integration
- Same schema, optimized access patterns

### 6. Configuration Management

#### Enhanced Configuration Structure (`config/config.yaml`)

```yaml
# Dual scheduling system
scheduling:
  rss_processing:
    mode: "interval"
    interval:
      minutes: 30
  ai_search:
    enabled: true
    mode: "interval" 
    interval:
      minutes: 120

# RSS summarization config
ai_summarization:
  enabled: true
  summary_prompt: |
    Custom Vietnamese prompt with {{content}} placeholder

# AI search categories
ai_search_categories:
  ai-news:
    enabled: true
    category: "Artificial Intelligence"
    search_prompt: |
      Search for the latest 10 AI news articles...
    discord_webhook: "category-specific-webhook"
```

#### Enhanced Environment Variables

```env
# RSS Summarization (existing)
OPENAI_API_KEY=your-summarization-key
OPENAI_BASE_URL=https://api.groq.com
OPENAI_TEXT_MODEL=mixtral-8x7b-32768

# AI Search (new)
OPENAI_API_KEY_SEARCH=your-search-key
OPENAI_BASE_URL_SEARCH=https://api.perplexity.ai
OPENAI_TEXT_MODEL_SEARCH=sonar-medium-online
```

## Enhanced Data Flow Patterns

### RSS Processing Flow (Existing)
```
RSS Feed → Today Filter → Duplicate Check → Redis Queue → Worker → AI Summarization → Database → Discord
```

### AI Search Flow (Enhanced)
```
Schedule Trigger → AI Search → URL Sanitization → Keyword Extraction → Enhanced Discord Embed
```

### Parallel Processing
- **RSS and AI Search run independently**
- **Different schedules and configurations**
- **No shared state or dependencies**
- **Isolated error handling**

## Error Handling Strategy

### Enhanced Error Isolation
1. **RSS Processing Failures**: Don't affect AI search
2. **AI Search Failures**: Don't affect RSS processing  
3. **Service-specific logging**: Separate log contexts
4. **Independent retry mechanisms**: Different retry strategies
5. **URL validation failures**: Graceful degradation with logging

### Enhanced Monitoring Points
- RSS queue depth monitoring
- AI search success rates by category
- RSS AI service response times  
- Search AI service response times
- **URL validation success rates**
- **Keyword extraction performance**
- Database connection health
- Discord webhook status (both services)

## Security Considerations (Enhanced)

### Dual API Key Management
- **Separate API keys** for different AI services
- **Independent rate limiting** and quotas
- **Service-specific security policies**

### Enhanced Configuration Security
- **Webhook URL protection** in configuration
- **Search prompt injection prevention**
- **Category-based access control**
- **URL validation** to prevent malicious links

## Performance Characteristics (Enhanced)

### RSS Processing (Existing)
- **RSS Processing**: ~100 feeds/minute
- **AI Summarization**: Limited by API rate limits
- **Database Operations**: ~1000 ops/second

### AI Search (Enhanced)
- **Search Processing**: ~10 categories/hour (configurable)
- **Search AI Calls**: Limited by search API rate limits
- **URL Processing**: ~500 URLs/second validation
- **Keyword Extraction**: ~1000 articles/second
- **Direct Discord Delivery**: ~50 embeds/minute

### Resource Usage (Updated)
- **Memory**: ~250MB per main process (increased for dual AI services)
- **CPU**: Higher usage for keyword extraction and URL processing
- **Network**: Higher bandwidth for search API calls and URL validation
- **Storage**: RSS articles only (search results not stored)

## Future Enhancements (Updated)

### Planned Features
1. **Advanced Keyword Extraction**: ML-based keyword detection
2. **Multi-language Search**: Support search in different languages
3. **Search Result Ranking**: AI-powered relevance scoring
4. **Hybrid Search**: Combine RSS and search results
5. **Real-time Search**: WebSocket-based live news updates
6. **URL Preview Generation**: Rich link previews for Discord

### Integration Improvements
1. **Unified Dashboard**: Monitor both RSS and search pipelines
2. **Cross-service Analytics**: Compare RSS vs search performance
3. **Intelligent Scheduling**: Adaptive timing based on news activity
4. **Content Correlation**: Link RSS articles with search results
5. **Enhanced URL Intelligence**: Domain reputation and content validation

## Deployment Architecture

### Docker Deployment (Recommended)

The system uses a single Docker image with service selection via environment variables:

```yaml
services:
  # RSS Main Process (Feed monitoring)
  newsrss-main:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: newsrss-rss-main
    environment:
      - SERVICE_NAME=RSS_MAIN
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/newsrss
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis

  # RSS Worker Process (Article processing)
  newsrss-worker:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: newsrss-rss-worker
    environment:
      - SERVICE_NAME=RSS_WORKER
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/newsrss
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 2  # Scale workers as needed

  # AI Search Service (Independent search)
  newsrss-ai-search:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: newsrss-ai-search
    environment:
      - SERVICE_NAME=AI_SEARCH
      - OPENAI_API_KEY_SEARCH=${OPENAI_API_KEY_SEARCH}
      - OPENAI_BASE_URL_SEARCH=${OPENAI_BASE_URL_SEARCH}

  # Infrastructure Services
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: newsrss
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
```

### Service Selection Script (`run-service.sh`)

The Docker image uses an entrypoint script to determine which service to run:

```bash
#!/bin/bash
set -e

case "$SERVICE_NAME" in
  RSS_MAIN)
    exec node dist/main.js
    ;;
  RSS_WORKER)
    exec node dist/worker.js
    ;;
  AI_SEARCH)
    exec node dist/ai-search-app.js
    ;;
  RSS_ALL)
    node dist/main.js &
    exec node dist/worker.js
    ;;
  *)
    echo "Unknown service: $SERVICE_NAME"
    exit 1
    ;;
esac
```

### Service Communication

- **Configuration Sharing**: Both services use mounted `config/` volume
- **Log Sharing**: Both services write to mounted `logs/` volume
- **Network Isolation**: Services communicate via Docker bridge network
- **Independent Scaling**: Each service can be scaled independently

### Environment Requirements

#### RSS Processing Service
- **Database Access**: PostgreSQL for article storage
- **Queue Access**: Redis for job management
- **AI API Access**: Summarization API (OpenAI, Groq, local)
- **Discord Webhooks**: RSS notification endpoints

#### AI Search Service
- **AI API Access**: Search-enabled API (Perplexity, OpenAI with search)
- **Discord Webhooks**: Search result notification endpoints
- **No Database Dependency**: Stateless operation

### Production Deployment

```bash
# Build and deploy all services
npm run docker:build
npm run docker:up

# Monitor services
npm run docker:logs
npm run docker:logs:rss
npm run docker:logs:ai-search

# Scale services independently
docker-compose up --scale newsrss-app=2
docker-compose up --scale newsrss-ai-search=1
```

### Manual Deployment

For manual deployment without Docker:

#### RSS Processing Service
```bash
# Terminal 1: Main Process
NODE_ENV=production node dist/main.js

# Terminal 2: Worker Process
NODE_ENV=production node dist/worker.js
```

#### AI Search Service
```bash
# Terminal 3: AI Search Process
NODE_ENV=production node dist/ai-search-app.js
```

### Monitoring & Health Checks

#### Service Health Checks
- **RSS Service**: Process health, database connectivity, queue status
- **AI Search Service**: Application health, API connectivity
- **Infrastructure**: PostgreSQL, Redis health monitoring

#### Docker Health Checks
```dockerfile
# RSS Service Health Check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "console.log('RSS Processing App Health Check OK')" || exit 1

# AI Search Service Health Check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "console.log('AI Search App Health Check OK')" || exit 1
```

### Scaling Considerations

#### RSS Processing Service Scaling
- **Horizontal Scaling**: Multiple worker containers
- **Database Scaling**: PostgreSQL read replicas
- **Queue Scaling**: Redis clustering
- **Resource Requirements**: Higher memory for content processing

#### AI Search Service Scaling
- **Independent Scaling**: No dependency on RSS service
- **Stateless Design**: Easy horizontal scaling
- **API Rate Limits**: Consider search API limitations
- **Resource Requirements**: Lower memory, network intensive

### Security Architecture

#### Container Security
- **Non-root User**: All containers run as unprivileged user
- **Minimal Images**: Alpine-based images for smaller attack surface
- **Network Segmentation**: Services isolated via Docker networks

#### API Security
- **Separate API Keys**: Independent credentials for each service
- **Environment Variables**: Secure credential management
- **Rate Limiting**: Built-in API rate limit handling

### Configuration Management

#### Shared Configuration
- **Volume Mounting**: `config/config.yaml` shared between services
- **Environment Variables**: Service-specific credentials
- **Runtime Configuration**: No container restart required for config changes

#### Service-Specific Settings
```yaml
# RSS Processing Service uses:
scheduling.rss_processing: { ... }
ai_summarization: { ... }
feeds: [ ... ]

# AI Search Service uses:
scheduling.ai_search: { ... }
ai_search_categories: { ... }
```

### Maintenance & Updates

#### Independent Updates
- **Service Isolation**: Update RSS or AI Search independently
- **Rolling Updates**: Zero-downtime deployments
- **Configuration Updates**: Hot-reload without service restart

#### Backup & Recovery
- **RSS Service**: Database backups, Redis persistence
- **AI Search Service**: Configuration backup only (stateless)
- **Shared Resources**: Configuration and logs backup 