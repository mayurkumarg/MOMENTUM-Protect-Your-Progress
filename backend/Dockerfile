# Backend (Express/MongoDB API) — production image.
# Build context MUST be the repo root: `docker build -f backend/Dockerfile .`
# because backend dependencies are declared in the root package.json.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY backend ./backend

RUN addgroup -S momentum && adduser -S momentum -G momentum \
  && mkdir -p /app/backend/uploads \
  && chown -R momentum:momentum /app

USER momentum

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "backend/server.js"]
