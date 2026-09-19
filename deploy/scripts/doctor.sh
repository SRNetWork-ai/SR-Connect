#!/usr/bin/env bash
# ============================================================================
#  SR-Connect — عیب‌یاب
#    bash doctor.sh          فقط تشخیص می‌دهد، چیزی را عوض نمی‌کند
#    bash doctor.sh --fix    مشکلات شبکه‌ی داکر و فایروال را هم درست می‌کند
# ============================================================================
set -uo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/sr-connect}"
FIX=0
[ "${1:-}" = "--fix" ] && FIX=1

C_B=$'\e[1m'; C_OK=$'\e[32m'; C_WARN=$'\e[33m'; C_ERR=$'\e[31m'; C_DIM=$'\e[2m'; C_R=$'\e[0m'
say()  { printf '%s\n' "$*"; }
head1(){ printf '\n%s▸ %s%s\n' "$C_B" "$*" "$C_R"; }
ok()   { printf '  %s✔%s %s\n' "$C_OK" "$C_R" "$*"; }
bad()  { printf '  %s✘%s %s\n' "$C_ERR" "$C_R" "$*"; }
warn() { printf '  %s!%s %s\n' "$C_WARN" "$C_R" "$*"; }
info() { printf '  %s%s%s\n' "$C_DIM" "$*" "$C_R"; }

PROBLEMS=0
note_problem() { PROBLEMS=$((PROBLEMS+1)); }

cd "$INSTALL_DIR/deploy" 2>/dev/null || { bad "مسیر $INSTALL_DIR/deploy پیدا نشد."; exit 1; }

# ── ۱) پایه ────────────────────────────────────────────────────────────────
head1 "محیط"
info "$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME")"
info "رم $(awk '/MemTotal/{printf "%dMB", $2/1024}' /proc/meminfo) · $(nproc) هسته"
if command -v docker >/dev/null 2>&1; then ok "$(docker --version | cut -d, -f1)"; else bad "داکر نصب نیست"; exit 1; fi
if swapon --show 2>/dev/null | grep -q .; then ok "swap فعال است"; else info "swap ندارد (برای اجرا لازم نیست)"; fi

# ── ۲) سرویس‌ها ────────────────────────────────────────────────────────────
head1 "سرویس‌ها"
docker compose ps --format '  {{.Service}}\t{{.Status}}' 2>/dev/null || docker compose ps
for svc in postgres web gateway caddy; do
  cid="$(docker compose ps -q "$svc" 2>/dev/null | head -1)"
  if [ -z "$cid" ]; then bad "$svc اصلاً ساخته نشده"; note_problem; continue; fi
  state="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null)"
  restarts="$(docker inspect -f '{{.RestartCount}}' "$cid" 2>/dev/null)"
  [ "$state" = running ] || { bad "$svc در وضعیت $state است"; note_problem; }
  [ "${restarts:-0}" -gt 3 ] && { warn "$svc تا حالا $restarts بار ری‌استارت شده"; note_problem; }
done

# ── ۳) شبکه‌ی داخلی داکر (مهم‌ترین بخش) ────────────────────────────────────
head1 "ارتباط کانتینرها با پستگرس"
NET_OK=0
if docker compose ps -q web >/dev/null 2>&1 && [ -n "$(docker compose ps -q web)" ]; then
  res="$(docker compose exec -T web node -e "
const s=require('net').createConnection({host:'postgres',port:5432});
s.setTimeout(6000);
s.on('connect',()=>{console.log('OK');s.destroy();process.exit(0)});
s.on('timeout',()=>{console.log('TIMEOUT');process.exit(2)});
s.on('error',e=>{console.log('ERR '+e.code);process.exit(1)});" 2>&1 | tr -d '\r')"
  case "$res" in
    OK*)      ok "web ➜ postgres:5432 وصل می‌شود"; NET_OK=1 ;;
    TIMEOUT*) bad "web ➜ postgres:5432 تایم‌اوت — بسته‌ها drop می‌شوند (فایروال/iptables)"; note_problem ;;
    ERR*)     bad "web ➜ postgres:5432 خطا: $res"; note_problem ;;
    *)        bad "تست شبکه انجام نشد: $res"; note_problem ;;
  esac
else
  bad "کانتینر web بالا نیست، تست شبکه ممکن نشد"; note_problem
fi

# ── ۴) فایروال میزبان ──────────────────────────────────────────────────────
head1 "فایروال میزبان"
fwd_policy="$(iptables -S FORWARD 2>/dev/null | awk '/^-P FORWARD/{print $3}')"
info "سیاست زنجیره‌ی FORWARD: ${fwd_policy:-نامشخص}"
if [ "$fwd_policy" = DROP ] && [ "$NET_OK" != 1 ]; then
  bad "FORWARD روی DROP است و همین ارتباط کانتینرها را می‌بندد."
  note_problem
