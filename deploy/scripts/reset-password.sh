#!/usr/bin/env bash
# بازنشانی گذرواژه‌ی یک کاربر روی نصب لوکال.
#   sudo bash /opt/sr-connect/deploy/scripts/reset-password.sh <username|email> [password]
# اگر گذرواژه ندهی، یک گذرواژه‌ی تصادفی ساخته و چاپ می‌شود.
set -euo pipefail
INSTALL_DIR="${INSTALL_DIR:-/opt/sr-connect}"
cd "$INSTALL_DIR/deploy" 2>/dev/null || { echo "نصب پیدا نشد در $INSTALL_DIR"; exit 1; }

if [ "$#" -lt 1 ]; then
  echo "استفاده: $0 <username|email> [password]"
  exit 1
fi

# اسکریپت داخل کانتینر web اجرا می‌شود تا هم DATABASE_URL و هم شبکه‌ی داخلی را داشته باشد.
# داخل ایمیج، اسکریپت‌ها زیر apps/web/scripts هستند (WORKDIR=/app).
docker compose exec -T web node apps/web/scripts/reset-password.mjs "$@"
