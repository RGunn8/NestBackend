# Build stage — includes devDependencies for nest build
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && test -f dist/main.js

# Production stage — runtime only
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/database/migrations ./src/database/migrations

RUN chmod +x scripts/start.sh && test -f dist/main.js

EXPOSE 8080

# Inline echo ensures something is logged even if start.sh is missing
CMD ["sh", "-c", "echo '[docker] launching start.sh' && exec sh scripts/start.sh"]
