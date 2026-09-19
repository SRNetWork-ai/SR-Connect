# نصب SR-Connect

## ۱. نصب خودکار (پیشنهادی)

### پیش‌نیازها
- سرور تازه با Ubuntu 22.04+ / Debian 12+ / Rocky|Alma 9+
- دسترسی `root` یا `sudo`
- یک دامنه یا ساب‌دامنه با رکورد `A` که به IP سرور اشاره کند
- پورت‌های باز: `80/tcp`، `443/tcp`، `443/udp`، `3478/tcp+udp`، `50000-50400/udp`

### اجرا

```bash
curl -fsSL https://raw.githubusercontent.com/SRNetWork-ai/SR-Connect/main/deploy/scripts/install.sh | sudo bash
```

اسکریپت به‌صورت تعاملی این‌ها را می‌پرسد:

| پرسش | متغیر | نمونه |
|---|---|---|
| دامنه‌ای که به IP این سرور اشاره می‌کند | `SR_DOMAIN` | `chat.example.com` |
| ایمیل برای گواهی TLS | `SR_ACME_EMAIL` | `you@example.com` |
| نام کاربری مدیر | `ADMIN_USERNAME` | `admin` |
| گذرواژهٔ مدیر | `ADMIN_PASSWORD` | حداقل ۱۰ نویسه — خالی بگذاری خودش می‌سازد |

### حالت غیرتعاملی

برای اتوماسیون، متغیرها را از قبل ست کن:

```bash
curl -fsSLO https://raw.githubusercontent.com/SRNetWork-ai/SR-Connect/main/deploy/scripts/install.sh
sudo SR_DOMAIN=chat.example.com \
     SR_ACME_EMAIL=you@example.com \
     ADMIN_USERNAME=ali \
     ADMIN_PASSWORD='یک-رمز-قوی-حداقل-۱۰-نویسه' \
     NONINTERACTIVE=1 \
     bash install.sh
```

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `SR_DOMAIN` | — | اجباری |
| `SR_ACME_EMAIL` | — | اجباری |
| `ADMIN_USERNAME` | `admin` | |
| `ADMIN_PASSWORD` | ساخته می‌شود | حداقل ۱۰ نویسه |
| `NONINTERACTIVE` | `0` | `1` = بدون پرسش |
| `SR_VERSION` | `1.0.0` | |
| `INSTALL_DIR` | `/opt/sr-connect` | |

### بعد از نصب

اسکریپت در پایان این‌ها را چاپ می‌کند:

```
 آدرس       : https://chat.example.com
 ادمین      : admin
 رمز        : ********
 مسیر نصب   : /opt/sr-connect
 فایل env   : /opt/sr-connect/deploy/.env   (chmod 600)
 کلیدها     : /opt/sr-connect/deploy/keys/  (پشتیبان بگیر!)
```

> ⚠️ **حتماً** از `deploy/.env` و پوشهٔ `deploy/keys/` بکاپ بگیر.
> اگر کلید خصوصی امضا را از دست بدهی، دیگر نمی‌توانی آپدیت امضاشده منتشر کنی
> و همهٔ کلاینت‌های قدیمی باید کلید عمومی جدید را بگیرند.

---

## ۲. نصب دستی با Docker Compose

```bash
git clone https://github.com/SRNetWork-ai/SR-Connect.git /opt/sr-connect
cd /opt/sr-connect

cp .env.example deploy/.env
chmod 600 deploy/.env
nano deploy/.env      # همهٔ مقادیر CHANGE_ME را پر کن

# تولید کلید امضای Ed25519
npm install
npm run keygen -- deploy/keys

cd deploy
docker compose build
docker compose up -d
docker compose exec -T web node apps/web/scripts/migrate.mjs
docker compose exec -T web node apps/web/scripts/seed.mjs
```

### تولید رمزها به‌صورت دستی

```bash
openssl rand -hex 24      # POSTGRES_PASSWORD
openssl rand -hex 32      # SESSION_SECRET
openssl rand -hex 32      # LIVEKIT_API_SECRET
openssl rand -hex 24      # TURN_SECRET
openssl rand -hex 16      # GATEWAY_SHARED_SECRET
```

