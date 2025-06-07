import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

// Custom format for better readability
const customFormat = printf(({ level, message, timestamp, service, ...metadata }) => {
  const serviceTag = service ? `[${service}]` : '';
  
  // Format metadata in a more readable way
  let metaStr = '';
  if (Object.keys(metadata).length) {
    metaStr = Object.entries(metadata)
      .map(([key, value]) => {
        // Format arrays and objects nicely
        if (Array.isArray(value)) {
          return `${key}=[${value.join(', ')}]`;
        }
        if (typeof value === 'object' && value !== null) {
          return `${key}={${Object.entries(value)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}}`;
        }
        // Handle special characters in strings
        const strValue = String(value);
        // Truncate long strings
        if (strValue.length > 100) {
          return `${key}=${strValue.substring(0, 97)}...`;
        }
        // Replace newlines and multiple spaces
        return `${key}=${strValue.replace(/\n/g, ' ').replace(/\s+/g, ' ')}`;
      })
      .join(' | ');
    metaStr = ` | ${metaStr}`;
  }

  // Clean up the message
  const cleanMessage = String(message)
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return `${timestamp} ${serviceTag} ${level}: ${cleanMessage}${metaStr}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    colorize(),
    customFormat
  ),
  defaultMeta: { service: 'newsrss' },
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        customFormat
      )
    })
  ]
});

// Create service-specific loggers
export function createServiceLogger(serviceName: string) {
  return logger.child({ service: serviceName });
}

// Export default logger for backward compatibility
export { logger }; 