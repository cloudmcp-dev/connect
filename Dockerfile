# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies and pnpm
RUN apk add --no-cache python3 make g++ && \
    npm install -g pnpm@8

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install all dependencies (including dev dependencies for building)
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    npm install -g pnpm@8

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/healthz || exit 1

# Set entrypoint
ENTRYPOINT ["node", "--experimental-specifier-resolution=node", "dist/cli.js"] 