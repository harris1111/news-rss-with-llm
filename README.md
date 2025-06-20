# NewsRSS

A self-hosted RSS feed processor with AI-powered summarization, dual-language support, and AI news search capabilities. Built as a microservices architecture with advanced content scraping and multilingual AI processing.

## Architecture

NewsRSS uses a single Docker image with multiple service modes and advanced scraping capabilities:

1. **RSS Main Process** (`SERVICE_NAME=RSS_MAIN`): Monitors RSS feeds and creates processing jobs
2. **RSS Worker Process** (`SERVICE_NAME=RSS_WORKER`): Processes articles with Chrome/HTTP scraping and AI summarization  
3. **AI Search Service** (`SERVICE_NAME=AI_SEARCH`): Searches for current news using search-enabled AI models
4. **RSS All-in-One** (`SERVICE_NAME=RSS_ALL`): Runs both RSS main and worker in one container
5. **Chrome Browser Service**: Headless Chrome for advanced scraping and bot bypass

## Features

### Core Processing
- **RSS feed monitoring and processing** - Advanced RSS processing with intelligent content extraction
- **Dual-mode content scraping** - HTTP (fast) and Chrome (bot-bypassing) scraping modes
- **Multi-language AI summarization** - Support for Vietnamese and English content processing
- **AI news search** - Independent search service using search-enabled AI models (Perplexity Sonar, etc.)

### Advanced Capabilities  
- **Chrome-based scraping** - Real browser rendering to bypass bot detection and handle JavaScript
- **Language-aware AI processing** - Separate prompts, keywords, and fallbacks for Vietnamese and English
- **Intelligent content extraction** - CSS selectors with automatic fallbacks and content validation
- **Anti-bot protection handling** - Retry logic, browser headers, and Chrome fallback for protected sites

### Infrastructure
- **Single-image microservices** - One Docker image, multiple service modes via environment variables
- **Clean Discord notifications** with hyperlinked titles and rich formatting
- **Redis-based job queue** for RSS processing scalability
- **PostgreSQL database** for RSS article storage and deduplication
- **Chrome container integration** - Seamless integration with headless Chrome for advanced scraping
- **Environment-based logging** (production/development)
- **Robust error handling and fallbacks**

## Notification Format

### RSS Feed Notifications
Notifications sent to Discord will look like this:

```
[Việt Nam - Estonia hợp tác về chuyển đổi số và kinh tế số] (clickable link)
"Trong chuyến thăm của Thủ tướng Phạm Minh Chính đến Estonia, Bộ Khoa học và Công nghệ Việt Nam đã ký bản ghi nhớ về hợp tác chuyển đổi số và kinh tế số với Bộ Tư pháp và Chuyển đổi số Estonia. Việc ký bản ghi nhớ mở ra triển vọng hợp tác song phương trong các lĩnh vực như phát triển hạ tầng số, ứng dụng công nghệ và đào tạo nguồn nhân lực chất lượng cao."
Keywords
Chuyển đổi số, Kinh tế số, Giáo dục, Khoa học và công nghệ, Hợp tác quốc tế
```

### AI Search Notifications
AI search results are sent as Discord embeds with enhanced formatting:

```
📰 Latest Artificial Intelligence News
Found 8 recent articles (January 15, 2025)

1. OpenAI Announces GPT-5 with Enhanced Reasoning Capabilities (January 15, 2025)
OpenAI has unveiled GPT-5, featuring significant improvements in logical reasoning and mathematical problem-solving. The new model shows 40% better performance on complex reasoning tasks.
**Source:** TechCrunch
**Keywords:** AI, OpenAI, Machine Learning, Technology, Innovation
[Read more](https://techcrunch.com/2025/01/15/openai-gpt5-announcement)

2. Microsoft Integrates AI Assistant into Office Suite (January 15, 2025)
Microsoft announced the rollout of AI-powered features across Word, Excel, and PowerPoint, enabling users to generate content and automate repetitive tasks.
**Source:** The Verge
**Keywords:** Microsoft, AI, Office, Software, Automation
[Read more](https://theverge.com/microsoft-office-ai-integration)
```

