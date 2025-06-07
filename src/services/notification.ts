import { createServiceLogger } from '../utils/logger';
import { sendDiscordNotification } from './discord';

const logger = createServiceLogger('notification-service');

export async function sendNotification(
  title: string,
  summary: string,
  keywords: string[],
  sourceUrl: string,
  category: string
): Promise<void> {
  try {
    // Send Discord notification
    await sendDiscordNotification(title, summary, keywords, sourceUrl, category);
    logger.info('Notification sent successfully', {
      title,
      category,
      platform: 'discord'
    });
  } catch (error) {
    logger.error('Error sending notification', {
      error: error instanceof Error ? error.message : String(error),
      title,
      category
    });
    throw error;
  }
} 