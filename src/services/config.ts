import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('config-service');

export interface Feed {
  name: string;
  url: string;
  category?: string;
  css_selector?: string;
  scraping_mode?: 1 | 2; // 1 = HTTP, 2 = Chrome
  language?: 'vi' | 'en'; // Language for AI summarization
}

export interface SchedulingConfig {
  mode: 'interval' | 'cron' | 'manual';
  interval?: {
    minutes: number;
  };
  cron?: {
    expression: string;
    timezone: string;
  };
  timezone?: string;
}

export interface AISearchCategory {
  enabled: boolean;
  category: string;
  search_prompt: string;
  discord_webhook?: string;
}

export interface RSSProcessingOptions {
  enabled: boolean;
  today_only: boolean;
  max_articles_per_feed?: number;
  chrome_url?: string; // URL for Chrome container (e.g., 'http://chrome:9222')
}

export interface Config {
  feeds: Feed[];
  rss_processing?: RSSProcessingOptions;
  scheduling: {
    rss_processing: SchedulingConfig;
    ai_search: SchedulingConfig & { enabled: boolean };
  };
  ai_summarization?: {
    enabled: boolean;
    summary_prompt?: string;
  };
  ai_search_categories?: Record<string, AISearchCategory>;
  discord?: {
    default_webhook_url: string;
    categories: Record<string, string>;
  };
}

export async function loadConfig(): Promise<Config> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'config.yaml');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = yaml.load(configContent) as Config;
    
    // Backwards compatibility: if old scheduling format exists, use it for rss_processing
    if (!config.scheduling.rss_processing && (config.scheduling as any).mode) {
      const oldScheduling = config.scheduling as any;
      config.scheduling = {
        rss_processing: {
          mode: oldScheduling.mode,
          interval: oldScheduling.interval,
          cron: oldScheduling.cron,
          timezone: oldScheduling.timezone
        },
        ai_search: {
          enabled: false,
          mode: 'manual'
        }
      };
    }
    
    // Set default RSS processing options
    if (!config.rss_processing) {
      config.rss_processing = {
        enabled: true,
        today_only: true,
        max_articles_per_feed: 50
      };
    } else {
      // Ensure all properties have defaults
      config.rss_processing.enabled = config.rss_processing.enabled ?? true;
      config.rss_processing.today_only = config.rss_processing.today_only ?? true;
      config.rss_processing.max_articles_per_feed = config.rss_processing.max_articles_per_feed ?? 50;
    }
    
    return config;
  } catch (error) {
    logger.error('Error loading config', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
} 