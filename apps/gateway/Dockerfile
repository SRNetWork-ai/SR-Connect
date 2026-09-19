# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/web/package.json apps/web/
COPY apps/gateway/package.json apps/gateway/
RUN npm install --ignore-scripts
COPY packages/protocol packages/protocol
COPY apps/gateway apps/gateway
RUN npm run build --workspace @sr/gateway

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache curl && addgroup -g 1001 sr && adduser -u 1001 -G sr -D sr
COPY --from=build --chown=sr:sr /repo/node_modules ./node_modules
COPY --from=build --chown=sr:sr /repo/apps/gateway/dist ./dist
COPY --from=build --chown=sr:sr /repo/apps/gateway/package.json ./package.json
USER sr
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4001/health || exit 1
CMD ["node", "dist/apps/gateway/src/index.js"]
