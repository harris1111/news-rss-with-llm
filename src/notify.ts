import axios from 'axios';

export async function sendDiscordNotification(webhook: string, message: string) {
  await axios.post(webhook, { content: message });
}

export async function sendTelegramNotification(botToken: string, chatId: string, message: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown',
  });
}

export function formatNotification({ title, url, summary, keywords }: { title: string; url: string; summary: string; keywords: string }) {
  return `+ Title: ${title}\n+ Link: ${url}\n+ Summary: ${summary}\n+ Keywords: ${keywords}`;
} 