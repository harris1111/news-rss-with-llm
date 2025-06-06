import OpenAI from "openai";
import { getOpenAIBaseUrl, getOpenAITextModel } from './config';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

function getContentPreview(content: string): { firstSentence: string; lastSentence: string } {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return {
    firstSentence: sentences[0]?.trim() || '',
    lastSentence: sentences[sentences.length - 1]?.trim() || ''
  };
}

export async function summarizeAndExtract(content: string, title: string): Promise<{ summary: string; keywords: string }> {
  try {
    if (!content || content === 'No content found' || content === 'Failed to extract content') {
      logger.error('Invalid content provided', { 
        title,
        content_length: content?.length,
        is_empty: !content,
        is_no_content: content === 'No content found',
        is_failed: content === 'Failed to extract content'
      });
      throw new Error('Invalid content provided');
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger.error('OpenAI API key not found in environment variables');
      throw new Error('OpenAI API key not found in environment variables');
    }

    const baseUrl = getOpenAIBaseUrl();
    const model = getOpenAITextModel();

    // Truncate content if it's too long (OpenAI has token limits)
    const maxContentLength = 4000; // Approximate token limit
    const truncatedContent = content.length > maxContentLength 
      ? content.substring(0, maxContentLength) + '...'
      : content;

    const prompt = `Summarize this news article in 3-5 sentences and extract 3-8 categories as an array. Summarize in Vietnamese. Categories should be in Vietnamese and on a single line. Do not include any prefixes like "Summary:" or "Categories:". Just provide the summary followed by the categories array.\n\nContent: ${truncatedContent}`;
    
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: `${baseUrl}/openai/v1`
    });

    logger.debug('Sending request to OpenAI', { 
      title,
      model,
      api_url: `${baseUrl}/openai/v1/chat/completions`
    });

    const response = await client.chat.completions.create({
      model: model,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that summarizes news articles and extracts categories. Provide only the answer. Do not include phrases like 'Here is the answer' or any other commentary. Format categories as a JSON array. Categories should be in Vietnamese and on a single line."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const text = response.choices[0].message.content as string;
    const [summary, categoriesText] = text.split(/\[|\]/);
    
    logger.info('AI processing successful', { 
      title,
      summary_length: summary?.length,
      categories_length: categoriesText?.length
    });

    return {
      summary: '\n' + (summary?.trim() || ''),
      keywords: categoriesText?.trim() || '',
    };
  } catch (error) {
    logger.error('Error in summarizeAndExtract', { 
      title,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      api_url: `${getOpenAIBaseUrl()}/openai/v1/chat/completions`,
      has_api_key: !!process.env.OPENAI_API_KEY,
      api_key_prefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 8) + '...' : undefined
    });
    throw error;
  }
} 