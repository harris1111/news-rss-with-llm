import { createServiceLogger } from '../utils/logger';
import { SearchResult } from './ai-search';
import { loadConfig } from './config';

const logger = createServiceLogger('discord-search-service');

export async function sendSearchResultsToDiscord(
  searchResult: SearchResult,
  webhookUrl?: string
): Promise<void> {
  try {
    if (!webhookUrl) {
      logger.debug('No webhook URL provided, skipping Discord notification', {
        category: searchResult.category
      });
      return;
    }

    logger.info('Sending search results to Discord', {
      category: searchResult.category,
      articleCount: searchResult.articles.length,
      webhookUrl: webhookUrl.substring(0, 50) + '...'
    });

    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create Discord embed
    const embed = {
      title: `📰 Latest ${searchResult.category} News`,
      description: `Found ${searchResult.totalFound} recent articles (${currentDate})`,
      color: 0x00AE86, // Teal color
      timestamp: new Date().toISOString(),
      fields: searchResult.articles.slice(0, 10).map((article, index) => {
        // Clean up the URL - remove any extra brackets or formatting
        let cleanUrl = '';
        if (article.url) {
          // Remove any markdown formatting and extra brackets
          cleanUrl = article.url.replace(/^\[|\]$|\(|\)/g, '').trim();
          // Ensure it starts with http
          if (!cleanUrl.startsWith('http')) {
            cleanUrl = `https://${cleanUrl}`;
          }
        }

        // Format the article entry
        let articleValue = `${article.summary}`;
        
        if (article.source) {
          articleValue += `\n**Source:** ${article.source}`;
        }
        
        // Add keywords if available (extract from summary or generate basic ones)
        const keywords = generateKeywords(article.title, article.summary);
        if (keywords.length > 0) {
          articleValue += `\n**Keywords:** ${keywords.join(', ')}`;
        }
        
        if (cleanUrl) {
          articleValue += `\n[Read more](${cleanUrl})`;
        }

        return {
          name: `${index + 1}. ${article.title} (${currentDate})`,
          value: articleValue,
          inline: false
        };
      }),
      footer: {
        text: `AI News Search • ${searchResult.category} • ${currentDate}`
      }
    };

    // Discord webhook payload
    const payload = {
      username: 'AI News Search Bot',
      embeds: [embed]
    };

    // Send to Discord
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    logger.info('Search results sent to Discord successfully', {
      category: searchResult.category,
      articleCount: searchResult.articles.length
    });
  } catch (error) {
    logger.error('Error sending search results to Discord', {
      error: error instanceof Error ? error.message : String(error),
      category: searchResult.category,
      webhookUrl: webhookUrl?.substring(0, 50) + '...'
    });
    throw error;
  }
}

function generateKeywords(title: string, summary: string): string[] {
  // Combine title and summary for keyword extraction
  const text = `${title} ${summary}`.toLowerCase();
  
  // Common tech/AI keywords to look for
  const techKeywords = [
    'artificial intelligence', 'ai', 'machine learning', 'ml', 'deep learning',
    'neural network', 'chatgpt', 'openai', 'google', 'microsoft', 'amazon',
    'meta', 'facebook', 'apple', 'tesla', 'nvidia', 'data', 'algorithm',
    'automation', 'robot', 'technology', 'tech', 'software', 'hardware',
    'cybersecurity', 'security', 'privacy', 'blockchain', 'cryptocurrency',
    'startup', 'investment', 'funding', 'ipo', 'merger', 'acquisition',
    'cloud computing', 'quantum', 'virtual reality', 'vr', 'augmented reality', 'ar',
    'smartphone', 'app', 'platform', 'breakthrough', 'innovation', 'research'
  ];
  
  // Find matching keywords
  const foundKeywords: string[] = [];
  
  for (const keyword of techKeywords) {
    if (text.includes(keyword) && !foundKeywords.includes(keyword)) {
      foundKeywords.push(keyword);
    }
  }
  
  // Extract additional keywords from title (capitalize first letter)
  const titleWords = title.split(' ')
    .filter(word => word.length > 3)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .slice(0, 3);
  
  // Combine and deduplicate
  const allKeywords = [...foundKeywords, ...titleWords]
    .filter((keyword, index, arr) => arr.indexOf(keyword) === index)
    .slice(0, 5); // Limit to 5 keywords
  
  return allKeywords;
}

export async function sendSearchResultsForCategory(
  searchResult: SearchResult,
  categoryKey: string
): Promise<void> {
  try {
    const config = await loadConfig();
    const searchCategory = config.ai_search_categories?.[categoryKey];
    
    if (!searchCategory) {
      logger.warn('Search category not found in config', { categoryKey });
      return;
    }

    let webhookUrl = searchCategory.discord_webhook;
    
    // Fallback to default webhook if category-specific one is not set
    if (!webhookUrl && config.discord?.default_webhook_url) {
      webhookUrl = config.discord.default_webhook_url;
      logger.debug('Using default Discord webhook', { categoryKey });
    }

    if (!webhookUrl) {
      logger.warn('No Discord webhook configured for category', { categoryKey });
      return;
    }

    await sendSearchResultsToDiscord(searchResult, webhookUrl);
  } catch (error) {
    logger.error('Error sending search results for category', {
      error: error instanceof Error ? error.message : String(error),
      categoryKey,
      category: searchResult.category
    });
    throw error;
  }
} 