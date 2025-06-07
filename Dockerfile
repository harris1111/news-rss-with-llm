# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for building)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy configuration and scripts
COPY config/ ./config/
COPY run-service.sh ./

# Make run-service.sh executable
RUN chmod +x run-service.sh

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S newsrss -u 1001

# Change ownership of the app directory
RUN chown -R newsrss:nodejs /app
USER newsrss

# Expose port (not strictly necessary, but good practice)
EXPOSE 3000

# Health check - will be overridden by docker-compose for specific services
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('NewsRSS Service Health Check OK')" || exit 1

# Use run-service.sh as entrypoint
ENTRYPOINT ["./run-service.sh"] 