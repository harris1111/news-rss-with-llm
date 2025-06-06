export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1) + min) * 1000;
  return sleep(ms);
}

export async function retry<T>(fn: () => Promise<T>, maxAttempts: number, initialDelay: number) {
  let attempt = 0;
  let delay = initialDelay * 1000;
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      await sleep(delay);
      delay *= 2;
    }
  }
} 