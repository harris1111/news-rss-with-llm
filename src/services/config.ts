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
}

export interface Config {
  feeds: Feed[];
  scheduling: {
    mode: 'interval' | 'cron' | 'manual';
    interval?: {
      minutes: number;
    };
    cron?: {
      expression: string;
      timezone: string;
    };
  };
}

export async function loadConfig(): Promise<Config> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'config.yaml');
    const configContent = await fs.readFile(configPath, 'utf-8');
    return yaml.load(configContent) as Config;
  } catch (error) {
    logger.error('Error loading config', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
} 