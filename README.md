# News RSS Processor

A Node.js application that processes RSS feeds, extracts content from articles, and uses AI to generate summaries and categories.

## Features

- RSS feed processing
- Content extraction from news articles
- AI-powered summarization in Vietnamese
- Category extraction as JSON array
- Rate limiting (30-60 seconds between requests)
- Comprehensive logging
- Error handling and retries

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Groq API key

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
OPENAI_API_KEY=your_groq_api_key
OPENAI_BASE_URL=https://api.groq.com
OPENAI_TEXT_MODEL=llama3-8b-8192
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create and configure your `.env` file
4. Start the application:
   ```bash
   npm start
   ```

## Processing Flow

1. RSS feed is fetched and parsed
2. For each article:
   - Content is extracted from the article URL
   - AI generates a summary in Vietnamese
   - Categories are extracted as a JSON array
   - Results are stored in the database
   - 30-60 second delay between requests to prevent rate limiting
3. Notifications are sent for new articles

## Output Format

The AI will generate:
- A summary in Vietnamese (3-5 sentences)
- Categories as a JSON array (3-8 categories)

Example output:
```
Thủ tướng Phạm Minh Chính đã có buổi gặp gỡ với các doanh nghiệp Estonia. Trong buổi gặp, Thủ tướng đã kêu gọi các doanh nghiệp tăng cường đầu tư và kết nối với Việt Nam. Ông cũng nhấn mạnh về tiềm năng phát triển của thị trường Việt Nam và cam kết tạo môi trường đầu tư thuận lợi.

["Kinh tế", "Đầu tư", "Quan hệ quốc tế", "Estonia", "Việt Nam"]
```

## Logging

The application uses Winston for logging with the following levels:
- debug: Detailed processing information
- info: Successful operations
- error: Error conditions

## Error Handling

- Automatic retries for failed requests
- Comprehensive error logging
- Graceful failure handling

## License

MIT 