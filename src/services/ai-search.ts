import OpenAI from 'openai';
import { createServiceLogger } from '../utils/logger';
import { AISearchCategory } from './config';

const logger = createServiceLogger('ai-search-service');

// Validate environment variables for search functionality
if (!process.env.OPENAI_API_KEY_SEARCH) {
  throw new Error('OPENAI_API_KEY_SEARCH environment variable is required');
}

if (!process.env.OPENAI_TEXT_MODEL_SEARCH) {
  throw new Error('OPENAI_TEXT_MODEL_SEARCH environment variable is required');
}

const SEARCH_MODEL = process.env.OPENAI_TEXT_MODEL_SEARCH;
const SEARCH_BASE_URL = process.env.OPENAI_BASE_URL_SEARCH;

const searchClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY_SEARCH,
  baseURL: SEARCH_BASE_URL || 'https://api.perplexity.ai'
});

export interface SearchResult {
  category: string;
  articles: Array<{
    title: string;
    url?: string;
    summary: string;
    source?: string;
  }>;
  totalFound: number;
}

/**
 * Performs an AI-powered search for recent news articles in the specified category.
 *
 * Sends a structured prompt to the OpenAI API to retrieve up to 10 relevant news articles, each with a title, clean URL, summary, and source. Parses and returns the results in a consistent format, or returns `null` if no articles are found or an error occurs.
 *
 * @param searchCategory - The category and prompt details for the news search.
 * @returns A {@link SearchResult} object containing the category, up to 10 articles, and the total number found, or `null` if no articles are found or an error occurs.
 */