---

## ۳. نصب بدون Docker (bare metal)

فقط اگر Docker برایت ممکن نیست.

```bash
# Node 20+ و PostgreSQL 16
sudo apt install -y nodejs npm postgresql-16
sudo -u postgres createuser -P srconnect
sudo -u postgres createdb -O srconnect srconnect

git clone https://github.com/SRNetWork-ai/SR-Connect.git /opt/sr-connect
cd /opt/sr-connect
npm install
npm run keygen -- deploy/keys
cp .env.example .env && nano .env
npm run migrate && npm run seed
npm run build
npm start --workspace @sr/web &
npm start --workspace @sr/gateway &
```

LiveKit و coturn را جداگانه از مستندات خودشان نصب کن و
`LIVEKIT_URL` / `TURN_*` را در `.env` به آن‌ها اشاره بده.
فایل `deploy/systemd/sr-connect.service` را برای اجرای دائمی کپی کن.

---

## ۴. عیب‌یابی

<details>
<summary><b>گواهی TLS گرفته نمی‌شود</b></summary>

```bash
cd /opt/sr-connect/deploy && docker compose logs caddy --tail=100
```
- مطمئن شو رکورد `A` دامنه دقیقاً به IP سرور اشاره می‌کند: `dig +short chat.example.com`
- پورت ۸۰ نباید توسط nginx/apache گرفته شده باشد: `sudo ss -lntp | grep :80`
- Let's Encrypt محدودیت نرخ دارد؛ در تست از `--staging` استفاده کن.
</details>

<details>
<summary><b>صدا وصل می‌شود ولی کسی صدای کسی را نمی‌شنود</b></summary>

تقریباً همیشه مشکل UDP است.
```bash
sudo ufw status | grep 50000        # باید 50000:50400/udp باز باشد
docker compose logs livekit --tail=80
```
- در VPS هایی مثل Hetzner/OVH فایروال پنل هم باید باز شود، نه فقط ufw.
- `LIVEKIT_NODE_IP` در `deploy/.env` باید IP **عمومی** سرور باشد.
- اگر شبکه‌ی کاربر UDP را می‌بندد، coturn روی `443/tcp` بازگشت (fallback) می‌دهد.
</details>

<details>
<summary><b>WebSocket وصل نمی‌شود (کد ۴۴۰۱)</b></summary>

یعنی تیکت نامعتبر یا منقضی است.
- ساعت سرور را همگام کن: `timedatectl set-ntp true`
- `GATEWAY_SHARED_SECRET` باید در web و gateway یکی باشد.
- `docker compose logs gateway --tail=60`
</details>

<details>
<summary><b>دیتابیس بالا نمی‌آید</b></summary>

```bash
docker compose logs postgres --tail=80
docker compose exec postgres pg_isready -U srconnect
```
اگر `POSTGRES_PASSWORD` را بعد از اولین اجرا عوض کرده‌ای، volume قدیمی رمز قبلی را دارد.
یا رمز را برگردان یا volume را پاک کن (⚠️ دیتا می‌رود).
</details>

<details>
<summary><b>حافظه کم می‌آورد هنگام بیلد</b></summary>

نصب‌کننده خودش swap می‌سازد، ولی اگر دستی نصب می‌کنی:
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
</details>

---

## ۵. آپدیت و بکاپ

```bash
sudo bash /opt/sr-connect/deploy/scripts/update.sh   # بکاپ → pull → build → migrate → health
sudo bash /opt/sr-connect/deploy/scripts/backup.sh   # بکاپ دستی (۱۴ نسخهٔ آخر نگه داشته می‌شود)
sudo bash /opt/sr-connect/deploy/scripts/restore.sh  # بازیابی
```

`update.sh` اگر health check بعد از آپدیت رد شود، **خودکار به commit قبلی برمی‌گردد**.

### بکاپ خودکار شبانه

```bash
sudo crontab -e
# هر شب ساعت ۳:۳۰
30 3 * * * bash /opt/sr-connect/deploy/scripts/backup.sh >> /var/log/sr-connect-backup.log 2>&1
```
