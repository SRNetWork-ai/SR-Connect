#!/usr/bin/env bash
# حذف کامل. به‌طور پیش‌فرض یک بکاپ آخر می‌گیرد.
set -Eeuo pipefail
INSTALL_DIR="${INSTALL_DIR:-/opt/sr-connect}"
PURGE=0
[ "${1:-}" = "--purge" ] && PURGE=1

echo "این کار سرویس‌های SR-Connect را متوقف و حذف می‌کند."
[ "$PURGE" = 1 ] && echo "⚠ با --purge، دیتابیس و همه‌ی داده‌ها هم پاک می‌شوند."
read -r -p "ادامه؟ (yes/no) " a </dev/tty
[ "$a" = "yes" ] || { echo "لغو شد."; exit 0; }

if [ -d "$INSTALL_DIR/deploy" ]; then
  "$INSTALL_DIR/deploy/scripts/backup.sh" || echo "بکاپ نهایی نگرفت (بی‌خیال)."
  cd "$INSTALL_DIR/deploy"
  if [ "$PURGE" = 1 ]; then docker compose down -v --remove-orphans; else docker compose down --remove-orphans; fi
fi

systemctl disable --now sr-connect.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/sr-connect.service
systemctl daemon-reload >/dev/null 2>&1 || true

if [ "$PURGE" = 1 ]; then
  echo "بکاپ‌ها در $INSTALL_DIR/backups باقی می‌مانند؛ خودت جابه‌جا کن."
  find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 ! -name backups -exec rm -rf {} +
fi
echo "✔ حذف شد."
