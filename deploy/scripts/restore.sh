#!/usr/bin/env bash
# بازگردانی از یک فایل بکاپ.  استفاده: sudo ./restore.sh backups/sr-connect-…tar.gz
set -Eeuo pipefail
INSTALL_DIR="${INSTALL_DIR:-/opt/sr-connect}"
ARCHIVE="${1:-}"
[ -f "$ARCHIVE" ] || { echo "فایل بکاپ را بده: ./restore.sh <file.tar.gz>"; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
tar -xzf "$ARCHIVE" -C "$TMP"

cd "$INSTALL_DIR/deploy"
echo "▸ توقف سرویس‌ها"
docker compose stop web gateway >/dev/null

[ -f "$TMP/env" ] && { cp "$TMP/env" .env; chmod 600 .env; echo "  ✔ .env بازگردانی شد"; }
[ -d "$TMP/keys" ] && { rm -rf keys; cp -r "$TMP/keys" keys; chmod 700 keys; echo "  ✔ کلیدها بازگردانی شدند"; }
[ -d "$TMP/releases" ] && { mkdir -p releases; cp -r "$TMP/releases/." releases/ 2>/dev/null || true; }
[ -d "$TMP/uploads" ] && { mkdir -p uploads; cp -r "$TMP/uploads/." uploads/ 2>/dev/null || true; echo "  ✔ پیوست‌ها بازگردانی شدند"; }

echo "▸ بازگردانی دیتابیس"
docker compose up -d postgres >/dev/null
for _ in $(seq 1 30); do docker compose exec -T postgres pg_isready -U sr -d srconnect >/dev/null 2>&1 && break; sleep 2; done
docker compose exec -T postgres psql -U sr -d srconnect -q < "$TMP/database.sql"

echo "▸ راه‌اندازی مجدد"
docker compose up -d >/dev/null
echo "✔ بازگردانی تمام شد."
