# Build stage — includes devDependencies for nest build
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage — runtime only
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/database/migrations ./src/database/migrations

RUN chmod +x scripts/start.sh

EXPOSE 3000

CMD ["sh", "scripts/start.sh"]
