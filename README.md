# NewsRSS

A self-hosted RSS feed processor that uses AI to summarize articles and send notifications.

## Features

- RSS feed monitoring and processing
- AI-powered article summarization
- Discord notifications (plain text, no embed)
- Redis-based job queue
- PostgreSQL database for article storage
- Configurable feed sources

## Notification Format

Notifications sent to Discord will look like this:

```
Được và mất khi thế giới chuyển sang năng lượng sạch
"Việc chuyển sang năng lượng sạch đang trở thành vấn đề quan trọng nhất hiện nay, tuy nhiên, còn một vấn đề rất phức tạp khác là chi phí. Chi phí của các công nghệ mới này có thể cao hơn hẳn so với các phương pháp nhiệt điện truyền thống. ĐỒ Ở ĐÂU LÀ GIÁ TRỊ THÀNH PHẨU CỦA NĂNG LƯỢNG SẠCH?"
Keywords
Tin tức, Năng lượng sạch, Chi phí
```

- **Title**: plain text, no hyperlink
- **Summary**: in quotes, immediately after the title
- **Keywords**: always shown, with the label `Keywords`, comma-separated
- **No introductory/boilerplate text**

## Prerequisites

- Node.js 18+
- Redis server
- PostgreSQL server
- OpenAI-compatible API server (e.g., OpenAI API, local inference server)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Redis Configuration
REDIS_URL=redis://localhost:6379

# PostgreSQL Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/newsrss?sslmode=disable

# OpenAI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com  # Or your local inference server URL (no /openai/v1)
OPENAI_TEXT_MODEL=gpt-3.5-turbo  # Or your preferred model

# Discord Configuration
DISCORD_WEBHOOK_URL=your-webhook-url
```

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

3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Create a `config/config.yaml` file with your feed sources:

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
  # cron:
  #   expression: "0 */2 * * *"
  #   timezone: "UTC"
```

## Usage

1. Start the main process:
   ```bash
   node dist/main.js
   ```

2. Start the worker process:
   ```bash
   node dist/worker.js
   ```

## Architecture

The application consists of several components:

- **Main Process**: Monitors RSS feeds and creates jobs
- **Worker Process**: Processes jobs and generates summaries
- **Redis Queue**: Manages job distribution
- **PostgreSQL Database**: Stores processed articles
- **Discord Integration**: Sends notifications (plain text)

## Development

- `npm run build`: Build the project
- `npm run dev`: Run in development mode with hot reload
- `npm run lint`: Run linter
- `npm run test`: Run tests

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