fi
if command -v ufw >/dev/null 2>&1; then
  ufw_state="$(ufw status 2>/dev/null | head -1)"
  info "ufw: ${ufw_state:-پاسخ نداد}"
  if ! ufw status >/dev/null 2>&1; then
    bad "ufw نصب است ولی درست کار نمی‌کند — همین باعث خرابی قوانین داکر می‌شود."
    note_problem
  fi
  grep -q 'DEFAULT_FORWARD_POLICY="DROP"' /etc/default/ufw 2>/dev/null \
    && warn "ufw فوروارد را DROP کرده؛ شبکه‌ی داکر با این تنظیم کار نمی‌کند."
fi

# ── ۵) دسترسی از بیرون (برای گواهی TLS) ────────────────────────────────────
head1 "دسترسی از اینترنت"
pub_ip="$(curl -fsS --max-time 6 https://api.ipify.org 2>/dev/null || echo '')"
dom="$(grep -oP '^SR_DOMAIN=\K.*' .env 2>/dev/null || echo '')"
info "IP عمومی: ${pub_ip:-نامشخص} · دامنه: ${dom:-تنظیم نشده}"
if [ -n "$dom" ]; then
  res_ip="$(getent ahostsv4 "$dom" 2>/dev/null | awk 'NR==1{print $1}')"
  if [ "$res_ip" = "$pub_ip" ]; then ok "رکورد A درست است ($res_ip)"
  else warn "رکورد A دامنه ($res_ip) با IP سرور ($pub_ip) یکی نیست"; fi
fi
ss -lntp 2>/dev/null | grep -qE ':80\s' && ok "پورت ۸۰ روی سرور LISTEN است" || { bad "هیچ‌چیز روی پورت ۸۰ گوش نمی‌دهد"; note_problem; }
if grep -q 'Timeout during connect' <(docker compose logs --tail=200 --no-color caddy 2>/dev/null); then
  bad "Let's Encrypt نتوانسته به پورت ۸۰ این سرور برسد."
  say  "      یعنی ترافیک ورودی قبل از رسیدن به سرور بلاک می‌شود."
  say  "      ${C_B}فایروال ابری Vultr/Hetzner/OVH را در پنل باز کن:${C_R}"
  say  "        TCP 80, 443, 3478   ·   UDP 443, 3478, 50000-50400"
  note_problem
fi

# ── ۶) حالت اصلاح ──────────────────────────────────────────────────────────
if [ "$FIX" = 1 ]; then
  head1 "اصلاح خودکار"
  [ "$(id -u)" -eq 0 ] || { bad "برای --fix باید با sudo اجرا شود."; exit 1; }

  if command -v ufw >/dev/null 2>&1 && ! ufw status >/dev/null 2>&1; then
    say "  ufw خراب است؛ غیرفعالش می‌کنیم (از فایروال ابری ارائه‌دهنده استفاده کن)."
    ufw --force disable >/dev/null 2>&1 || true
    systemctl stop ufw >/dev/null 2>&1 || true
    systemctl disable ufw >/dev/null 2>&1 || true
    ok "ufw غیرفعال شد"
  fi

  if [ "$(iptables -S FORWARD 2>/dev/null | awk '/^-P FORWARD/{print $3}')" = DROP ]; then
    iptables -P FORWARD ACCEPT && ok "سیاست FORWARD روی ACCEPT تنظیم شد"
  fi

  say "  ری‌استارت داکر تا قوانین شبکه دوباره ساخته شوند…"
  systemctl restart docker && sleep 10 && ok "داکر ری‌استارت شد"

  cd "$INSTALL_DIR/deploy"
  docker compose up -d >/dev/null 2>&1 && ok "سرویس‌ها دوباره بالا آمدند"
  sleep 8

  res="$(docker compose exec -T web node -e "
const s=require('net').createConnection({host:'postgres',port:5432});
s.setTimeout(6000);
s.on('connect',()=>{console.log('OK');s.destroy();process.exit(0)});
s.on('timeout',()=>{console.log('TIMEOUT');process.exit(2)});
s.on('error',e=>{console.log('ERR '+e.code);process.exit(1)});" 2>&1 | tr -d '\r')"
  if [ "${res%% *}" = OK ]; then
    ok "حالا web به postgres وصل می‌شود"
    say ""
    say "  ${C_B}مرحله‌ی بعد:${C_R} نصاب را دوباره اجرا کن تا مهاجرت و ساخت مدیر انجام شود:"
    say "    curl -fsSL https://raw.githubusercontent.com/SRNetWork-ai/SR-Connect/main/deploy/scripts/install.sh | sudo bash"
  else
    bad "هنوز وصل نمی‌شود ($res)."
    say "      احتمالاً فایروال ابری ارائه‌دهنده است، نه خود سرور."
  fi
  exit 0
fi

# ── جمع‌بندی ───────────────────────────────────────────────────────────────
head1 "جمع‌بندی"
if [ "$PROBLEMS" -eq 0 ]; then
  ok "مشکلی پیدا نشد."
else
  warn "$PROBLEMS مورد پیدا شد."
  say  "  برای اصلاح خودکار: ${C_B}sudo bash $INSTALL_DIR/deploy/scripts/doctor.sh --fix${C_R}"
fi
