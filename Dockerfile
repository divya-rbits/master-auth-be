# Multi-stage build for optimized production image
FROM node:24-alpine AS base

# Install production dependencies
FROM base AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Production image
FROM base AS production
WORKDIR /app

# Copy dependencies from dependencies stage
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules

# Copy application code
COPY --chown=node:node . .

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R node:node logs

# Switch to non-root user (already exists in node:24-alpine)
USER node

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["node", "src/index.js"]