**Enhanced Features:**
- **Clean URLs**: No broken formatting or double brackets
- **Date stamps**: Each article shows the search date
- **Automatic keywords**: Intelligent extraction of relevant tech/AI terms
- **Source attribution**: Clear news source identification
- **Rich formatting**: Professional Discord embed layout

## Prerequisites

- Node.js 24+
- Redis server (for RSS processing) - external or managed service
- PostgreSQL server (for RSS processing) - external or managed service  
- Docker & Docker Compose (recommended)
- OpenAI-compatible API server (OpenAI, Groq, local inference server, etc.)
- **Search-enabled AI API** (Perplexity, OpenAI with web search, etc.) for AI search service

## Environment Variables

Create a `.env` file in the root directory:

```env
# Application Environment
NODE_ENV=production

# Redis Configuration (RSS Service) - External/Managed Service
REDIS_URL=redis://your-redis-host:6379

# PostgreSQL Configuration (RSS Service) - External/Managed Service  
DATABASE_URL=postgresql://username:password@your-postgres-host:5432/newsrss?sslmode=disable

# RSS Summarization AI Configuration
OPENAI_API_KEY=your-summarization-api-key
OPENAI_BASE_URL=https://api.groq.com  # Or https://api.openai.com (without /v1)
OPENAI_TEXT_MODEL=mixtral-8x7b-32768  # Or gpt-3.5-turbo

# AI Search Configuration (AI Search Service)
OPENAI_API_KEY_SEARCH=your-search-api-key
OPENAI_BASE_URL_SEARCH=https://api.perplexity.ai  # Or other search-enabled API
OPENAI_TEXT_MODEL_SEARCH=sonar-medium-online  # Or other search model
```

**API Provider Examples:**
- **RSS Summarization**: 
  - OpenAI: `OPENAI_BASE_URL=https://api.openai.com`
  - Groq: `OPENAI_BASE_URL=https://api.groq.com`
  - Local Ollama: `OPENAI_BASE_URL=http://localhost:11434`

- **AI Search**:
  - Perplexity: `OPENAI_BASE_URL_SEARCH=https://api.perplexity.ai`
  - OpenAI with search: `OPENAI_BASE_URL_SEARCH=https://api.openai.com`

## Installation

### Option 1: Docker Deployment (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/newsrss.git
   cd newsrss
   ```

2. Set up configuration:
   ```bash
   cp config/config.example.yaml config/config.yaml
   # Edit config.yaml with your settings
   ```

3. Set up environment variables:
   ```bash
   # Create .env file with your external database/Redis connections
   # and API keys (see Environment Variables section above)
   ```

4. Build and run with Docker:
   ```bash
   npm run docker:build
   npm run docker:up
   ```

**Included Services:**
- **RSS Main Process**: Feed monitoring and job creation
- **RSS Worker Process**: Article processing with AI summarization (scalable to 2 replicas)
- **AI Search Service**: Independent AI news search
- **Chrome Browser**: Headless Chrome for advanced scraping and bot bypass

**Note**: You'll need external Redis and PostgreSQL services. The Docker Compose runs the application services and Chrome container.

### Option 2: Manual Installation

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/yourusername/newsrss.git
   cd newsrss
   npm install
   ```

2. Set up configuration:
   ```bash
   cp config/config.example.yaml config/config.yaml
   # Edit config.yaml with your settings
   ```

3. Set up external services and database:
   ```bash
   # Set up external PostgreSQL and Redis services
   # Update .env file with connection strings
   
   # Run migrations on your PostgreSQL database
   npm run migrate
   ```

4. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Create a `config/config.yaml` file with your feed sources, scraping modes, and AI search categories:

```yaml
# Discord webhook configuration
discord:
  default_webhook_url: "your-default-webhook-url"
  categories:
    Technology: "your-tech-webhook-url"
    Security: "your-security-webhook-url"
    AI: "your-ai-webhook-url"

# RSS processing configuration
rss_processing:
  enabled: true                    # Enable/disable RSS processing entirely
  today_only: true                 # Only process articles from today (skip older articles)
  max_articles_per_feed: 50        # Maximum number of articles to process per RSS feed (0 or null = no limit)
  chrome_url: "http://chrome:9222" # Chrome container URL for Chrome-based scraping

# Scheduling configuration - separate schedules for each service
scheduling:
  # RSS feed processing service
  rss_processing:
    mode: "interval"  # Options: "interval", "cron", "manual"
    interval:
      minutes: 30     # Run every 30 minutes
    timezone: "Asia/Ho_Chi_Minh"
  
  # AI search service
  ai_search:
    enabled: true
    mode: "interval"  # Options: "interval", "cron", "manual"
    interval:
      minutes: 120    # Run every 2 hours
    timezone: "Asia/Ho_Chi_Minh"

# AI configuration for RSS summarization (supports custom prompts)
ai_summarization:
  enabled: true
  # Optional: Custom summary prompt (uses language-specific defaults if not provided)
  # summary_prompt: |
  #   Tóm tắt bài báo sau bằng tiếng Việt trong 2-3 câu, sau đó liệt kê 5 từ khóa:
  #   Bài báo: {{content}}
  #   Trả lời theo định dạng:
  #   SUMMARY: [tóm tắt bằng tiếng Việt]
  #   KEYWORDS: [từ khóa 1], [từ khóa 2], [từ khóa 3], [từ khóa 4], [từ khóa 5]

# AI search categories configuration
ai_search_categories:
  ai-news:
    enabled: true
    category: "Artificial Intelligence"
    search_prompt: |
      Search for the latest 10 news articles about artificial intelligence, machine learning, AI research, and AI applications published today.
    discord_webhook: "your-ai-news-webhook-url"

# RSS feed configuration with scraping modes and languages
feeds:
  # Vietnamese content with HTTP scraping
  - name: "VnExpress Technology"
    url: "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss"
    category: "Technology"
    css_selector: ".fck_detail"
    scraping_mode: 1  # HTTP scraping (fast)
    language: "vi"    # Vietnamese AI summarization
  
  # English content with Chrome scraping (for bot-protected sites)
  - name: "Cybersecurity Dive"
    url: "https://www.cybersecuritydive.com/feeds/news/"
    category: "Security"
    css_selector: ".main-content"
    scraping_mode: 2  # Chrome scraping (bypasses bot detection)
    language: "en"    # English AI summarization
```

### RSS Processing Options

Configure RSS processing behavior with these options:

```yaml
rss_processing:
  enabled: true           # Enable/disable RSS processing entirely
  today_only: true        # Only process articles from today (skip older articles)  
  max_articles_per_feed: 50  # Maximum number of articles to process per RSS feed (0 or null = no limit)
  chrome_url: "http://chrome:9222"  # Chrome container URL for Chrome-based scraping
```

**Configuration Details:**

- **`enabled`**: Set to `false` to completely disable RSS processing while keeping the AI search service active
- **`today_only`**: When `true`, only articles published today will be processed (helps reduce noise from old articles when starting)
- **`max_articles_per_feed`**: Limits the number of articles processed per RSS feed per run (useful for high-volume feeds)
  - Set to `0`, `null`, or omit for no limit
  - Helps control processing time and resource usage
  - Articles are processed in the order they appear in the RSS feed (usually newest first)
- **`chrome_url`**: URL for the Chrome container used for advanced scraping (when `scraping_mode: 2`)

### Content Scraping Modes

The system supports two scraping modes for extracting article content:

**Mode 1: HTTP Scraping (Default)**
- Uses traditional HTTP requests with browser-like headers
- Fast and lightweight
- Works for most websites
- May be blocked by sites with strict bot protection

**Mode 2: Chrome Scraping**
- Uses a real Chrome browser via remote debugging protocol
- Bypasses most bot detection systems
- Handles JavaScript-rendered content
- Slower but more reliable for protected sites

Configure scraping mode and language per RSS feed:

```yaml
feeds:
  - name: "Vietnamese News"
    url: "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss"
    category: "Technology"
    css_selector: ".fck_detail"
    scraping_mode: 1  # 1 = HTTP (default), 2 = Chrome
    language: "vi"    # Vietnamese AI summarization
    
  - name: "English News"
    url: "https://example.com/rss.xml"
    category: "Technology"
    css_selector: ".article-content"
    scraping_mode: 2  # Chrome for bot-protected sites
    language: "en"    # English AI summarization
```

### Language Support

The system supports both Vietnamese and English AI summarization:

**Supported Languages:**
- **`vi`** (Vietnamese) - Default language, uses Vietnamese prompts and keywords
- **`en`** (English) - Uses English prompts and keywords

**Language Configuration:**
```yaml
feeds:
  - name: "Vietnamese Feed"
    language: "vi"  # Vietnamese summarization
  - name: "English Feed"  
    language: "en"  # English summarization
```

**Language Features:**
- **Language-specific prompts**: Different AI prompts for Vietnamese and English
- **Appropriate fallback content**: Error messages in the correct language
- **Smart keyword extraction**: Language-appropriate keywords and fallbacks
- **Automatic defaults**: Defaults to Vietnamese if not specified

### Complete Feed Configuration Options

Each RSS feed supports the following configuration options:

```yaml
feeds:
  - name: "Feed Name"                    # Required: Display name for the feed
    url: "https://example.com/rss.xml"   # Required: RSS feed URL
    category: "Technology"               # Required: Discord category (matches webhook categories)
    css_selector: ".article-content"     # Optional: CSS selector for content extraction
    scraping_mode: 2                     # Optional: 1=HTTP (default), 2=Chrome
    language: "en"                       # Optional: "vi"=Vietnamese (default), "en"=English
```

**When to use Chrome scraping:**
- Site returns 403 Forbidden errors
- Content is JavaScript-rendered
- Site has advanced bot detection
- HTTP scraping consistently fails

**Chrome Scraping Features:**
- **Real browser rendering**: Executes JavaScript and loads dynamic content
- **Bot detection bypass**: Uses actual Chrome browser to avoid detection
- **CSS selector support**: Same selector syntax as HTTP mode
- **Automatic fallback**: Falls back to default selectors if specified selector fails
- **Resource cleanup**: Properly closes browser tabs after scraping
- **Connection pooling**: Reuses Chrome instance for efficiency

### Content Processing Pipeline

The system uses an intelligent content processing pipeline:

1. **RSS Feed Parsing**: Extracts articles with CDATA and HTML content
2. **Today Filtering**: Optionally filters articles to current day only
3. **Duplicate Detection**: Pre-queue checking to avoid reprocessing
4. **Content Extraction**: 
   - **HTTP Mode**: Fast requests with browser headers and retry logic
   - **Chrome Mode**: Real browser rendering for protected sites
5. **AI Summarization**: Language-aware prompts and processing
6. **Discord Notification**: Rich embeds with proper formatting
7. **Database Storage**: Article storage for deduplication

### Advanced Configuration

**Processing Control:**
```yaml
rss_processing:
  enabled: true                    # Master enable/disable switch
  today_only: false                # Process all articles vs today only
  max_articles_per_feed: 50        # Limit articles per feed per run
  chrome_url: "http://chrome:9222" # Chrome container endpoint
```

**AI Customization:**
```yaml
ai_summarization:
  enabled: true
  summary_prompt: |               # Optional: Override default prompts
    Custom prompt with {{content}} placeholder
```

**Example Use Cases:**
- **Initial setup**: Set `today_only: true` and `max_articles_per_feed: 10` to avoid processing thousands of old articles
- **High-volume feeds**: Use `max_articles_per_feed: 20` to limit processing time
- **Maintenance mode**: Set `enabled: false` to disable RSS processing while keeping AI search active
- **Historical processing**: Set `today_only: false` to process all articles (useful for catching up after downtime)
- **Bot-protected sites**: Use `scraping_mode: 2` for sites that block HTTP requests

## Usage

### Docker Deployment (Recommended)

**Start all services:**
```bash
npm run docker:up
```

**View logs:**
```bash
# All services
npm run docker:logs

# RSS processing service only
npm run docker:logs:rss

# AI search service only
npm run docker:logs:ai-search
```

