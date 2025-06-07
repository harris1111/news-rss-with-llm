# NewsRSS

A self-hosted RSS feed processor that uses AI to summarize articles and send notifications. Features Vietnamese AI processing, clean Discord notifications, and AI-powered news search capabilities.

## Features

- **RSS feed monitoring and processing** - Traditional RSS feed processing
- **AI-powered article summarization** (Vietnamese language)
- **AI news search** - Search for current news using search-enabled AI models (Perplexity Sonar, etc.)
- **Dual scheduling system** - Separate schedules for RSS processing and AI search
- **Clean Discord notifications** with hyperlinked titles
- **Redis-based job queue** for scalability
- **PostgreSQL database** with Knex migrations
- **Configurable feed sources and search categories**
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

- Node.js 18+
- Redis server
- PostgreSQL server
- OpenAI-compatible API server (OpenAI, Groq, local inference server, etc.)
- **Search-enabled AI API** (Perplexity, OpenAI with web search, etc.) for AI search feature

## Environment Variables

Create a `.env` file in the root directory:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379

# PostgreSQL Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/newsrss?sslmode=disable

# OpenAI Configuration (for RSS summarization)
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.groq.com  # Or https://api.openai.com (without /v1)
OPENAI_TEXT_MODEL=mixtral-8x7b-32768  # Or gpt-3.5-turbo

# AI Search Configuration (for search feature)
OPENAI_API_KEY_SEARCH=your-search-api-key
OPENAI_BASE_URL_SEARCH=https://api.perplexity.ai  # Or other search-enabled API
OPENAI_TEXT_MODEL_SEARCH=sonar-medium-online  # Or other search model

# Discord Configuration
DISCORD_WEBHOOK_URL=your-webhook-url

# Optional: Set log level (production = clean logs, development = detailed)
NODE_ENV=production
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

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/newsrss.git
   cd newsrss
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Set up database:
   ```bash
   # Create PostgreSQL database
   createdb newsrss
   
   # Run migrations
   npm run migrate
   ```

5. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Create a `config/config.yaml` file with your feed sources and AI search categories:

```yaml
# Discord webhook configuration
discord:
  default_webhook_url: "your-default-webhook-url"
  categories:
    Technology: "your-tech-webhook-url"
    AI: "your-ai-webhook-url"

# Scheduling configuration - now supports two separate schedules
scheduling:
  # RSS feed processing (existing feature)
  rss_processing:
    mode: "interval"  # Options: "interval", "cron", "manual"
    interval:
      minutes: 30     # Run every 30 minutes
    timezone: "Asia/Ho_Chi_Minh"
  
  # AI search feature (new feature)
  ai_search:
    enabled: true
    mode: "interval"  # Options: "interval", "cron", "manual"
    interval:
      minutes: 120    # Run every 2 hours
    timezone: "Asia/Ho_Chi_Minh"

# AI configuration for RSS summarization
ai_summarization:
  enabled: true
  # Custom summary prompt - if not provided, uses default
  summary_prompt: |
    Tóm tắt bài báo sau bằng tiếng Việt trong 2-3 câu, sau đó liệt kê 5 từ khóa:

    Bài báo: {{content}}

    Trả lời theo định dạng:
    SUMMARY: [tóm tắt bằng tiếng Việt]
    KEYWORDS: [từ khóa 1], [từ khóa 2], [từ khóa 3], [từ khóa 4], [từ khóa 5]

# AI search categories configuration
ai_search_categories:
  ai-news:
    enabled: true
    category: "Artificial Intelligence"
    search_prompt: |
      Search for the latest 10 news articles about artificial intelligence, machine learning, AI research, and AI applications published today. 
      Focus on recent developments, breakthroughs, product launches, and industry news.
    discord_webhook: "your-ai-news-webhook-url"
  
  tech-news:
    enabled: true
    category: "Technology"
    search_prompt: |
      Search for the latest 10 technology news articles published today. 
      Include topics like software development, hardware releases, tech companies, cybersecurity, and digital innovations.
    discord_webhook: "your-tech-news-webhook-url"

# RSS feed configuration (existing feature)
feeds:
  - name: "VnExpress Technology"
    url: "https://vnexpress.net/rss/suc-khoe.rss"
    category: "Technology"
    css_selector: ".fck_detail"

  - name: "Tech News"
    url: "https://example.com/feed.xml"
    category: "Technology"
    css_selector: "article.content"
```

## Usage

### Running the Services

1. **Start the main process** (RSS monitoring + AI search):
   ```bash
   node dist/main.js
   ```

2. **Start the worker process** (AI processing):
   ```bash
   node dist/worker.js
   ```

### Logging Modes

**Production** (clean logs):
```bash
NODE_ENV=production node dist/worker.js
```

**Development** (detailed debugging):
```bash
NODE_ENV=development node dist/worker.js
```

## Scripts

