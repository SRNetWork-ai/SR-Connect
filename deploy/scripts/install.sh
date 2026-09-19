#!/usr/bin/env bash
# ============================================================================
#  SR-Connect — نصاب خودکار روی سرور
#
#  یک‌خطی:
#    curl -fsSL https://raw.githubusercontent.com/SRNetWork-ai/SR-Connect/main/deploy/scripts/install.sh | sudo bash
#
#  یا بدون سؤال (برای اتوماسیون):
#    sudo SR_DOMAIN=chat.example.com SR_ACME_EMAIL=me@example.com \
#         ADMIN_USERNAME=ali ADMIN_PASSWORD='…' NONINTERACTIVE=1 bash install.sh
#
#  چه کاری می‌کند؟
#    ۱) سیستم‌عامل را تشخیص می‌دهد و Docker + Compose را نصب می‌کند
#    ۲) مخزن را در /opt/sr-connect می‌گیرد
#    ۳) رمزها و کلید امضای Ed25519 را می‌سازد و .env را می‌نویسد
#    ۴) فایروال را باز می‌کند (۸۰/۴۴۳ TCP، ۴۴۳ UDP، ۳۴۷۸ TURN، ۵۰۰۰۰-۵۰۲۰۰ UDP)
#    ۵) ایمیج‌ها را می‌سازد، مهاجرت و داده‌ی اولیه را اجرا می‌کند
#    ۶) سرویس systemd را فعال می‌کند تا بعد از ریبوت خودکار بالا بیاید
# ============================================================================
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/SRNetWork-ai/SR-Connect.git}"
BRANCH="${BRANCH:-main}"
INSTALL_DIR="${INSTALL_DIR:-/opt/sr-connect}"
NONINTERACTIVE="${NONINTERACTIVE:-0}"
SR_VERSION="${SR_VERSION:-1.0.0}"
# pull = ایمیج آماده از GHCR (پیش‌فرض، بدون نیاز به رم زیاد)
# build = بیلد روی همین سرور   |   auto = اول pull، اگر نشد build
SR_MODE="${SR_MODE:-auto}"
GHCR_WEB="${GHCR_WEB:-ghcr.io/srnetwork-ai/sr-connect-web:latest}"
GHCR_GATEWAY="${GHCR_GATEWAY:-ghcr.io/srnetwork-ai/sr-connect-gateway:latest}"

C_RESET=$'\033[0m'; C_DIM=$'\033[2m'; C_B=$'\033[1m'
C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_BRAND=$'\033[38;5;105m'

say()  { printf '%s\n' "$*"; }
step() { printf '\n%s▸ %s%s\n' "$C_BRAND$C_B" "$*" "$C_RESET"; }
ok()   { printf '  %s✔%s %s\n' "$C_OK" "$C_RESET" "$*"; }
warn() { printf '  %s!%s %s\n' "$C_WARN" "$C_RESET" "$*"; }
die()  { printf '\n%s✘ %s%s\n' "$C_ERR" "$*" "$C_RESET" >&2; exit 1; }

on_error() {
  local line="$1" cmd="$2"
  printf '\n%s✘ نصب در خط %s متوقف شد.%s\n' "$C_ERR" "$line" "$C_RESET" >&2
  printf '  دستوری که شکست خورد: %s%s%s\n' "$C_B" "$cmd" "$C_RESET" >&2
  printf '  لاگ سرویس‌ها: docker compose -f %s/deploy/docker-compose.yml logs --tail=80\n' "$INSTALL_DIR" >&2
  printf '  بعد از رفع مشکل، همین نصاب را دوباره اجرا کن — رمزها و کلیدها حفظ می‌شوند.\n' >&2
  exit 1
}
trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR

