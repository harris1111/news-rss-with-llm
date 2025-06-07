import Redis from 'ioredis';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('queue-service');

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

const redis = new Redis(process.env.REDIS_URL);
const QUEUE_NAME = 'newsrss:jobs';

redis.on('error', (error) => {
  logger.error('Redis connection error', {
    error: error instanceof Error ? error.message : String(error)
  });
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

export interface QueueJob {
  url: string;
  feedName: string;
  category: string;
  css_selector: string;
  meta?: {
    title?: string;
    published?: string;
    content?: string;        // RSS content as fallback
    description?: string;    // RSS description as additional fallback
  };
}

export async function pushJob(job: QueueJob) {
  try {
    await redis.lpush(QUEUE_NAME, JSON.stringify(job));
    logger.debug('Job pushed to queue', {
      url: job.url,
      feed: job.feedName,
      category: job.category
    });
  } catch (error) {
    logger.error('Error pushing job to queue', {
      error: error instanceof Error ? error.message : String(error),
      job
    });
    throw error;
  }
}

export async function popJob(): Promise<QueueJob | null> {
  try {
    const job = await redis.rpop(QUEUE_NAME);
    if (job) {
      const parsedJob = JSON.parse(job) as QueueJob;
      logger.debug('Job popped from queue', {
        url: parsedJob.url,
        feed: parsedJob.feedName,
        category: parsedJob.category
      });
      return parsedJob;
    }
    return null;
  } catch (error) {
    logger.error('Error popping job from queue', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
} 