export async function searchNewsArticles(
  searchCategory: AISearchCategory
): Promise<SearchResult | null> {
  try {
    logger.info('Starting AI search for category', { 
      category: searchCategory.category 
    });
    
    const prompt = `${searchCategory.search_prompt}

Please format your response as a structured list with the following format for each article:

ARTICLE 1:
Title: [Article title here]
URL: [Full clean URL without brackets or markdown formatting]
Summary: [Brief summary in 1-2 sentences]
Source: [News source/publication name]

ARTICLE 2:
Title: [Article title here]
URL: [Full clean URL without brackets or markdown formatting]
Summary: [Brief summary in 1-2 sentences]
Source: [News source/publication name]

Continue this format for up to 10 articles. Make sure URLs are clean and complete (starting with https://). Focus on recent, relevant news from today if possible.`;

    logger.debug('Search request details', {
      model: SEARCH_MODEL,
      category: searchCategory.category,
      promptLength: prompt.length
    });

    const response = await searchClient.chat.completions.create({
      model: SEARCH_MODEL,
      messages: [
        {
          role: 'system' as const,
          content: 'You are a news search assistant. Search for current, relevant news articles and provide structured results with clean titles, valid URLs, concise summaries, and accurate source names. Always provide complete URLs without any markdown formatting or brackets.'
        },
        {
          role: 'user' as const,
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const rawResult = response.choices[0]?.message?.content || '';
    
    logger.debug('Raw search response received', { 
      responseLength: rawResult.length,
      category: searchCategory.category
    });

    // Parse the structured response
    const articles = parseSearchResponse(rawResult);
    
    if (articles.length === 0) {
      logger.warn('No articles parsed from search response', { 
        category: searchCategory.category 
      });
      return null;
    }

    const result: SearchResult = {
      category: searchCategory.category,
      articles: articles.slice(0, 10), // Limit to 10 articles
      totalFound: articles.length
    };

    logger.info('AI search completed', {
      category: searchCategory.category,
      articlesFound: result.articles.length
    });

    return result;
  } catch (error) {
    logger.error('Error in AI search', {
      error: error instanceof Error ? error.message : String(error),
      category: searchCategory.category
    });
    return null;
  }
}

/**
 * Parses a raw AI-generated response string into an array of structured news article objects.
 *
 * Attempts to extract articles by splitting the response on "ARTICLE" markers and parsing each section for title, URL, summary, and source fields. If no articles are found using this method, falls back to line-by-line parsing to recover article data.
 *
 * @param rawResponse - The raw text response from the AI model containing news article information.
 * @returns An array of article objects with title, summary, and optionally URL and source fields. Returns an empty array if no valid articles are found.
 */
function parseSearchResponse(rawResponse: string): Array<{
  title: string;
  url?: string;
  summary: string;
  source?: string;
}> {
  const articles = [];
  
  // Split by ARTICLE markers
  const articleSections = rawResponse.split(/ARTICLE\s+\d+:/i);
  
  // Skip the first element (text before first ARTICLE)
  for (let i = 1; i < articleSections.length; i++) {
    const section = articleSections[i].trim();
    const article = parseArticleSection(section);
    
    if (article.title && article.summary) {
      articles.push(article);
    }
  }

  // Fallback: if structured parsing fails, try line-by-line
  if (articles.length === 0) {
    const lines = rawResponse.split('\n').map(line => line.trim()).filter(line => line);
    let currentArticle: any = {};
    
    for (const line of lines) {
      if (line.toLowerCase().includes('title:')) {
        if (currentArticle.title && currentArticle.summary) {
          articles.push(currentArticle);
        }
        currentArticle = {};
        currentArticle.title = line.replace(/^title:\s*/i, '').trim();
      } else if (line.toLowerCase().includes('url:') && currentArticle.title) {
        let url = line.replace(/^url:\s*/i, '').trim();
        url = cleanUrl(url);
        if (url) {
          currentArticle.url = url;
        }
      } else if (line.toLowerCase().includes('summary:') && currentArticle.title) {
        currentArticle.summary = line.replace(/^summary:\s*/i, '').trim();
      } else if (line.toLowerCase().includes('source:') && currentArticle.title) {
        currentArticle.source = line.replace(/^source:\s*/i, '').trim();
      }
    }
    
    if (currentArticle.title && currentArticle.summary) {
      articles.push(currentArticle);
    }
  }

  return articles;
}

/**
 * Parses a single article section string into an article object with extracted fields.
 *
 * Extracts the title, summary, URL (cleaned and validated), and source from the provided section text.
 *
 * @param section - The raw text of an article section to parse.
 * @returns An object containing the parsed article fields.
 */
function parseArticleSection(section: string): {
  title: string;
  url?: string;
  summary: string;
  source?: string;
} {
  const lines = section.split('\n').map(line => line.trim()).filter(line => line);
  const article: any = {};

  for (const line of lines) {
    if (line.toLowerCase().startsWith('title:')) {
      article.title = line.replace(/^title:\s*/i, '').trim();
    } else if (line.toLowerCase().startsWith('url:')) {
      const url = line.replace(/^url:\s*/i, '').trim();
      const cleanedUrl = cleanUrl(url);
      if (cleanedUrl) {
        article.url = cleanedUrl;
      }
    } else if (line.toLowerCase().startsWith('summary:')) {
      article.summary = line.replace(/^summary:\s*/i, '').trim();
    } else if (line.toLowerCase().startsWith('source:')) {
      article.source = line.replace(/^source:\s*/i, '').trim();
    }
  }

  return article;
}

/**
 * Cleans and validates a URL string, removing formatting characters and ensuring it is a properly formatted HTTP or HTTPS URL.
 *
 * @param url - The input URL string to clean and validate.
 * @returns The cleaned and validated URL, or an empty string if invalid.
 */
function cleanUrl(url: string): string {
  if (!url) return '';
  
  // Remove any markdown formatting, brackets, quotes
  let cleaned = url.replace(/[\[\]()"`]/g, '').trim();
  
  // Remove any leading/trailing punctuation
  cleaned = cleaned.replace(/^[^\w]+|[^\w]+$/g, '');
  
  // Ensure it starts with http or https
  if (cleaned && !cleaned.match(/^https?:\/\//)) {
    if (cleaned.startsWith('www.') || cleaned.includes('.com') || cleaned.includes('.org') || cleaned.includes('.net')) {
      cleaned = `https://${cleaned}`;
    } else {
      // If it doesn't look like a URL, return empty
      return '';
    }
  }
  
  // Basic URL validation
  try {
    new URL(cleaned);
    return cleaned;
  } catch {
    return '';
  }
} 