banner() {
  cat <<'ART'

   ███████╗██████╗        ██████╗ ██████╗ ███╗   ██╗███╗   ██╗
   ██╔════╝██╔══██╗      ██╔════╝██╔═══██╗████╗  ██║████╗  ██║
   ███████╗██████╔╝█████╗██║     ██║   ██║██╔██╗ ██║██╔██╗ ██║
   ╚════██║██╔══██╗╚════╝██║     ██║   ██║██║╚██╗██║██║╚██╗██║
   ███████║██║  ██║      ╚██████╗╚██████╔╝██║ ╚████║██║ ╚████║
   ╚══════╝╚═╝  ╚═╝       ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═══╝

ART
  say "   چت و صوت خودمیزبان — نصاب خودکار v${SR_VERSION}"
  say "   ${C_DIM}github.com/SRNetWork-ai/SR-Connect${C_RESET}"
}

# ── ۰) پیش‌نیازهای پایه ─────────────────────────────────────────────────────
require_root() {
  [ "$(id -u)" -eq 0 ] || die "این اسکریپت باید با sudo یا کاربر root اجرا شود."
}

detect_os() {
  [ -r /etc/os-release ] || die "سیستم‌عامل شناسایی نشد (فایل /etc/os-release نیست)."
  # shellcheck disable=SC1091
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_LIKE="${ID_LIKE:-}"
  OS_NAME="${PRETTY_NAME:-$OS_ID}"

  case "$OS_ID $OS_LIKE" in
    *debian*|*ubuntu*) PKG=apt ;;
    *rhel*|*fedora*|*centos*|*almalinux*|*rocky*|*amzn*) PKG=dnf ;;
    *) die "توزیع «$OS_NAME» پشتیبانی نمی‌شود. اوبونتو/دبیان یا خانواده‌ی RHEL لازم است." ;;
  esac
  ok "سیستم‌عامل: $OS_NAME (مدیر بسته: $PKG)"
}

check_resources() {
  local mem_mb cores disk_gb
  mem_mb=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
  cores=$(nproc)
  disk_gb=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')

  MEM_MB="$mem_mb"
  say "  ${C_DIM}رم ${mem_mb}MB · ${cores} هسته · ${disk_gb}GB فضای آزاد${C_RESET}"
  [ "$disk_gb" -ge 8 ] || die "حداقل ۸ گیگابایت فضای آزاد لازم است (الان ${disk_gb}GB)."
  if [ "$mem_mb" -lt 1700 ]; then
    warn "رم زیر ۲ گیگ است. اجرا شدنی است ولی جای مانور ندارد."
  fi

  # تنظیم پستگرس متناسب با رم واقعی
  if   [ "$mem_mb" -lt 2500 ]; then PG_SHARED_BUFFERS=96MB;  PG_MAX_CONNECTIONS=40; PG_WORK_MEM=3MB
  elif [ "$mem_mb" -lt 5000 ]; then PG_SHARED_BUFFERS=256MB; PG_MAX_CONNECTIONS=80; PG_WORK_MEM=8MB
  else                              PG_SHARED_BUFFERS=512MB; PG_MAX_CONNECTIONS=150; PG_WORK_MEM=16MB
  fi
  # swap فقط برای بیلد محلی لازم است؛ در حالت ایمیج آماده اختیاری است.
  if [ "$SR_MODE" != "pull" ] && [ "$mem_mb" -lt 3500 ] && [ ! -f /swapfile ] && ! swapon --show 2>/dev/null | grep -q .; then
    warn "رم کم است — تلاش برای ساخت ۲ گیگ swap."
    set +e; trap - ERR
    ( fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none ) \
      && chmod 600 /swapfile && mkswap -q /swapfile && swapon /swapfile
    if [ $? -eq 0 ]; then
      grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
      ok "swap فعال شد"
    else
      rm -f /swapfile
      warn "ساخت swap ممکن نشد (احتمالاً سرور LXC/OpenVZ است). اگر بیلد به خاطر کمبود رم شکست خورد، پلن بالاتر لازم داری."
    fi
    set -e; trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR
  fi
}

