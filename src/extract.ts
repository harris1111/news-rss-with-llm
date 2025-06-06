import axios from 'axios';
import * as cheerio from 'cheerio';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export async function extractContent(url: string, selector: string): Promise<string> {
  try {
    logger.debug('Starting content extraction', { url, selector });
    
    // First try to get the article page
    logger.debug('Making HTTP request', { url });
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://vnexpress.net/',
      },
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      }
    });

    logger.debug('HTTP response received', { 
      url,
      status: response.status,
      content_length: response.data.length,
      content_type: response.headers['content-type']
    });

    if (response.data.includes('Access Denied') || response.data.includes('403 Forbidden')) {
      logger.error('Access denied by website', { url });
      throw new Error('Access denied by the website');
    }

    logger.debug('Parsing HTML content', { url });
    const $ = cheerio.load(response.data);
    
    // Try the main selector first
    let content = $(selector).text().trim();
    logger.debug('Content extraction attempt with main selector', { 
      url,
      selector,
      content_length: content.length,
      success: !!content
    });
    
    if (!content) {
      logger.debug('Main selector failed, trying alternatives', { url });
      // Try alternative selectors if the main selector fails
      const alternativeSelectors = [
        'article.content_detail',
        '.sidebar_1',
        '.content_detail',
        '.fck_detail',
        '.article-content',
        '.detail-content',
        '.detail__content',
        '.article__content'
      ];
      
      for (const altSelector of alternativeSelectors) {
        const altContent = $(altSelector).text().trim();
        if (altContent) {
          logger.debug('Found content with alternative selector', { 
            url,
            selector: altSelector,
            content_length: altContent.length
          });
          content = altContent;
          break;
        }
      }
    }
    
    if (!content) {
      logger.error('No content found with any selector', { url });
      return 'No content found';
    }

    logger.info('Content extraction successful', { 
      url,
      content_length: content.length
    });
    return content;
  } catch (error) {
    logger.error('Content extraction failed', { 
      url,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return 'Failed to extract content';
  }
} 