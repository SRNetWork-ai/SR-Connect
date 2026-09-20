#!/usr/bin/env bash
# بکاپ کامل: دیتابیس + .env + کلید امضا + بسته‌های ریلیز + پیوست‌های کاربران.
# کرون پیشنهادی:  0 3 * * *  /opt/sr-connect/deploy/scripts/backup.sh --quiet
set -Eeuo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/sr-connect}"
BACKUP_DIR="${BACKUP_DIR:-$INSTALL_DIR/backups}"
KEEP="${KEEP:-14}"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1
log(){ [ "$QUIET" = 1 ] || printf '%s\n' "$*"; }

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/sr-connect-$STAMP.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$INSTALL_DIR/deploy"
log "→ dump دیتابیس"
docker compose exec -T postgres pg_dump -U sr -d srconnect --no-owner --clean --if-exists > "$TMP/database.sql"

log "→ پیکربندی و کلیدها"
cp .env "$TMP/env" 2>/dev/null || true
[ -d keys ] && cp -r keys "$TMP/keys"
[ -d releases ] && cp -r releases "$TMP/releases"
# پیوست‌ها می‌توانند بزرگ باشند؛ با SKIP_UPLOADS=1 از بکاپ کنار گذاشته می‌شوند.
if [ "${SKIP_UPLOADS:-0}" != "1" ] && [ -d uploads ]; then
  log "→ پیوست‌ها ($(du -sh uploads 2>/dev/null | cut -f1))"
  cp -r uploads "$TMP/uploads"
fi
git -C "$INSTALL_DIR" rev-parse HEAD > "$TMP/commit.txt" 2>/dev/null || true

tar -czf "$OUT" -C "$TMP" .
chmod 600 "$OUT"

# فقط N نسخه‌ی آخر می‌ماند.
ls -1t "$BACKUP_DIR"/sr-connect-*.tar.gz 2>/dev/null | tail -n "+$((KEEP + 1))" | xargs -r rm -f

log "✔ بکاپ: $OUT ($(du -h "$OUT" | cut -f1))"
