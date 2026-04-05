# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
# Clean install for production and clean cache
RUN npm ci --omit=dev && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]

