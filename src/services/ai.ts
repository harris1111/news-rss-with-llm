import OpenAI from 'openai';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('ai-service');

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-3.5-turbo';
if (!MODEL) {
  throw new Error('OPENAI_TEXT_MODEL environment variable is required');
}

// Configure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL 
    ? `${process.env.OPENAI_BASE_URL}/openai/v1`  // Append /openai/v1 for custom endpoints
    : 'https://api.openai.com/v1'  // Default to OpenAI's endpoint
});

export interface AIResponse {
  summary: string;
  keywords: string[];
}

export async function summarizeAndExtract(
  content: string,
  title: string
): Promise<AIResponse> {
  try {
    logger.debug('Starting AI processing', { title });
    
    const prompt = `Chỉ trả về đúng định dạng sau, không thêm bất kỳ dòng nào ngoài định dạng yêu cầu, không thêm nhãn, tiêu đề phụ, hoặc giải thích.\n{Tiêu đề}\n"{Tóm tắt ngắn gọn nội dung bài báo (2-3 câu)}"\nKeywords\nkw1, kw2, kw3, kw4, kw5\n\nTiêu đề: ${title}\nBài báo: ${content}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that helps summarize articles and extract keywords. Always return the requested format, without adding any extra lines outside the format, without adding labels, subheadings, or explanations. Respond in Vietnamese.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const result = response.choices[0]?.message?.content || '';
    // Robust extraction: Only use the required lines
    const lines = result.trim().split('\n').map(l => l.trim()).filter(l => l);
    // Find title (first non-empty, non-quoted line, not 'Keywords')
    const titleLine = lines.find(line => line && !line.startsWith('"') && line.toLowerCase() !== 'keywords');
    // Find summary (first quoted line)
    const summaryLine = lines.find(line => line.startsWith('"') && line.endsWith('"'));
    // Find keywords (line after 'Keywords', ignore all other lines)
    const keywordsIndex = lines.findIndex(line => line.toLowerCase() === 'keywords');
    const keywordsLine = keywordsIndex !== -1 && lines[keywordsIndex + 1] ? lines[keywordsIndex + 1] : '';
    const summary = summaryLine ? summaryLine.replace(/^"|"$/g, '').trim() : '';
    const keywords = keywordsLine.split(',').map(k => k.trim()).filter(k => k);

    logger.debug('AI processing completed', { 
      title: titleLine,
      summaryLength: summary.length,
      keywordCount: keywords.length 
    });

    return {
      summary,
      keywords
    };
  } catch (error) {
    logger.error('Error in AI processing:', {
      error: error instanceof Error ? error.message : String(error),
      title
    });
    throw error;
  }
} 