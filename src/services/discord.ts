import axios from 'axios';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('discord-service');

function formatDiscordMessage(
  title: string,
  summary: string,
  keywords: string[],
  sourceUrl: string
) {
  return {
    embeds: [
      {
        title: title,
        url: sourceUrl,
        description: `"${summary}"`,
        color: 0x0099ff,
        fields: [
          {
            name: 'Keywords',
            value: keywords.length ? keywords.join(', ') : 'Không có',
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  };
}

export async function sendDiscordNotification(
  title: string,
  summary: string,
  keywords: string[],
  sourceUrl: string,
  category: string
): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  logger.debug('Sending Discord notification', {
    title,
    category,
    summaryLength: summary.length,
    keywordCount: keywords.length
  });
  
  if (!webhookUrl) {
    logger.warn('Discord webhook URL not configured, skipping notification');
    return;
  }

  try {
    const message = formatDiscordMessage(title, summary, keywords, sourceUrl);
    
    logger.debug('Discord message prepared', {
      embedCount: message.embeds.length,
      fieldCount: message.embeds[0].fields.length
    });
    
    await axios.post(webhookUrl, message);
    logger.debug('Discord notification sent successfully', {
      title,
      category
    });
  } catch (error) {
    logger.error('Error sending Discord notification', {
      error: error instanceof Error ? error.message : String(error),
      title,
      category
    });
    throw error;
  }
} 