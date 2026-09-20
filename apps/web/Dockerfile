# syntax=docker/dockerfile:1
# ─── مرحله‌ی بیلد ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /repo

# مقادیر NEXT_PUBLIC_* باید هنگام بیلد موجود باشند (داخل باندل می‌روند).
ARG NEXT_PUBLIC_APP_VERSION=1.0.0
ARG NEXT_PUBLIC_API_VERSION=4
ARG NEXT_PUBLIC_UPDATE_PUBKEY=""
ARG NEXT_PUBLIC_UPDATE_CHANNEL=stable
ARG NEXT_PUBLIC_GATEWAY_URL=""
# سقف هیپ V8 — روی سرورهای کوچک جلوی OOM-kill هنگام next build را می‌گیرد.
ARG NODE_HEAP_MB=1536
ENV NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB" \
    NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION \
    NEXT_PUBLIC_API_VERSION=$NEXT_PUBLIC_API_VERSION \
    NEXT_PUBLIC_UPDATE_PUBKEY=$NEXT_PUBLIC_UPDATE_PUBKEY \
    NEXT_PUBLIC_UPDATE_CHANNEL=$NEXT_PUBLIC_UPDATE_CHANNEL \
    NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL \
    NEXT_TELEMETRY_DISABLED=1

# لایه‌ی وابستگی‌ها جدا نگه داشته می‌شود تا کش داکر بین بیلدها بماند.
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/web/package.json apps/web/
COPY apps/gateway/package.json apps/gateway/
RUN npm install --ignore-scripts

COPY scripts scripts
COPY packages/protocol packages/protocol
COPY apps/web apps/web

# فونت وزیرمتن از بسته‌ی npm کپی می‌شود (در گیت کامیت نشده است).
RUN node scripts/fonts.mjs && npm run build --workspace @sr/web

# ─── مرحله‌ی اجرا ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN apk add --no-cache curl \
 && addgroup -g 1001 sr \
 && adduser -u 1001 -G sr -D sr

# خروجی standalone شامل server.js و فقط وابستگی‌های واقعاً استفاده‌شده است.
COPY --from=build --chown=sr:sr /repo/apps/web/.next/standalone ./
COPY --from=build --chown=sr:sr /repo/apps/web/.next/static     ./apps/web/.next/static
COPY --from=build --chown=sr:sr /repo/apps/web/public           ./apps/web/public

# اسکریپت‌های عملیاتی و فایل‌های مهاجرت، در زمان اجرا لازم‌اند:
#   docker compose exec web node apps/web/scripts/migrate.mjs
COPY --from=build --chown=sr:sr /repo/apps/web/scripts                ./apps/web/scripts
COPY --from=build --chown=sr:sr /repo/apps/web/src/lib/db/migrations  ./apps/web/src/lib/db/migrations

# محل نگهداری بسته‌های آپدیت و پیوست‌های کاربران (هر دو از بیرون mount می‌شوند).
RUN mkdir -p /srv/releases /srv/uploads && chown -R sr:sr /srv/releases /srv/uploads

USER sr
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
