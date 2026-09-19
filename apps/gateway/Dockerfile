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

# در مخزن، node_modules/@sr/protocol فقط یک symlink ورک‌اسپیس به packages/protocol
# است و در ایمیج اجرا مقصدی ندارد؛ ضمن اینکه exports آن به فایل .ts اشاره می‌کند.
# پس نسخه‌ی کامپایل‌شده را جای آن می‌گذاریم تا import "@sr/protocol" بدون تغییر کار کند.
RUN rm -rf node_modules/@sr/protocol
COPY --from=build --chown=sr:sr /repo/apps/gateway/dist/packages/protocol ./node_modules/@sr/protocol
RUN printf '%s' '{"name":"@sr/protocol","version":"1.0.0","type":"module","main":"./src/index.js","exports":{".":"./src/index.js"}}' \
      > node_modules/@sr/protocol/package.json \
 && chown sr:sr node_modules/@sr/protocol/package.json \
 && node -e "import('@sr/protocol').then(m=>{if(!m.API_VERSION)throw new Error('protocol خالی است');console.log('protocol OK api='+m.API_VERSION)})"
USER sr
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4001/health || exit 1
CMD ["node", "dist/apps/gateway/src/index.js"]