install_base() {
  step "نصب پیش‌نیازها"
  if [ "$PKG" = apt ]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl git openssl jq >/dev/null
  else
    dnf install -y -q ca-certificates curl git openssl jq >/dev/null
  fi
  ok "curl، git، openssl و jq آماده‌اند"
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    ok "داکر از قبل نصب است ($(docker --version | cut -d, -f1))"
  else
    step "نصب داکر"
    curl -fsSL https://get.docker.com | sh >/dev/null
    ok "داکر نصب شد"
  fi
  systemctl enable --now docker >/dev/null 2>&1 || true
  docker compose version >/dev/null 2>&1 || die "پلاگین docker compose پیدا نشد."
}

# ── ۱) گرفتن ورودی‌ها ───────────────────────────────────────────────────────
ask() { # ask <متغیر> <پرسش> [پیش‌فرض]
  local var="$1" prompt="$2" def="${3:-}" cur ans
  cur="${!var:-}"
  if [ -n "$cur" ]; then return 0; fi
  if [ "$NONINTERACTIVE" = "1" ]; then
    [ -n "$def" ] || die "در حالت غیرتعاملی، متغیر $var باید از قبل تنظیم شود."
    printf -v "$var" '%s' "$def"; return 0
  fi
  if [ -n "$def" ]; then
    read -r -p "  $prompt [$def]: " ans </dev/tty || true
    printf -v "$var" '%s' "${ans:-$def}"
  else
    while [ -z "${ans:-}" ]; do read -r -p "  $prompt: " ans </dev/tty || true; done
    printf -v "$var" '%s' "$ans"
  fi
}

ask_secret() {
  local var="$1" prompt="$2" a b
  [ -n "${!var:-}" ] && return 0
  if [ "$NONINTERACTIVE" = "1" ]; then
    printf -v "$var" '%s' "$(openssl rand -base64 18)"
    GENERATED_ADMIN_PASSWORD="${!var}"
    return 0
  fi
  while :; do
    read -r -s -p "  $prompt: " a </dev/tty; echo
    read -r -s -p "  تکرار گذرواژه: " b </dev/tty; echo
    [ "$a" = "$b" ] || { warn "یکسان نبود، دوباره."; continue; }
    [ ${#a} -ge 10 ] || { warn "حداقل ۱۰ نویسه."; continue; }
    printf -v "$var" '%s' "$a"; break
  done
}

collect_input() {
  step "تنظیمات سرور"
  ask SR_DOMAIN "دامنه‌ای که به IP این سرور اشاره می‌کند (مثل chat.example.com)"
  ask SR_ACME_EMAIL "ایمیل برای گواهی TLS (Let's Encrypt)"
  ask ADMIN_USERNAME "نام کاربری مدیر" "admin"
  ask_secret ADMIN_PASSWORD "گذرواژه‌ی مدیر (حداقل ۱۰ نویسه)"

  # بررسی DNS — اگر دامنه به این سرور اشاره نکند، صدور گواهی شکست می‌خورد.
  local public_ip resolved
  public_ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || echo '')"
  resolved="$(getent ahostsv4 "$SR_DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || echo '')"
  if [ -n "$public_ip" ] && [ -n "$resolved" ] && [ "$public_ip" != "$resolved" ]; then
    warn "رکورد A دامنه ($resolved) با IP این سرور ($public_ip) یکی نیست."
    warn "اگر پشت Cloudflare هستی طبیعی است؛ وگرنه اول DNS را درست کن."
  elif [ -n "$resolved" ]; then
    ok "DNS درست است ($resolved)"
  else
    warn "دامنه هنوز resolve نمی‌شود؛ صدور گواهی ممکن است عقب بیفتد."
  fi
}

