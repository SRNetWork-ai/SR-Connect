# سیستم آپدیت هوشمند

SR-Connect دو نوع آپدیت دارد که نباید با هم اشتباه شوند:

| نوع | چه چیزی آپدیت می‌شود | چطور |
|---|---|---|
| **آپدیت سرور** | خود نصب روی سرور شما | `update.sh` (git pull + rebuild) |
| **آپدیت کلاینت** | اپ دسکتاپ/موبایل کاربران | پکیج امضاشده که سرور منتشر می‌کند |

---

## ۱. آپدیت سرور

```bash
sudo bash /opt/sr-connect/deploy/scripts/update.sh
```

مراحل:

```
backup.sh  ──▶  git fetch && git reset --hard origin/main
           ──▶  docker compose build
           ──▶  docker compose up -d
           ──▶  migrate.mjs
           ──▶  health.sh
                   │
          ✅ موفق ─┴─ ❌ شکست ──▶ بازگشت خودکار به commit قبلی + restore دیتابیس
```

اگر health check رد شود، اسکریپت **بدون دخالت شما** به وضعیت قبلی برمی‌گردد.
هیچ‌وقت سرور در حالت نیمه‌آپدیت رها نمی‌شود.

---

## ۲. آپدیت کلاینت (امضاشده)

### چرا امضا؟

کلاینت باید مطمئن شود پکیجی که دانلود کرده واقعاً از سرور شما آمده و
دستکاری نشده — حتی اگر CDN یا مسیر شبکه آلوده باشد.

### الگوریتم

```
1) سرور:   digest = SHA-256(package)            → رشتهٔ hex
2) سرور:   signature = Ed25519_sign(privKey, digest_hex_string)
3) سرور:   manifest = { version, url, digest, signature, notes, publishedAt }
4) کلاینت: دانلود پکیج → SHA-256 محاسبه → مقایسه با digest
5) کلاینت: WebCrypto.verify('Ed25519', pubKey, signature, digest_hex_string)
6) فقط اگر هر دو ✅ بود، نصب انجام می‌شود
```

> نکته: امضا روی **رشتهٔ hex دایجست** انجام می‌شود، نه روی بایت‌های خام فایل.
> این باعث می‌شود امضا کردن فایل‌های بزرگ بدون بارگذاری کامل در حافظه ممکن باشد.

### تولید کلید

```bash
npm run keygen -- deploy/keys   # ← deploy/keys/update-signing.{key,pub}
```

خروجی:
- `update-signing.key` — کلید خصوصی Ed25519 به‌صورت PEM (**هرگز کامیت نکن**، `chmod 600`)
- `update-signing.pub` — کلید عمومی، base64 خام ۳۲ بایتی — همان چیزی که WebCrypto می‌خواهد

در `.env`:
```
UPDATE_SIGNING_KEY=<base64 -w0 از فایل PEM خصوصی>
UPDATE_PUBKEY=<محتوای update-signing.pub>
NEXT_PUBLIC_UPDATE_PUBKEY=<همان مقدار>
```

### امضا و انتشار یک نسخه

```bash
npm run sign-release -- \
  --version 1.1.0 \
  --file    ./dist/sr-connect-1.1.0.zip \
  --channel stable \
  --notes   "رفع باگ قطع صدا" \
  --notes   "بهبود سرعت لود" \
  [--mandatory] [--rollout 25] [--min-client 1.0.0]
```

این دستور:
1. دایجست SHA-256 را حساب می‌کند
2. با `UPDATE_SIGNING_KEY` امضا می‌زند
3. فایل را در `RELEASES_DIR` کپی می‌کند
4. رکورد را در جدول `releases` می‌نویسد و `pg_notify` می‌زند

اگر `DATABASE_URL` ست نباشد (مثلاً داخل CI)، فقط امضا و manifest ساخته
می‌شود و چیزی در دیتابیس نوشته نمی‌شود.

سپس در پنل ادمین (`/app/updates`) می‌توانی نسخه را **منتشر** یا **عقب‌گرد** کنی.

### مسیرهای API

| مسیر | کار |
|---|---|
| `GET /api/version?platform=win&channel=stable` | manifest نسخهٔ فعلی |
| `GET /api/artifact/:name` | دانلود فایل پکیج |
| `GET /api/admin/releases` | فهرست همهٔ نسخه‌ها (ادمین) |
| `PATCH /api/admin/releases` | انتشار / لغو انتشار / تغییر کانال |

### کانال‌های انتشار و انتشار تدریجی

`stable` (پیش‌فرض) • `beta` • `dev`

با `--rollout 25` فقط ۲۵٪ کلاینت‌ها نسخهٔ جدید را می‌بینند (staged rollout).
با `--mandatory` آپدیت اجباری می‌شود و کلاینت تا نصب نکند کار نمی‌کند.
با `--min-client 1.0.0` نسخه‌های قدیمی‌تر مجبور به آپدیت می‌شوند.

هر کلاینت فقط نسخه‌های کانال خودش را می‌بیند. می‌توانی یک نسخه را اول روی
`beta` بگذاری، بازخورد بگیری و بعد به `stable` ارتقا بدهی.

### اطلاع‌رسانی بلادرنگ

وقتی نسخهٔ جدیدی منتشر می‌شود، gateway پیام `version_hint` را به همهٔ
کلاینت‌های متصل push می‌کند و `UpdateBanner` بالای اپ ظاهر می‌شود —
بدون نیاز به polling.

---

## ۳. چرخش کلید (Key Rotation)

اگر کلید خصوصی لو رفت:

```bash
mv deploy/keys/update-signing.key deploy/keys/update-signing.key.old
npm run keygen -- deploy/keys                     # جفت‌کلید تازه
# UPDATE_SIGNING_KEY و UPDATE_PUBKEY را در deploy/.env به‌روز کن، بعد:
npm run sign-release -- --version <هر-نسخهٔ-فعال> --file <آرتیفکت>
```

سپس کلاینت‌های جدید را با کلید عمومی تازه منتشر کن.
کلاینت‌های قدیمی که کلید عمومی قبلی را دارند، باید **دستی** آپدیت شوند —
به همین دلیل کلید خصوصی را جدی بگیر.

---

## ۴. انتشار خودکار با GitHub Actions

ورک‌فلو `.github/workflows/release.yml` وقتی یک تگ `v*` پوش شود:

1. بیلد می‌کند
2. با secret به نام `UPDATE_SIGNING_KEY` امضا می‌زند
3. GitHub Release می‌سازد و فایل‌ها + `manifest.json` را آپلود می‌کند

برای فعال کردنش، در `Settings → Secrets and variables → Actions`
یک secret به نام `UPDATE_SIGNING_KEY` بساز و محتوای `update-signing.key` را در آن بگذار.

```bash
git tag v1.1.0 && git push origin v1.1.0
```