**Stop services:**
```bash
npm run docker:down
```

### Manual Deployment

**Start all services:**
```bash
npm run start:all
```

**Start individual services:**
```bash
# RSS main process (feed monitoring)
npm run start:rss-main

# RSS worker process (article processing)
npm run start:rss-worker

# AI search service
npm run start:ai-search

# RSS all-in-one (main + worker)
npm run start:rss-all
```

**Development mode:**
```bash
# All services in development mode
npm run dev:all

# Individual services
npm run dev:rss-main    # RSS main process only
npm run dev:rss-worker  # RSS worker process only
npm run dev:ai-search   # AI search service only
npm run dev:rss-all     # RSS main + worker
```

### Logging Modes

**Production** (clean logs):
```bash
NODE_ENV=production npm run start:all
```

**Development** (detailed debugging):
```bash
NODE_ENV=development npm run dev:all
```

## Scripts

```bash
# Building
npm run build          # Build TypeScript

# Running Services
npm run start:all       # Start all services
npm run start:rss-main  # Start RSS main process only
npm run start:rss-worker # Start RSS worker process only
npm run start:ai-search # Start AI search service only
npm run start:rss-all   # Start RSS main + worker

# Development
npm run dev:all         # Development mode - all services
npm run dev:rss-main    # Development mode - RSS main only
npm run dev:rss-worker  # Development mode - RSS worker only
npm run dev:ai-search   # Development mode - AI search only
npm run dev:rss-all     # Development mode - RSS main + worker

# Docker
npm run docker:build   # Build Docker container (single image)
npm run docker:up      # Start all containers
npm run docker:down    # Stop all containers
npm run docker:logs    # View all logs
npm run docker:logs:main # View RSS main process logs
npm run docker:logs:worker # View RSS worker process logs
npm run docker:logs:ai-search # View AI search service logs
npm run docker:logs:rss # View both RSS processes logs

# Database
npm run migrate        # Run database migrations
npm run migrate:rollback # Rollback migrations

# Development Tools
npm run lint           # Run ESLint
```

## Architecture

The application consists of several independent components:

### RSS Processing Service
- **Main Process** (`main.ts`): RSS feed monitoring and job creation
- **Worker Process** (`worker.ts`): Article processing and summarization
- **Database Service** (`db.ts`): PostgreSQL operations
- **Queue Service** (`queue.ts`): Redis job management
- **AI Service** (`ai.ts`): Vietnamese summarization
- **Discord Service** (`discord.ts`): RSS notifications

### AI Search Service
- **Search Application** (`ai-search-app.ts`): Standalone search processor
- **AI Search Service** (`ai-search.ts`): Search-enabled AI integration
- **Discord Search Service** (`discord-search.ts`): Rich search notifications

### Shared Services
- **Configuration Service** (`config.ts`): YAML configuration management
- **Logging Utility** (`logger.ts`): Structured logging across services

## AI Processing

The system uses two types of AI processing across separate services:

### RSS Article Summarization (RSS Service)
- **Vietnamese language prompts** for accurate local content
- **Customizable summary prompts** via configuration
- **Multiple extraction strategies** for reliable results
- **Intelligent fallback mechanisms** for error handling
  - **Web scraping with retry logic** (3 attempts with exponential backoff)
  - **RSS content fallback** when scraping fails (handles CDATA, HTML cleaning)
  - **RSS description fallback** for additional content sources
  - **Content length prioritization** to use the most substantial content available
- **Clean output filtering** to remove unwanted text
- **Anti-bot protection handling** for sites like The Hacker News

### AI News Search (AI Search Service)
- **Search-enabled AI models** (Perplexity Sonar, etc.)
- **Category-based search prompts** for targeted results
- **Structured response parsing** for clean Discord embeds
- **Real-time news discovery** without RSS feeds
- **Enhanced formatting** with dates, keywords, and clean URLs
- **Intelligent keyword extraction** from article content
- **URL sanitization** to prevent formatting issues

## Deployment

### Docker Deployment (Recommended)

