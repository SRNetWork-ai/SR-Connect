#!/usr/bin/env bash
# گزارش یک‌نگاهی از سلامت پشته.  خروجی غیرصفر یعنی چیزی خراب است.
set -uo pipefail
INSTALL_DIR="${INSTALL_DIR:-/opt/sr-connect}"
cd "$INSTALL_DIR/deploy" 2>/dev/null || { echo "نصب پیدا نشد در $INSTALL_DIR"; exit 1; }
set -a; . ./.env 2>/dev/null; set +a

C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_R=$'\033[0m'
fails=0
row(){ # row <نام> <وضعیت 0/1> [توضیح]
  if [ "$2" = 0 ]; then printf '  %s✔%s %-22s %s\n' "$C_OK" "$C_R" "$1" "${3:-}"
  else printf '  %s✘%s %-22s %s\n' "$C_ERR" "$C_R" "$1" "${3:-}"; fails=$((fails+1)); fi
}

echo "SR-Connect — بررسی سلامت  ($(date -Is))"
echo

for svc in caddy web gateway postgres livekit coturn; do
  state="$(docker compose ps --format '{{.Service}} {{.State}}' 2>/dev/null | awk -v s="$svc" '$1==s{print $2}')"
  [ "$state" = "running" ] && row "کانتینر $svc" 0 "$state" || row "کانتینر $svc" 1 "${state:-موجود نیست}"
done
echo

web_json="$(docker compose exec -T web curl -fsS --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null)"
[ -n "$web_json" ] && row "API وب" 0 "$(echo "$web_json" | head -c 90)" || row "API وب" 1 "پاسخ نداد"

gw_json="$(docker compose exec -T gateway curl -fsS --max-time 5 http://127.0.0.1:4001/health 2>/dev/null)"
[ -n "$gw_json" ] && row "گیت‌وی realtime" 0 "$(echo "$gw_json" | head -c 90)" || row "گیت‌وی realtime" 1 "پاسخ نداد"

docker compose exec -T postgres pg_isready -U sr -d srconnect >/dev/null 2>&1 \
  && row "پستگرس" 0 || row "پستگرس" 1
curl -fsS --max-time 5 "http://127.0.0.1:7880" -o /dev/null 2>/dev/null \
  && row "LiveKit" 0 "پورت ۷۸۸۰ باز" || row "LiveKit" 1 "پورت ۷۸۸۰ پاسخ نداد"

if [ -n "${SR_DOMAIN:-}" ]; then
  code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 8 "https://$SR_DOMAIN/api/health" 2>/dev/null || echo 000)"
  [ "$code" = "200" ] && row "HTTPS عمومی" 0 "$SR_DOMAIN" || row "HTTPS عمومی" 1 "کد $code"
fi

echo
df -h / | awk 'NR==2{printf "  دیسک: %s استفاده‌شده از %s (%s)\n", $3, $2, $5}'
free -m | awk 'NR==2{printf "  رم:   %sMB از %sMB\n", $3, $2}'
echo
[ "$fails" = 0 ] && echo "  همه‌چیز سالم است." || echo "  $fails مورد مشکل دارد — لاگ: docker compose logs --tail=80"
exit "$fails"
