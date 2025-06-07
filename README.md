# NewsRSS

A self-hosted RSS feed processor that uses AI to summarize articles and send notifications. Features Vietnamese AI processing and clean Discord notifications.

## Features

- RSS feed monitoring and processing
- AI-powered article summarization (Vietnamese language)
- Clean Discord notifications with hyperlinked titles
- Redis-based job queue for scalability
- PostgreSQL database with Knex migrations
- Configurable feed sources
- Environment-based logging (production/development)
- Robust error handling and fallbacks

## Notification Format

Notifications sent to Discord will look like this:

```
[Việt Nam - Estonia hợp tác về chuyển đổi số và kinh tế số] (clickable link)
"Trong chuyến thăm của Thủ tướng Phạm Minh Chính đến Estonia, Bộ Khoa học và Công nghệ Việt Nam đã ký bản ghi nhớ về hợp tác chuyển đổi số và kinh tế số với Bộ Tư pháp và Chuyển đổi số Estonia. Việc ký bản ghi nhớ mở ra triển vọng hợp tác song phương trong các lĩnh vực như phát triển hạ tầng số, ứng dụng công nghệ và đào tạo nguồn nhân lực chất lượng cao."
Keywords
Chuyển đổi số, Kinh tế số, Giáo dục, Khoa học và công nghệ, Hợp tác quốc tế
```

**Format Details:**
- **Title**: Blue clickable hyperlink to article
- **Summary**: Clean Vietnamese text in quotes (2-3 sentences)
- **Keywords**: Always shown with "Keywords" label, comma-separated
- **No boilerplate text** (no "Here is the analysis" etc.)

## Prerequisites

- Node.js 18+
- Redis server
- PostgreSQL server
- OpenAI-compatible API server (OpenAI, Groq, local inference server, etc.)

## Environment Variables

Create a `.env` file in the root directory:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379

# PostgreSQL Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/newsrss?sslmode=disable

# OpenAI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.groq.com  # Or https://api.openai.com (without /v1)
OPENAI_TEXT_MODEL=mixtral-8x7b-32768  # Or gpt-3.5-turbo

# Discord Configuration
DISCORD_WEBHOOK_URL=your-webhook-url

# Optional: Set log level (production = clean logs, development = detailed)
NODE_ENV=production
```

**API Provider Examples:**
- **OpenAI**: `OPENAI_BASE_URL=https://api.openai.com`
- **Groq**: `OPENAI_BASE_URL=https://api.groq.com`
- **Local Ollama**: `OPENAI_BASE_URL=http://localhost:11434`

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

Create a `config/config.yaml` file with your feed sources:

```yaml
feeds:
  - name: "VnExpress Technology"
    url: "https://vnexpress.net/rss/suc-khoe.rss"
    category: "technology"
    css_selector: ".fck_detail"

  - name: "Tech News"
    url: "https://example.com/feed.xml"
    category: "technology"
    css_selector: "article.content"

scheduling:
  mode: "interval"  # or "cron" or "manual"
  interval:
    minutes: 30
  # cron:
  #   expression: "0 */2 * * *"
  #   timezone: "Asia/Ho_Chi_Minh"
```

## Usage

### Running the Services

1. **Start the main process** (RSS monitoring):
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

- **Main Process**: Monitors RSS feeds and creates jobs
- **Worker Process**: Processes jobs, extracts content, and generates AI summaries
- **Redis Queue**: Manages job distribution between processes
- **PostgreSQL Database**: Stores processed articles and metadata
- **AI Service**: Vietnamese language processing with multiple fallback strategies
- **Discord Integration**: Sends clean, formatted notifications

## AI Processing

The system uses advanced AI processing with:
- **Vietnamese language prompts** for accurate local content
- **Multiple extraction strategies** for reliable results
- **Fallback mechanisms** for error handling
- **Clean output filtering** to remove unwanted text

## Error Handling

- **Graceful degradation**: System continues working even if AI fails
- **Vietnamese fallbacks**: Always returns Vietnamese content
- **Retry mechanisms**: Automatic retries for transient failures
- **Comprehensive logging**: Detailed error tracking and debugging

## Deployment

For production deployment:

1. Set `NODE_ENV=production` for clean logs
2. Use process managers like PM2 or systemd
3. Set up Redis and PostgreSQL clusters for high availability
4. Configure reverse proxy (nginx) if needed
5. Set up monitoring and alerting

## Troubleshooting

**Common Issues:**

1. **AI returns English**: Check `OPENAI_BASE_URL` and model configuration
2. **Blank keywords**: Enable debug logging to see AI response processing
3. **Database errors**: Verify `DATABASE_URL` and run migrations
4. **Missing notifications**: Check Discord webhook URL and permissions

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
│   │   ├── ai.ts          # AI processing service
│   │   ├── config.ts      # Configuration service
│   │   ├── content.ts     # Content extraction service
│   │   ├── db.ts          # Database service
│   │   ├── discord.ts     # Discord notification service
│   │   ├── feed.ts        # RSS feed service
│   │   ├── notification.ts # Notification service
│   │   └── queue.ts       # Redis queue service
│   ├── logger.ts          # Logging utility
│   ├── main.ts           # Producer process
│   └── worker.ts         # Worker process
├── config/
│   └── config.yaml       # Application configuration
├── .env                  # Environment variables
├── package.json
└── tsconfig.json
```

## Services

### Core Services
- **AI Service** (`services/ai.ts`): Handles article summarization and keyword extraction
- **Config Service** (`services/config.ts`): Manages application configuration
- **Content Service** (`services/content.ts`): Extracts article content from web pages
- **Database Service** (`services/db.ts`): Manages PostgreSQL database operations
- **Discord Service** (`services/discord.ts`): Handles Discord notifications
- **Feed Service** (`services/feed.ts`): Fetches and parses RSS feeds
- **Notification Service** (`services/notification.ts`): Manages notification delivery
- **Queue Service** (`services/queue.ts`): Handles Redis queue operations

### Processes
- **Producer** (`main.ts`): Fetches RSS feeds and pushes jobs to queue
- **Worker** (`worker.ts`): Processes jobs from queue and sends notifications 