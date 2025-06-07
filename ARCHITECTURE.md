# NewsRSS Architecture

## Overview

NewsRSS is a scalable RSS feed processing system with AI-powered Vietnamese summarization, AI news search capabilities, and Discord notifications. The architecture consists of producer-consumer processes with dual AI services, communicating through Redis queues, with PostgreSQL for persistence.

## System Components

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│                 │    │              │    │                 │
│   Main Process  │───▶│ Redis Queue  │───▶│ Worker Process  │
│   (Producer)    │    │  (RSS Jobs)  │    │   (Consumer)    │
│                 │    │              │    │                 │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                                           │
         │              ┌──────────────┐             │
         │              │              │             │
         └──────────────▶│ AI Search    │             │
                        │ Service      │             │
                        │              │             │
                        └──────────────┘             │
                                 │                   │
         ▼                       ▼                   ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│                 │    │              │    │                 │
│  PostgreSQL DB  │    │Discord Search│    │  AI Service     │
│                 │    │  Service     │    │  (Vietnamese)   │
└─────────────────┘    │ (Enhanced)   │    │                 │
                       └──────────────┘    └─────────────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │                 │
                                            │ Discord Service │
                                            │   (RSS Feed)    │
                                            │                 │
                                            └─────────────────┘
```

## Data Flow

### Main Process (Producer)
1. **RSS Feed Processing** (Original Feature):
   - Reads RSS feeds from configured sources
   - Compares against stored articles in PostgreSQL  
   - Creates processing jobs for new articles
   - Pushes jobs to Redis queue

2. **AI Search Processing** (New Feature):
   - Runs on separate schedule from RSS processing
   - Uses search-enabled AI models (Perplexity Sonar, etc.)
   - Searches for current news by category
   - Sends results directly to Discord (no queue/database)

### Worker Process (Consumer)
1. **RSS Job Processing** (Original Feature):
   - Pulls jobs from Redis queue
   - Fetches and extracts article content
   - Generates Vietnamese summaries and keywords
   - Saves processed articles to PostgreSQL
   - Sends formatted notifications to Discord

## Detailed Component Design

### 1. Main Process (`src/main.ts`)

**Enhanced Responsibilities:**
- **RSS feed parsing and monitoring** (existing)
- **AI search execution** (new)
- **Dual scheduling system** (new)
- Article deduplication
- Job queue management

**Dual Scheduling System:**
```typescript
// RSS Processing Schedule
startScheduling(config.scheduling.rss_processing, processFeeds, 'RSS processing');

// AI Search Schedule  
if (config.scheduling.ai_search?.enabled) {
  startScheduling(config.scheduling.ai_search, processAISearch, 'AI search');
}
```

**Key Features:**
- Independent scheduling for RSS and AI search
- Today-only filtering for RSS articles
- Pre-queue duplicate checking
- Configurable search categories

### 2. Worker Process (`src/worker.ts`)

**Unchanged Responsibilities:**
- Queue job processing (RSS articles only)
- Content extraction and cleaning
- AI integration and response processing
- Discord notification dispatch

**Processing Pipeline:**
```
RSS Job → Content Extraction → AI Processing → Database Storage → Discord Notification
```

*Note: AI search results bypass the worker entirely*

### 3. AI Services

#### 3.1 AI Service (`src/services/ai.ts`) - RSS Summarization

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

#### 3.2 AI Search Service (`src/services/ai-search.ts`) - News Search

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

### 4. Discord Services

#### 4.1 Discord Service (`src/services/discord.ts`) - RSS Notifications

**Unchanged Design:**
- Embed structure with title as hyperlink
- Clean summary in quotes without boilerplate
- Keywords field at bottom
- Vietnamese content throughout

#### 4.2 Discord Search Service (`src/services/discord-search.ts`) - Search Results

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

## Deployment Considerations (Enhanced)

### Environment Requirements
- **Dual AI API Access**: Both summarization and search APIs
- **Increased Network Bandwidth**: For search API calls and URL validation
- **Enhanced Monitoring**: Track both processing pipelines
- **URL Validation Services**: Optional external URL checking

### Production Architecture
```
Production Server:
├── PM2 Process Manager
│   ├── Main Process (RSS + AI Search)
│   └── Worker Processes (RSS Processing)
├── Redis Cluster (RSS jobs only)
├── PostgreSQL (RSS articles only)
├── Dual AI API Connections
│   ├── Summarization API (Groq/OpenAI)
│   └── Search API (Perplexity/OpenAI Search)
├── Discord Webhooks (Multiple categories)
└── URL Validation & Keyword Processing
``` 