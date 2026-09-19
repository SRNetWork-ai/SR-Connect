#!/usr/bin/env bash
# به‌روزرسانی امن: بکاپ → کشیدن کد → بیلد → مهاجرت → راه‌اندازی مجدد.
# اگر چیزی خراب شود، به کامیت قبلی برمی‌گردد.
set -Eeuo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/sr-connect}"
BRANCH="${BRANCH:-main}"
cd "$INSTALL_DIR"

C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_B=$'\033[1m'; C_R=$'\033[0m'
ok(){ printf '  %s✔%s %s\n' "$C_OK" "$C_R" "$*"; }
step(){ printf '\n%s▸ %s%s\n' "$C_B" "$*" "$C_R"; }

PREV="$(git rev-parse HEAD)"
rollback() {
  printf '\n%s✘ به‌روزرسانی شکست خورد؛ برگشت به %s%s\n' "$C_ERR" "${PREV:0:8}" "$C_R" >&2
  git reset --hard "$PREV" -q
  (cd deploy && { docker compose pull -q web gateway || docker compose build; }; docker compose up -d) || true
  exit 1
}
trap rollback ERR

step "بکاپ قبل از به‌روزرسانی"
bash "$INSTALL_DIR/deploy/scripts/backup.sh" --quiet
ok "بکاپ گرفته شد"

step "دریافت نسخه‌ی جدید"
git fetch --depth 1 origin "$BRANCH" -q
NEW="$(git rev-parse "origin/$BRANCH")"
if [ "$PREV" = "$NEW" ]; then ok "از قبل به‌روز است (${NEW:0:8})"; exit 0; fi
git reset --hard "origin/$BRANCH" -q
ok "کد روی ${NEW:0:8} آمد"

step "ساخت و راه‌اندازی"
cd deploy
# اول ایمیج آماده؛ اگر نشد روی همین سرور بیلد کن.
if grep -q '^SR_IMAGE_WEB=ghcr.io' .env 2>/dev/null && docker compose pull -q web gateway 2>/dev/null; then
  echo "  ایمیج‌های آماده دریافت شد."
else
  echo "  بیلد محلی…"
  docker compose build --pull 2>&1 | tail -3
fi
docker compose up -d --remove-orphans >/dev/null
ok "سرویس‌ها بالا آمدند"

step "مهاجرت دیتابیس"
for _ in $(seq 1 30); do
  docker compose exec -T postgres pg_isready -U sr -d srconnect >/dev/null 2>&1 && break
  sleep 2
done
docker compose exec -T web node apps/web/scripts/migrate.mjs
ok "دیتابیس به‌روز شد"

step "بررسی سلامت"
sleep 5
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ok "سالم است"

trap - ERR
docker image prune -f >/dev/null 2>&1 || true
printf '\n%s✔ به‌روزرسانی کامل شد: %s → %s%s\n' "$C_OK" "${PREV:0:8}" "${NEW:0:8}" "$C_R"