The application is designed for Docker deployment with:

1. **Multi-service architecture** with independent containers
2. **Shared configuration** via mounted volumes
3. **Service dependencies** properly configured
4. **Health checks** for all services
5. **Automatic restarts** on failure

**Production deployment:**
```bash
# Build and deploy all services
npm run docker:build
npm run docker:up

# Monitor services
npm run docker:logs
```

### Manual Deployment

For manual deployment:

1. Set `NODE_ENV=production` for clean logs
2. Use process managers like PM2 or systemd for each service
3. Set up Redis and PostgreSQL servers
4. Configure reverse proxy (nginx) if needed
5. Set up monitoring and alerting
6. **Configure both AI services** with appropriate API keys

## Troubleshooting

**Common Issues:**

1. **RSS AI returns English**: Check `OPENAI_BASE_URL` and model configuration
2. **AI Search not working**: Verify `OPENAI_API_KEY_SEARCH` and search model
3. **Broken URLs in Discord**: Check AI search response format and URL cleaning
4. **Missing keywords**: Enable debug logging to see keyword extraction
5. **Database connection errors**: Verify PostgreSQL configuration and migrations
6. **Redis connection errors**: Check Redis server status and connection string
7. **Missing notifications**: Check Discord webhook URLs and permissions
8. **Service startup issues**: Check Docker logs and environment variables

**Debug Mode:**
```bash
NODE_ENV=development npm run dev:all
```

**Docker Debugging:**
```bash
# Check service status
docker-compose ps

# View specific service logs
npm run docker:logs:rss
npm run docker:logs:ai-search

# Restart specific service
docker-compose restart newsrss-app
docker-compose restart newsrss-ai-search
```

## Monitoring

### Service Health Checks

Both services include health checks:
- **RSS Service**: Main + Worker process monitoring
- **AI Search Service**: Independent health verification
- **Database Services**: PostgreSQL and Redis health checks

### Logging

Each service maintains separate logs:
- **RSS Processing**: `newsrss-rss-processor` container
- **AI Search**: `newsrss-ai-search` container
- **Shared Configuration**: Both services use same config volume

## License

MIT 

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Project Structure
```
.
├── src/
│   ├── services/           # Shared services
│   │   ├── ai.ts          # RSS AI summarization service
│   │   ├── ai-search.ts   # AI search service
│   │   ├── config.ts      # Shared configuration service
│   │   ├── content.ts     # Content extraction service
│   │   ├── db.ts          # Database service (RSS only)
│   │   ├── discord.ts     # Discord service (RSS)
│   │   ├── discord-search.ts # Discord service (search results)
│   │   ├── feed.ts        # RSS feed service
│   │   ├── notification.ts # Notification service
│   │   └── queue.ts       # Redis queue service (RSS only)
│   ├── utils/
│   │   └── logger.ts      # Shared logging utility
│   ├── main.ts           # RSS processing application
│   ├── worker.ts         # RSS worker process
│   └── ai-search-app.ts  # AI search application
├── config/
│   ├── config.yaml       # Application configuration
│   └── config.example.yaml # Configuration template
├── docker-compose.yml    # Multi-service Docker orchestration
├── Dockerfile            # RSS service container
├── Dockerfile.ai-search  # AI search service container
├── .env                  # Environment variables
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## Services

### RSS Processing Service
- **Main Process** (`main.ts`): RSS feed monitoring and job creation
- **Worker Process** (`worker.ts`): Article processing and summarization
- **Database Service** (`db.ts`): PostgreSQL operations
- **Queue Service** (`queue.ts`): Redis job management
- **AI Service** (`ai.ts`): Vietnamese summarization
- **Discord Service** (`discord.ts`): RSS notifications

### AI Search Service
- **Search Application** (`ai-search-app.ts`): Standalone search processor
- **AI Search Service** (`ai-search.ts`): Search-enabled AI integration
- **Discord Search Service** (`discord-search.ts`): Rich search notifications

### Shared Services
- **Configuration Service** (`config.ts`): YAML configuration management
- **Logging Utility** (`logger.ts`): Structured logging across services 