# ── ۲) کد و پیکربندی ───────────────────────────────────────────────────────
fetch_code() {
  step "دریافت کد"
  if [ -d "$INSTALL_DIR/.git" ]; then
    git -C "$INSTALL_DIR" remote set-url origin "$REPO_URL"
    git -C "$INSTALL_DIR" fetch --depth 1 origin "$BRANCH" -q
    git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH" -q
    ok "مخزن موجود به‌روز شد"
  else
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" -q
    ok "مخزن در $INSTALL_DIR کلون شد"
  fi
  # گیت بیت اجرا را همیشه نگه نمی‌دارد؛ دستی ست می‌کنیم.
  chmod +x "$INSTALL_DIR"/deploy/scripts/*.sh 2>/dev/null || true
}

write_env() {
  step "ساخت رمزها و فایل .env"
  local env_file="$INSTALL_DIR/deploy/.env"

  if [ -f "$env_file" ]; then
    ok "فایل .env از قبل هست؛ رمزهای موجود حفظ می‌شوند"
    # shellcheck disable=SC1090
    set -a; . "$env_file"; set +a
  fi

  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -hex 24)}"
  LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-API$(openssl rand -hex 6)}"
  LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-$(openssl rand -hex 32)}"
  TURN_SECRET="${TURN_SECRET:-$(openssl rand -hex 24)}"

  # کلید امضای آپدیت — یک‌بار ساخته می‌شود و باید در بکاپ بماند.
  local key_dir="$INSTALL_DIR/deploy/keys"
  mkdir -p "$key_dir"; chmod 700 "$key_dir"
  if [ ! -f "$key_dir/update-signing.key" ]; then
    openssl genpkey -algorithm ED25519 -out "$key_dir/update-signing.key" 2>/dev/null
    chmod 600 "$key_dir/update-signing.key"
    openssl pkey -in "$key_dir/update-signing.key" -pubout -outform DER 2>/dev/null \
      | tail -c 32 | base64 -w0 > "$key_dir/update-signing.pub"
    ok "جفت‌کلید Ed25519 برای امضای آپدیت ساخته شد"
  else
    ok "کلید امضای موجود حفظ شد"
  fi
  UPDATE_PUBKEY="$(cat "$key_dir/update-signing.pub")"
  UPDATE_SIGNING_KEY="$(base64 -w0 < "$key_dir/update-signing.key")"

  SR_IMAGE_WEB="${SR_IMAGE_WEB:-$GHCR_WEB}"
  SR_IMAGE_GATEWAY="${SR_IMAGE_GATEWAY:-$GHCR_GATEWAY}"

  umask 077
  cat > "$env_file" <<EOF
# ساخته‌شده توسط install.sh در $(date -Is)
# این فایل رمز دارد — هیچ‌وقت در گیت نگذار.
SR_DOMAIN=$SR_DOMAIN
SR_ACME_EMAIL=$SR_ACME_EMAIL
SR_VERSION=$SR_VERSION

POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DATABASE_URL=postgres://sr:$POSTGRES_PASSWORD@postgres:5432/srconnect

LIVEKIT_API_KEY=$LIVEKIT_API_KEY
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET
TURN_SECRET=$TURN_SECRET

UPDATE_PUBKEY=$UPDATE_PUBKEY
UPDATE_SIGNING_KEY=$UPDATE_SIGNING_KEY
NEXT_PUBLIC_UPDATE_PUBKEY=$UPDATE_PUBKEY
UPDATE_CHANNEL=stable

SR_IMAGE_WEB=$SR_IMAGE_WEB
SR_IMAGE_GATEWAY=$SR_IMAGE_GATEWAY

PG_SHARED_BUFFERS=$PG_SHARED_BUFFERS
PG_MAX_CONNECTIONS=$PG_MAX_CONNECTIONS
PG_WORK_MEM=$PG_WORK_MEM

SESSION_TTL_DAYS=30
ALLOW_REGISTRATION=1
REQUIRE_INVITE=0
VOICE_CAPACITY=20
NODE_ENV=production
EOF
  chmod 600 "$env_file"
  ok "فایل .env نوشته شد (دسترسی ۶۰۰)"
}

# ── ۳) فایروال ─────────────────────────────────────────────────────────────
PORTS_TCP="22 80 443 3478"
PORTS_UDP="443 3478"
PORTS_UDP_RANGE_UFW="50000:50400"
PORTS_UDP_RANGE_FWD="50000-50400"

# باز کردن پورت‌ها هیچ‌وقت نباید نصب را متوقف کند: روی بعضی VPS ها (LXC/OpenVZ،
# کرنل بدون netfilter، یا ufw نیمه‌خراب) این دستورها خطا می‌دهند ولی خود سرویس
# کاملاً سالم بالا می‌آید. پس کل این مرحله در حالت «بدون set -e» اجرا می‌شود.
open_firewall() {
  step "باز کردن پورت‌ها"
  local opened=0 failed=0 p
  set +e
  trap - ERR

  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi active; then
    for p in $PORTS_TCP;  do ufw allow "$p/tcp" >/dev/null 2>&1 || failed=1; done
    for p in $PORTS_UDP;  do ufw allow "$p/udp" >/dev/null 2>&1 || failed=1; done
    ufw allow "$PORTS_UDP_RANGE_UFW/udp" >/dev/null 2>&1 || failed=1
    opened=1
    if [ "$failed" = 1 ]; then
      warn "بعضی قانون‌های ufw ست نشد. خروجی خطا:"
      ufw allow 80/tcp 2>&1 | sed 's/^/      /' | head -5
    else
      ok "ufw تنظیم شد"
    fi
  elif command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    for p in 80/tcp 443/tcp 443/udp 3478/tcp 3478/udp "$PORTS_UDP_RANGE_FWD/udp"; do
      firewall-cmd --permanent --add-port="$p" >/dev/null 2>&1 || failed=1
    done
    firewall-cmd --reload >/dev/null 2>&1 || failed=1
    opened=1
    [ "$failed" = 1 ] && warn "بعضی قانون‌های firewalld ست نشد." || ok "firewalld تنظیم شد"
  fi

  if [ "$opened" != 1 ] || [ "$failed" = 1 ]; then
    warn "این پورت‌ها را دستی (یا در پنل فایروال ابری) باز کن:"
    say  "      TCP  80, 443, 3478"
    say  "      UDP  443, 3478, 50000-50400"
  fi

  set -e
  trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR
  return 0
}

# ── ۴) بالا آوردن سرویس‌ها ─────────────────────────────────────────────────
# سرویس‌ها یکی‌یکی بیلد می‌شوند نه موازی: روی سرور کوچک، بیلد موازی
# next و gateway با هم رم را تمام می‌کند و کرنل پروسه را می‌کشد.
build_one() { # build_one <service> <logfile>
  local svc="$1" log="$2" rc=0
  printf '  ساخت %-8s ' "$svc"
  set +e; trap - ERR
  docker compose build --pull "$svc" >>"$log" 2>&1
  rc=$?
  set -e; trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR
  if [ "$rc" -eq 0 ]; then printf '%s✔%s\n' "$C_OK" "$C_RESET"; else printf '%s✘%s\n' "$C_ERR" "$C_RESET"; fi
  return "$rc"
}

explain_build_failure() { # explain_build_failure <logfile>
  local log="$1"
  printf '\n%s✘ ساخت ایمیج‌ها شکست خورد.%s\n' "$C_ERR" "$C_RESET" >&2
  say "  ${C_DIM}──────── ۴۰ خط آخر لاگ ────────${C_RESET}"
  tail -40 "$log" | sed 's/^/    /' >&2
  say "  ${C_DIM}───────────────────────────────${C_RESET}"
  say "  لاگ کامل: ${C_B}$log${C_RESET}"
  say ""

  if grep -qiE 'killed|out of memory|oom-kill|Cannot allocate memory|JavaScript heap out of memory|signal: killed|exit code: 137' "$log"; then
    warn "علت محتمل: ${C_B}کمبود حافظه${C_RESET} هنگام بیلد."
    say  "      swap بساز و دوباره نصاب را اجرا کن:"
    say  "        sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile"
    say  "        sudo mkswap /swapfile && sudo swapon /swapfile"
    say  "      اگر سرورت LXC/OpenVZ است و swap نمی‌پذیرد، پلن با رم بیشتر لازم داری (حداقل ۴ گیگ)."
  elif grep -qiE 'no space left on device' "$log"; then
    warn "علت محتمل: ${C_B}دیسک پر است${C_RESET}."
    say  "      sudo docker system prune -af && df -h /"
  elif grep -qiE 'TLS handshake|i/o timeout|dial tcp|could not resolve|Temporary failure in name resolution|certificate|connection reset' "$log"; then
    warn "علت محتمل: ${C_B}مشکل شبکه یا تحریم${C_RESET} هنگام دانلود ایمیج/پکیج."
    say  "      یک آینه (registry mirror) یا پروکسی برای داکر و npm ست کن و دوباره اجرا کن."
  elif grep -qiE 'npm (ERR|error)|ERESOLVE|ENOTFOUND registry' "$log"; then
    warn "علت محتمل: ${C_B}نصب پکیج‌های npm${C_RESET} شکست خورد (شبکه یا رجیستری)."
  fi

  say ""
  say "  ${C_B}ساده‌ترین راه:${C_RESET} به‌جای بیلد، ایمیج آماده را بگیر —"
  say "        sudo SR_MODE=pull bash $INSTALL_DIR/deploy/scripts/install.sh"
  say "  بعد از رفع مشکل، همین نصاب را دوباره اجرا کن — چیزی از دست نمی‌رود."
  exit 1
}

# تلاش برای گرفتن ایمیج آماده. موفق شد ⇒ روی سرور هیچ بیلدی لازم نیست.
try_pull() { # try_pull <logfile>
  local log="$1" rc=0
  printf '  دریافت ایمیج‌های آماده '
  set +e; trap - ERR
  docker compose pull --quiet web gateway >>"$log" 2>&1
  rc=$?
  set -e; trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR
  if [ "$rc" -eq 0 ]; then printf '%s✔%s\n' "$C_OK" "$C_RESET"; else printf '%s—%s\n' "$C_DIM" "$C_RESET"; fi
  return "$rc"
}

switch_to_local_build() {
  SR_IMAGE_WEB="sr-connect/web:local"
  SR_IMAGE_GATEWAY="sr-connect/gateway:local"
  sed -i "s|^SR_IMAGE_WEB=.*|SR_IMAGE_WEB=$SR_IMAGE_WEB|;s|^SR_IMAGE_GATEWAY=.*|SR_IMAGE_GATEWAY=$SR_IMAGE_GATEWAY|" \
    "$INSTALL_DIR/deploy/.env"
  export SR_IMAGE_WEB SR_IMAGE_GATEWAY
}

build_and_start() {
  cd "$INSTALL_DIR/deploy"
  local log="$INSTALL_DIR/deploy/build.log"
  : > "$log"
  local mode="$SR_MODE"

  if [ "$mode" = auto ] || [ "$mode" = pull ]; then
    step "آماده‌سازی ایمیج‌ها"
    if try_pull "$log"; then
      ok "ایمیج‌های آماده دریافت شد — روی این سرور بیلدی انجام نمی‌شود"
      mode=done
    elif [ "$mode" = pull ]; then
      say ""
      tail -20 "$log" | sed 's/^/    /' >&2
      die "دریافت ایمیج آماده نشد. با SR_MODE=build دوباره اجرا کن تا روی خود سرور بیلد شود."
    else
      warn "ایمیج آماده در دسترس نبود؛ روی خود سرور بیلد می‌کنیم."
      if [ "${MEM_MB:-0}" -lt 3500 ] && ! swapon --show 2>/dev/null | grep -q .; then
        warn "با ${MEM_MB}MB رم و بدون swap، بیلد احتمالاً کشته می‌شود."
        say  "      پیشنهاد: اول swap بساز، بعد دوباره اجرا کن:"
        say  "        sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile"
        say  "        sudo mkswap /swapfile && sudo swapon /swapfile"
      fi
      mode=build
    fi
  fi

  if [ "$mode" = build ]; then
    switch_to_local_build
    step "ساخت ایمیج‌ها روی سرور (۵ تا ۱۵ دقیقه؛ خروجی کم است)"
    say "  ${C_DIM}لاگ زنده: tail -f $log${C_RESET}"
    build_one web     "$log" || explain_build_failure "$log"
    build_one gateway "$log" || explain_build_failure "$log"
    ok "ایمیج‌ها ساخته شدند"
  fi

  step "بالا آوردن سرویس‌ها"
  docker compose up -d --remove-orphans >/dev/null
  ok "کانتینرها اجرا شدند"

  local pg_ok=0
  printf '  در انتظار آماده شدن پستگرس'
  for _ in $(seq 1 60); do
    if docker compose exec -T postgres pg_isready -U sr -d srconnect >/dev/null 2>&1; then
      pg_ok=1; printf '\n'; ok "پستگرس آماده است"; break
    fi
    printf '.'; sleep 2
  done
  if [ "$pg_ok" != 1 ]; then
    printf '\n'
    dump_state "پستگرس بعد از ۱۲۰ ثانیه آماده نشد."
  fi
}

# وضعیت کامل سرویس‌ها را چاپ کن و خارج شو — هیچ خطایی نباید پنهان بماند.
dump_state() { # dump_state <پیام>
  set +e; trap - ERR
  cd "$INSTALL_DIR/deploy" 2>/dev/null
  printf '\n%s✘ %s%s\n\n' "$C_ERR" "$1" "$C_RESET" >&2
  say "  ${C_DIM}──────── وضعیت سرویس‌ها ────────${C_RESET}"
  docker compose ps 2>&1 | sed 's/^/    /' >&2
  for svc in web gateway postgres caddy; do
    say ""
    say "  ${C_DIM}──────── لاگ $svc (۲۵ خط آخر) ────────${C_RESET}"
    docker compose logs --tail=25 --no-color "$svc" 2>&1 | sed 's/^/    /' >&2
  done
  say ""
  say "  لاگ کامل: ${C_B}cd $INSTALL_DIR/deploy && docker compose logs --tail=200${C_RESET}"
  say "  بعد از رفع مشکل، همین نصاب را دوباره اجرا کن."
  exit 1
}

# اجرای یک دستور با نمایش خروجی، بدون قورت دادن کد خطا.
run_logged() { # run_logged <عنوان> <دستور...>
  local title="$1"; shift
  local out rc=0
  set +e; trap - ERR
  out="$("$@" 2>&1)"; rc=$?
  set -e; trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR
  [ -n "$out" ] && printf '%s\n' "$out" | sed 's/^/    /'
  if [ "$rc" -ne 0 ]; then dump_state "$title شکست خورد (کد $rc)."; fi
  return 0
}

migrate_and_seed() {
  step "مهاجرت دیتابیس و داده‌ی اولیه"
  cd "$INSTALL_DIR/deploy"

  # کانتینر web باید واقعاً در حال اجرا باشد وگرنه exec بی‌معنی است.
  local cid=""
  for _ in $(seq 1 30); do
    cid="$(docker compose ps -q web 2>/dev/null | head -1)"
    if [ -n "$cid" ] && [ "$(docker inspect -f '{{.State.Running}}' "$cid" 2>/dev/null)" = "true" ]; then
      break
    fi
    sleep 2; cid=""
  done
  [ -n "$cid" ] || dump_state "کانتینر web بالا نیامد، پس مهاجرت اجرا نشد."

  # اولین اتصال به دیتابیس گاهی چند ثانیه دیرتر جواب می‌دهد؛ چند بار تلاش می‌کنیم.
  local out rc=1 attempt
  for attempt in 1 2 3 4 5; do
    set +e; trap - ERR
    out="$(docker compose exec -T web node apps/web/scripts/migrate.mjs 2>&1)"; rc=$?
    set -e; trap 'on_error "$LINENO" "$BASH_COMMAND"' ERR
    [ "$rc" -eq 0 ] && break
    [ "$attempt" -lt 5 ] && { printf '  تلاش %s ناموفق، دوباره…\n' "$attempt"; sleep 5; }
  done
  [ -n "$out" ] && printf '%s\n' "$out" | sed 's/^/    /'
  if [ "$rc" -ne 0 ]; then dump_state "مهاجرت دیتابیس شکست خورد (کد $rc)."; fi

  run_logged "ساخت داده‌ی اولیه" \
    docker compose exec -T \
      -e ADMIN_USERNAME="$ADMIN_USERNAME" \
      -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
      web node apps/web/scripts/seed.mjs

  ok "نقش‌ها، کانال‌ها و کاربر مدیر آماده‌اند"
}

install_service() {
  step "فعال‌سازی راه‌اندازی خودکار"
  if [ -d /run/systemd/system ]; then
    install -m 644 "$INSTALL_DIR/deploy/systemd/sr-connect.service" /etc/systemd/system/sr-connect.service
    sed -i "s|/opt/sr-connect|$INSTALL_DIR|g" /etc/systemd/system/sr-connect.service
    systemctl daemon-reload
    systemctl enable sr-connect.service >/dev/null 2>&1
    ok "سرویس systemd فعال شد (بعد از ریبوت خودکار بالا می‌آید)"
  else
    warn "systemd نیست؛ restart policy داکر (unless-stopped) کار را انجام می‌دهد."
  fi
}

verify() {
  step "بررسی سلامت"
  cd "$INSTALL_DIR/deploy"
  local healthy=0
  for _ in $(seq 1 45); do
    if curl -fsS --max-time 4 "http://127.0.0.1:80" -H "Host: $SR_DOMAIN" -o /dev/null 2>/dev/null \
       || curl -fsSk --max-time 4 "https://$SR_DOMAIN/api/health" -o /dev/null 2>/dev/null; then
      healthy=1; break
    fi
    sleep 2
  done
  if [ "$healthy" = 1 ]; then ok "وب پاسخ می‌دهد"; else warn "وب هنوز پاسخ نمی‌دهد؛ گواهی TLS ممکن است چند دقیقه طول بکشد."; fi
  docker compose ps --format '    {{.Service}}\t{{.Status}}' 2>/dev/null || true
}

finish() {
  cat <<EOF

${C_OK}${C_B}  نصب تمام شد.${C_RESET}

  آدرس:        ${C_B}https://$SR_DOMAIN${C_RESET}
  مدیر:        $ADMIN_USERNAME
EOF
  if [ -n "${GENERATED_ADMIN_PASSWORD:-}" ]; then
    say "  گذرواژه:     ${C_B}${GENERATED_ADMIN_PASSWORD}${C_RESET}  ${C_DIM}(ساخته شد — همین حالا جایی ذخیره کن)${C_RESET}"
  fi
  cat <<EOF

  ${C_DIM}دستورهای روزمره:${C_RESET}
    وضعیت:     cd $INSTALL_DIR/deploy && docker compose ps
    لاگ زنده:  cd $INSTALL_DIR/deploy && docker compose logs -f web gateway
    آپدیت:     sudo bash $INSTALL_DIR/deploy/scripts/update.sh
    بکاپ:      sudo bash $INSTALL_DIR/deploy/scripts/backup.sh
    سلامت:     sudo bash $INSTALL_DIR/deploy/scripts/health.sh
    حذف:       sudo bash $INSTALL_DIR/deploy/scripts/uninstall.sh

  ${C_WARN}مهم:${C_RESET} از $INSTALL_DIR/deploy/keys و deploy/.env بکاپ بگیر.
  کلید امضای آپدیت اگر گم شود، کلاینت‌های قدیمی نسخه‌های بعدی را قبول نمی‌کنند.

EOF
}

main() {
  banner
  require_root
  detect_os
  check_resources
  install_base
  install_docker
  collect_input
  fetch_code
  write_env
  open_firewall
  build_and_start
  migrate_and_seed
  install_service
  verify
  finish
}

main "$@"
