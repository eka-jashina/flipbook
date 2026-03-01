FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (separate layer for caching)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code and build
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ── Production stage ──────────────────────────────────────────────

FROM node:22-alpine

# dumb-init: proper PID 1 signal forwarding (SIGTERM → Node.js)
RUN apk add --no-cache dumb-init

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy prisma schema and generated client from builder
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled JavaScript
COPY --from=builder /app/dist ./dist/

# Own files by non-root user
RUN chown -R appuser:appgroup /app

ENV NODE_ENV=production
EXPOSE 4000

# Health check — container orchestrators use this to detect unhealthy instances
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

USER appuser

# dumb-init ensures SIGTERM is forwarded to the Node.js process
# Run migrations then start the production server
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
