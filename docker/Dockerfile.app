FROM oven/bun:latest

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files for better layer caching
COPY package.json bun.lockb turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/app/package.json ./packages/app/

# Install dependencies
RUN bun install

# Copy source code, scripts and env template
COPY packages/ ./packages/
COPY scripts/ ./scripts/
COPY .env .env

# Build app
RUN bun run build:app

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/metadata || exit 1

# Start the SvelteKit application
CMD ["sh", "-c", "cd packages/app && bun build/index.js"]
