<div align="center">

# 🎧 SR-Connect

**یک جایگزین self-hosted برای Discord + TeamSpeak — روی سرور خودت.**

چت متنی بلادرنگ • کانال صوتی با کیفیت بالا (WebRTC/SFU) • نقش و دسترسی • سیستم آپدیت هوشمند امضاشده

[![CI](https://github.com/SRNetWork-ai/SR-Connect/actions/workflows/ci.yml/badge.svg)](https://github.com/SRNetWork-ai/SR-Connect/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

</div>

---

## ⚡ نصب یک‌خطی

روی یک سرور تازه (Ubuntu 22.04+ / Debian 12+ / Rocky 9+) با دسترسی root:

```bash
curl -fsSL https://raw.githubusercontent.com/SRNetWork-ai/SR-Connect/main/deploy/scripts/install.sh | sudo bash
```

یا اگر می‌خواهی اول اسکریپت را ببینی (توصیه‌شده):

```bash
curl -fsSLO https://raw.githubusercontent.com/SRNetWork-ai/SR-Connect/main/deploy/scripts/install.sh
less install.sh
sudo bash install.sh
```

نصب‌کننده به‌صورت **کاملاً خودکار** این کارها را انجام می‌دهد:

| مرحله | کار                                                 |
| ----- | --------------------------------------------------- |
| 1     | تشخیص سیستم‌عامل (apt / dnf) و نصب پیش‌نیازها       |
| 2     | بررسی CPU/RAM/دیسک و ساخت swap در صورت نیاز         |
| 3     | نصب Docker + Docker Compose plugin                  |
| 4     | گرفتن دامنه و ایمیل، و بررسی رکورد DNS              |
| 5     | کلون پروژه در `/opt/sr-connect`                     |
| 6     | تولید همهٔ رمزها + کلید امضای Ed25519               |
| 7     | نوشتن `deploy/.env` با دسترسی `600`                 |
| 8     | باز کردن پورت‌های فایروال (ufw / firewalld)         |
| 9     | دریافت ایمیج‌های آمادهٔ GHCR و بالا آوردن کانتینرها |
| 10    | اجرای migration، ساخت ادمین و دیتای اولیه           |
| 11    | فعال‌سازی سرویس systemd برای استارت خودکار          |
| 12    | تست سلامت و نمایش خلاصهٔ اطلاعات ورود               |

TLS با **Caddy** و Let's Encrypt به‌صورت خودکار گرفته و تمدید می‌شود.

> 💡 **روی سرور بیلد نمی‌شود.** ایمیج‌های آماده از GHCR کشیده می‌شوند، پس نصب روی
> **۱ هسته / ۲ گیگ رم** هم کار می‌کند و دو دقیقه بیشتر طول نمی‌کشد.
> اگر بخواهی روی خود سرور بیلد شود: `sudo SR_MODE=build bash install.sh` (آنجا ۴ گیگ رم لازم است).

---

## 🧩 امکانات

### چت

- کانال‌های متنی با دسته‌بندی (Category → Channel)
- پیام بلادرنگ روی WebSocket، بدون polling
- **ویرایش و حذف پیام** (حذف نرم + ثبت در audit log)
- **ری‌اکشن ایموجی** با شمارنده و به‌روزرسانی خوش‌بینانه
- **پاسخ (reply)** با پیش‌نمایش پیام مرجع
- **مارک‌داون**: `**bold**`، `*italic*`، `~~strike~~`، `` `code` ``، بلوک کد،
  نقل‌قول، لیست، لینک، `||اسپویلر||` و منشن — همه بدون `innerHTML`
- **پیوست فایل و تصویر** با drag & drop، paste، گالری و lightbox
- **شمارندهٔ خوانده‌نشده و منشن** برای هر کانال
- نشانگر «در حال تایپ»، وضعیت آنلاین/بی‌کار/مزاحم‌نشوید/نامرئی
- تاریخچهٔ پیام با صفحه‌بندی keyset

### صدا

- کانال صوتی مبتنی بر **LiveKit (SFU)** — مصرف پهنای باند خطی، نه n²
- Opus + DTX + Echo Cancellation + Noise Suppression
- Push-to-Talk و Voice Activity Detection
- نشانگر «چه کسی حرف می‌زند»، Mute/Deafen محلی و سروری
- **اشتراک صفحه** با صدای سیستم (۷۲۰p) و نمایشگر چندنفره
- سرور **coturn** داخلی برای عبور از NAT سخت‌گیر

### دسترسی‌ها

- ۱۹ permission bit در قالب یک bitmask
- نقش‌های رنگی با اولویت، و override در سطح کانال
- `ADMINISTRATOR` همهٔ بیت‌ها را override می‌کند

### سیستم آپدیت هوشمند

- سرور نسخه را منتشر می‌کند، کلاینت‌ها خودکار باخبر می‌شوند
- هر پکیج با **Ed25519** امضا می‌شود و کلاینت با WebCrypto صحت را بررسی می‌کند
- آپدیت سرور با یک دستور: `sr-connect update` (با rollback خودکار در صورت خطا)

### امنیت

- **CSP سخت‌گیرانه با nonce** (`strict-dynamic`، بدون `unsafe-inline` برای اسکریپت)
- **rate limit واقعی** روی ورود، ثبت‌نام، پیام، ری‌اکشن، ویرایش، آپلود و تیکت
- آپلود با allow-list نوع فایل، نام تصادفی روی دیسک و سرو با `sandbox`
- گذرواژه با scrypt، نشست فقط به‌صورت hash در دیتابیس

### ظاهر

- تم تیرهٔ الهام‌گرفته از Discord، فارسی و **RTL-first**
- فونت Vazirmatn، انیمیشن‌های فنری با Framer Motion (layout animation، لیست‌های روان)
- پروفایل با آواتار، بیو و پالت رنگ؛ اسکلت بارگذاری، toast و tooltip
- کاملاً واکنش‌گرا (موبایل/دسکتاپ) و سازگار با «کاهش انیمیشن» سیستم‌عامل

### تست

- **Vitest** برای واحد (دسترسی‌ها، semver، rate limit، مارک‌داون، آپلود، قرارداد)
- **Playwright** برای E2E روی بیلد واقعی + پستگرس در CI

---

## 🏗️ معماری

```
                         ┌──────────────┐
             HTTPS :443  │    Caddy     │  TLS خودکار (Let's Encrypt)
        ────────────────▶│ reverse proxy│
                         └──────┬───────┘
                   ┌────────────┼─────────────┐
                   ▼            ▼             ▼
            ┌────────────┐ ┌─────────┐  ┌───────────┐
            │  apps/web  │ │ gateway │  │  LiveKit  │
            │  Next.js15 │ │   ws    │  │    SFU    │
            │  App Router│ │  :8787  │  │   :7880   │
            └─────┬──────┘ └────┬────┘  └─────┬─────┘
                  │             │             │
                  │  LISTEN/NOTIFY (sr_events)│  UDP 50000-50400
                  ▼             ▼             ▼
            ┌───────────────────────┐   ┌──────────┐
            │   PostgreSQL 16       │   │  coturn  │
            └───────────────────────┘   └──────────┘
```

- **apps/web** — Next.js 15 (App Router, RSC) + همهٔ REST API ها
- **apps/gateway** — سرور WebSocket سبک روی Node، فقط fan-out رویدادها
- **packages/protocol** — تایپ‌ها، permission bits و قرارداد پیام‌ها، مشترک بین هر دو
- **PostgreSQL** — منبع حقیقت + کانال pub/sub با `LISTEN/NOTIFY` (بدون نیاز به Redis)
- **LiveKit** — SFU صوتی، روی `network_mode: host` برای کارایی UDP
- **coturn** — TURN/STUN برای کاربران پشت NAT

مسیر احراز هویت WebSocket: کوکی نشست `httpOnly` است، پس کلاینت اول از
`POST /api/realtime/ticket` یک **تیکت یک‌بارمصرف ۶۰ ثانیه‌ای** می‌گیرد و آن را به gateway می‌دهد.

---

## 📦 نیازمندی سرور

| منابع      | حداقل                              | پیشنهادی (۲۰ کاربر همزمان) |
| ---------- | ---------------------------------- | -------------------------- |
| CPU        | 1 vCPU                             | 2 vCPU                     |
| RAM        | **2 GB**                           | 4 GB                       |
| دیسک       | 15 GB                              | 30 GB SSD                  |
| پهنای باند | 5 Mbps                             | 20 Mbps بالادست            |
| OS         | Ubuntu 22.04 / Debian 12 / Rocky 9 | Ubuntu 24.04               |

یک دامنه (یا ساب‌دامنه) که رکورد `A` آن به IP سرور اشاره کند، لازم است.

---

## 🛠️ دستورهای مدیریتی

بعد از نصب، این دستورها در `/opt/sr-connect/deploy/scripts/` در دسترس‌اند:

```bash
sudo bash /opt/sr-connect/deploy/scripts/doctor.sh      # عیب‌یابی کامل
sudo bash /opt/sr-connect/deploy/scripts/doctor.sh --fix # عیب‌یابی + اصلاح خودکار
sudo bash /opt/sr-connect/deploy/scripts/health.sh      # وضعیت سرویس‌ها
sudo bash /opt/sr-connect/deploy/scripts/update.sh      # آپدیت + rollback خودکار
sudo bash /opt/sr-connect/deploy/scripts/backup.sh      # بکاپ کامل
sudo bash /opt/sr-connect/deploy/scripts/restore.sh     # بازیابی از بکاپ
sudo bash /opt/sr-connect/deploy/scripts/uninstall.sh   # حذف کامل
```

یا با `make` از ریشهٔ پروژه: `make up`، `make down`، `make logs`، `make health`، `make backup`.

---

## 💻 اجرای محلی (توسعه)

```bash
git clone https://github.com/SRNetWork-ai/SR-Connect.git
cd SR-Connect
npm install
cp .env.example .env            # مقادیر را پر کن
npm run keygen -- deploy/keys   # کلید امضای آپدیت
npm run migrate && npm run seed

npm run dev                     # وب روی http://localhost:3000
npm run dev:gateway             # در ترمینال دوم — gateway روی :8787
```

تست‌ها:

```bash
npm test                        # واحد (Vitest)
npx playwright install chromium
npm run test:e2e                # E2E روی بیلد واقعی
```

بدون `DATABASE_URL` هم برنامه بالا می‌آید و روی **حالت دمو (in-memory)** کار می‌کند
تا بتوانی UI را ببینی.

---

## 📚 مستندات

| فایل                                         | توضیح                               |
| -------------------------------------------- | ----------------------------------- |
| [docs/INSTALL.md](docs/INSTALL.md)           | نصب گام‌به‌گام، نصب دستی، عیب‌یابی  |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | معماری، اسکیمای دیتابیس، جریان داده |
| [docs/UPDATES.md](docs/UPDATES.md)           | سیستم آپدیت و امضای Ed25519         |
| [docs/SECURITY.md](docs/SECURITY.md)         | مدل تهدید، مدیریت کلید، سخت‌سازی    |
| [docs/API.md](docs/API.md)                   | مرجع REST API و پروتکل WebSocket    |

---

## 📄 مجوز

[MIT](./LICENSE) © SR-Connect
