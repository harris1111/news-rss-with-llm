import OpenAI from 'openai';
import { createServiceLogger } from '../utils/logger';
import { loadConfig } from './config';

const logger = createServiceLogger('ai-service');

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-3.5-turbo';
if (!MODEL) {
  throw new Error('OPENAI_TEXT_MODEL environment variable is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL 
    ? `${process.env.OPENAI_BASE_URL}/openai/v1`
    : 'https://api.openai.com/v1'
});

export interface AIResponse {
  summary: string;
  keywords: string[];
}

// Default prompts for different languages
const DEFAULT_PROMPTS = {
  vi: `Tóm tắt bài báo sau bằng tiếng Việt trong 2-3 câu, sau đó liệt kê 5 từ khóa:

Bài báo: {{content}}

Trả lời theo định dạng:
SUMMARY: [tóm tắt bằng tiếng Việt]
KEYWORDS: [từ khóa 1], [từ khóa 2], [từ khóa 3], [từ khóa 4], [từ khóa 5]`,

  en: `Summarize the following article in English in 2-3 sentences, then list 5 keywords:

Article: {{content}}

Respond in this format:
SUMMARY: [English summary]
KEYWORDS: [keyword 1], [keyword 2], [keyword 3], [keyword 4], [keyword 5]`
};

const SYSTEM_PROMPTS = {
  vi: 'Bạn là trợ lý AI. Luôn trả lời bằng tiếng Việt theo đúng định dạng yêu cầu.',
  en: 'You are an AI assistant. Always respond in English following the exact format requested.'
};

export async function summarizeAndExtract(
  content: string,
  title: string,
  language: 'vi' | 'en' = 'vi'
): Promise<AIResponse> {
  try {
    logger.debug('Starting AI processing', { title });
    
    // Load config to get custom summary prompt or use default for language
    const config = await loadConfig();
    const summaryPrompt = config.ai_summarization?.summary_prompt || DEFAULT_PROMPTS[language];
    
    // Replace template variable with actual content
    const prompt = summaryPrompt.replace('{{content}}', content);

    logger.debug('AI request details', {
      model: MODEL,
      promptLength: prompt.length,
      contentLength: content.length,
      language,
      usingCustomPrompt: !!config.ai_summarization?.summary_prompt
    });

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system' as const,
          content: SYSTEM_PROMPTS[language]
        },
        {
          role: 'user' as const,
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 300
    });

    const rawResult = response.choices[0]?.message?.content || '';
    
    logger.debug('Raw AI response received', { 
      responseLength: rawResult.length
    });
    
    // Much simpler extraction with multiple fallbacks
    let summary = '';
    let keywords: string[] = [];
    
    // Method 1: Look for SUMMARY: and KEYWORDS: format
    const summaryMatch = rawResult.match(/SUMMARY:\s*(.+?)(?=KEYWORDS:|$)/s);
    const keywordsMatch = rawResult.match(/KEYWORDS:\s*(.+?)$/s);
    
    if (summaryMatch && summaryMatch[1]) {
      summary = summaryMatch[1].trim().replace(/\n/g, ' ');
      logger.debug('Found summary using SUMMARY: pattern');
    }
    
    if (keywordsMatch && keywordsMatch[1]) {
      keywords = keywordsMatch[1]
        .split(',')
        .map(k => k.trim())
        .filter(k => k && k.length > 0);
      logger.debug('Found keywords using KEYWORDS: pattern', { keywordCount: keywords.length });
    }
    
    // Method 2: Fallback - look for language-appropriate text
    if (!summary || summary.length < 20) {
      const lines = rawResult.split('\n').map(l => l.trim()).filter(l => l);
      
      if (language === 'vi') {
        // Find longest Vietnamese sentence (contains Vietnamese characters)
        const vietnameseRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
        
        for (const line of lines) {
          if (vietnameseRegex.test(line) && line.length > 30) {
            summary = line;
            logger.debug('Found Vietnamese summary in fallback');
            break;
          }
        }
      } else {
        // Find longest English line
        for (const line of lines) {
          if (line.length > 30 && /^[a-zA-Z0-9\s.,!?-]+$/.test(line)) {
            summary = line;
            logger.debug('Found English summary in fallback');
            break;
          }
        }
      }
    }
    
    // Method 3: Create language-appropriate content if all else fails
    if (!summary || summary.length < 10) {
      if (language === 'vi') {
        summary = `Bài báo "${title}" đề cập đến các vấn đề quan trọng và cung cấp thông tin hữu ích cho người đọc.`;
        logger.debug('Using fallback Vietnamese summary');
      } else {
        summary = `Article "${title}" covers important topics and provides useful information for readers.`;
        logger.debug('Using fallback English summary');
      }
    }
    
    if (keywords.length === 0) {
      // Try to extract from any comma-separated text
      const commaLines = rawResult.split('\n').filter(line => line.includes(','));
      for (const line of commaLines) {
        const possibleKeywords = line
          .split(',')
          .map(k => k.trim())
          .filter(k => k && k.length > 1 && k.length < 30);
        
        if (possibleKeywords.length >= 2) {
          keywords = possibleKeywords.slice(0, 5);
          logger.debug('Found keywords in comma-separated line');
          break;
        }
      }
      
      // Final fallback: use title words
      if (keywords.length === 0) {
        keywords = title
          .split(' ')
          .filter(w => w.length > 3)
          .slice(0, 5);
        
        if (keywords.length === 0) {
          keywords = language === 'vi' ? ['Tin tức', 'Thông tin', 'Báo chí'] : ['News', 'Information', 'Article'];
        }
        logger.debug('Using fallback keywords from title');
      }
    }
    
    // Clean up the results
    summary = summary.replace(/^["']|["']$/g, '').trim();
    keywords = keywords.map(k => k.replace(/^["']|["']$/g, '').trim());
    
    const finalResult = {
      summary,
      keywords
    };
    
    logger.debug('AI processing completed', {
      title,
      language,
      summaryLength: summary.length,
      keywordCount: keywords.length
    });

    return finalResult;
  } catch (error) {
    logger.error('Error in AI processing', {
      error: error instanceof Error ? error.message : String(error),
      title,
      language
    });
    
    // Return language-appropriate fallback content
    return {
      summary: language === 'vi' 
        ? `Tóm tắt bài báo "${title}" không khả dụng do lỗi xử lý.`
        : `Summary for article "${title}" is not available due to processing error.`,
      keywords: language === 'vi' ? ['Tin tức', 'Thông tin', 'Báo chí'] : ['News', 'Information', 'Article']
    };
  }
} 