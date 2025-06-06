import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface FeedConfig {
  name: string;
  rss_url: string;
  css_selector: string;
  override_notify?: 'discord' | 'telegram' | '';
  override_discord_webhook?: string;
  override_telegram_bot_token?: string;
  override_telegram_chat_id?: string;
}

export interface AppConfig {
  default_notify_discord: boolean;
  default_discord_webhook: string;
  default_notify_telegram: boolean;
  default_telegram_bot_token: string;
  default_telegram_chat_id: string;
  processing_delay: { min_seconds: number; max_seconds: number };
  retry: { max_attempts: number; initial_delay_seconds: number; backoff_strategy: string };
  feeds: FeedConfig[];
}

/**
 * Loads the application configuration from YAML or JSON file, with environment variable overrides for secrets.
 * OpenAI-compatible inference server and model are ONLY loaded from environment variables:
 *   - OPENAI_BASE_URL
 *   - OPENAI_TEXT_MODEL
 */
export function loadConfig(configPath = 'config/config.yaml'): AppConfig {
  const ext = path.extname(configPath);
  const raw = fs.readFileSync(configPath, 'utf8');
  let config: AppConfig;
  if (ext === '.yaml' || ext === '.yml') {
    config = yaml.load(raw) as AppConfig;
  } else if (ext === '.json') {
    config = JSON.parse(raw);
  } else {
    throw new Error('Unsupported config file format');
  }
  if (process.env.DISCORD_WEBHOOK_URL) config.default_discord_webhook = process.env.DISCORD_WEBHOOK_URL;
  if (process.env.TELEGRAM_BOT_TOKEN) config.default_telegram_bot_token = process.env.TELEGRAM_BOT_TOKEN;
  if (process.env.TELEGRAM_CHAT_ID) config.default_telegram_chat_id = process.env.TELEGRAM_CHAT_ID;
  return config;
}

/**
 * Returns the OpenAI-compatible inference server base URL from environment variables.
 */
export function getOpenAIBaseUrl(): string {
  return process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
}

/**
 * Returns the model name for the OpenAI-compatible inference server from environment variables.
 */
export function getOpenAITextModel(): string {
  return process.env.OPENAI_TEXT_MODEL || 'openai/gpt-4o';
} 