```bash
# Development
npm run build          # Build TypeScript
npm run dev           # Development mode with hot reload
npm run lint          # Run ESLint

# Database
npm run migrate       # Run database migrations
npm run migrate:down  # Rollback migrations

# Production
npm start            # Start both main and worker processes
```

## Architecture

The application consists of several components:

- **Main Process**: Monitors RSS feeds, runs AI search, and creates jobs
- **Worker Process**: Processes RSS jobs, extracts content, and generates AI summaries
- **AI Search Service**: Uses search-enabled AI models to find current news
- **Redis Queue**: Manages job distribution between processes
- **PostgreSQL Database**: Stores processed articles and metadata
- **AI Service**: Vietnamese language processing with multiple fallback strategies
- **Discord Integration**: Sends clean, formatted notifications for both RSS and search results

## AI Processing

The system uses two types of AI processing:

### RSS Article Summarization
- **Vietnamese language prompts** for accurate local content
- **Customizable summary prompts** via configuration
- **Multiple extraction strategies** for reliable results
- **Fallback mechanisms** for error handling
- **Clean output filtering** to remove unwanted text

### AI News Search
- **Search-enabled AI models** (Perplexity Sonar, etc.)
- **Category-based search prompts** for targeted results
- **Structured response parsing** for clean Discord embeds
- **Real-time news discovery** without RSS feeds
- **Configurable search categories** and schedules
- **Enhanced formatting** with dates, keywords, and clean URLs
- **Intelligent keyword extraction** from article content
- **URL sanitization** to prevent formatting issues

## Error Handling

- **Graceful degradation**: System continues working even if AI fails
- **Vietnamese fallbacks**: Always returns Vietnamese content for RSS processing
- **Retry mechanisms**: Automatic retries for transient failures
- **Comprehensive logging**: Detailed error tracking and debugging
- **Service isolation**: RSS and AI search run independently
- **URL validation**: Prevents broken links in Discord notifications

## Deployment

For production deployment:

1. Set `NODE_ENV=production` for clean logs
2. Use process managers like PM2 or systemd
3. Set up Redis and PostgreSQL clusters for high availability
4. Configure reverse proxy (nginx) if needed
5. Set up monitoring and alerting
6. **Configure both AI services** with appropriate API keys

## Troubleshooting

**Common Issues:**

1. **AI returns English**: Check `OPENAI_BASE_URL` and model configuration
2. **Search not working**: Verify `OPENAI_API_KEY_SEARCH` and search model
3. **Broken URLs in Discord**: Check AI search response format and URL cleaning
4. **Missing keywords**: Enable debug logging to see keyword extraction
5. **Database errors**: Verify `DATABASE_URL` and run migrations
6. **Missing notifications**: Check Discord webhook URL and permissions
7. **Search results not parsed**: Check AI search response format

**Debug Mode:**
```bash
NODE_ENV=development node dist/worker.js
```

## License

MIT 

## Documentation
- [Architecture Documentation](docs/ARCHITECTURE.md) - Detailed system design and components
- [API Documentation](docs/API.md) - API endpoints and usage
- [Deployment Guide](docs/DEPLOYMENT.md) - Deployment instructions
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

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
│   ├── services/           # Core services
│   │   ├── ai.ts          # AI processing service (RSS summarization)
│   │   ├── ai-search.ts   # AI search service (news search)
│   │   ├── config.ts      # Configuration service
│   │   ├── content.ts     # Content extraction service
│   │   ├── db.ts          # Database service
│   │   ├── discord.ts     # Discord notification service (RSS)
│   │   ├── discord-search.ts # Discord service (search results)
│   │   ├── feed.ts        # RSS feed service
│   │   ├── notification.ts # Notification service
│   │   └── queue.ts       # Redis queue service
│   ├── logger.ts          # Logging utility
│   ├── main.ts           # Producer process (RSS + AI search)
│   └── worker.ts         # Worker process (RSS processing)
├── config/
│   └── config.yaml       # Application configuration
├── .env                  # Environment variables
├── package.json
└── tsconfig.json
```

## Services

### Core Services
- **AI Service** (`services/ai.ts`): Handles RSS article summarization and keyword extraction
- **AI Search Service** (`services/ai-search.ts`): Searches for current news using search-enabled AI models with enhanced formatting
- **Config Service** (`services/config.ts`): Manages application configuration
- **Content Service** (`services/content.ts`): Extracts article content from web pages
- **Database Service** (`services/db.ts`): Manages PostgreSQL database operations
- **Discord Service** (`services/discord.ts`): Handles Discord notifications for RSS articles
- **Discord Search Service** (`services/discord-search.ts`): Handles Discord notifications for AI search results with enhanced formatting
- **Feed Service** (`services/feed.ts`): Fetches and parses RSS feeds
- **Notification Service** (`services/notification.ts`): Manages notification delivery
- **Queue Service** (`services/queue.ts`): Handles Redis queue operations

### Processes
- **Producer** (`main.ts`): Fetches RSS feeds, runs AI search, and pushes jobs to queue
- **Worker** (`worker.ts`): Processes RSS jobs from queue and sends notifications 