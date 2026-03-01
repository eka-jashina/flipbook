# ── Stage 1: Build frontend ──────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Build backend ───────────────────────────────────────
FROM node:22-alpine AS backend-builder

WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm ci

COPY server/prisma ./prisma/
RUN npx prisma generate

COPY server/tsconfig.json ./
COPY server/src ./src/
RUN npm run build

# ── Stage 3: Production ─────────────────────────────────────────
FROM node:22-alpine

# dumb-init: proper PID 1 signal forwarding (SIGTERM → Node.js)
RUN apk add --no-cache dumb-init

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Prisma schema + generated client
COPY --from=backend-builder /app/prisma ./prisma/
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma

# Compiled server
COPY --from=backend-builder /app/dist ./dist/

# Built frontend
COPY --from=frontend-builder /app/dist ./client/

# Own files by non-root user
RUN chown -R appuser:appgroup /app

ENV NODE_ENV=production
ENV CLIENT_DIST_PATH=/app/client
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

USER appuser

CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
