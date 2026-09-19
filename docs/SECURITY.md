# امنیت

## مدل تهدید

| تهدید | دفاع |
|---|---|
| شنود ترافیک | TLS 1.3 اجباری با Caddy + HSTS |
| دزدی کوکی با XSS | کوکی `httpOnly` + `Secure` + `SameSite=Lax` + CSP |
| CSRF | `SameSite=Lax` + بررسی مبدأ روی درخواست‌های تغییردهنده |
| Brute-force رمز | rate limit روی login، تأخیر نمایی |
| دزدی توکن WebSocket | تیکت یک‌بارمصرف ۶۰ ثانیه‌ای |
| دسترسی غیرمجاز به کانال | بررسی bitmask سمت سرور روی **هر** درخواست |
| پکیج آپدیت دستکاری‌شده | امضای Ed25519 + بررسی SHA-256 |
| SQL Injection | فقط prepared statement با پارامتر (`pg`) |
| نشت رمز عبور از دیتابیس | `scrypt` با salt یکتا برای هر کاربر |
| ورود به سرور | فقط پورت‌های لازم باز، systemd با کاربر غیر root |

---

## مدیریت رمزها

همهٔ رمزها در `deploy/.env` با دسترسی `600` نگهداری می‌شوند:

| متغیر | تولید | نقش |
|---|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` | دسترسی دیتابیس |
| `SESSION_SECRET` | `openssl rand -hex 32` | امضای کوکی نشست |
| `LIVEKIT_API_SECRET` | `openssl rand -hex 32` | صدور توکن صوتی |
| `TURN_SECRET` | `openssl rand -hex 24` | اعتبارسنجی TURN |
| `GATEWAY_SHARED_SECRET` | `openssl rand -hex 16` | اعتماد web ↔ gateway |

نصب‌کننده همهٔ این‌ها را خودش می‌سازد. **هیچ‌کدام مقدار پیش‌فرض ندارند.**

### کلید امضای آپدیت

```
deploy/keys/update-signing.key   ← خصوصی، chmod 600، هرگز کامیت نکن
deploy/keys/update-signing.pub   ← عمومی، در کلاینت embed می‌شود
```

`.gitignore` پوشهٔ `deploy/keys/` را کامل نادیده می‌گیرد.

> کلید عمومی فاز ۱ (`kiFCRFXDnw45qH20n/a6+4XEhN0uOg8/Hm7DS7BktO4=`)
> فقط برای **دمو و توسعه** است. نصب‌کننده حتماً کلید تازه می‌سازد.

---

## رمز عبور

```
scrypt(password, salt=random(16), N=16384, r=8, p=1, dkLen=64)
ذخیره: scrypt$N$r$p$<salt_b64>$<hash_b64>
مقایسه: timingSafeEqual
```

سیاست: حداقل ۸ کاراکتر. رمزهای رایج رد می‌شوند.
پیشنهاد: MFA را در نسخه‌های بعدی اضافه کن.

---

## هدرهای امنیتی

در `apps/web/next.config.ts`:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), geolocation=(), payment=()
```

میکروفون عمداً اجازه دارد (برای کانال صوتی)، دوربین بسته است.

---

## سخت‌سازی سرور (پیشنهادی)

```bash
# ورود با کلید SSH، بدون رمز
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl reload sshd

# fail2ban
sudo apt install -y fail2ban && sudo systemctl enable --now fail2ban

# آپدیت خودکار امنیتی
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### پورت‌هایی که باید باز باشند

| پورت | پروتکل | برای |
|---|---|---|
| 80 | TCP | ریدایرکت HTTP و چالش ACME |
| 443 | TCP | HTTPS + WSS |
| 443 | UDP | HTTP/3 و fallback صدا |
| 3478 | TCP+UDP | STUN/TURN |
| 50000–50400 | UDP | مدیای LiveKit |

**هیچ پورت دیگری نباید از بیرون باز باشد.** به‌خصوص `5432` (Postgres)
و `8787` (gateway) فقط داخل شبکهٔ داکر در دسترس‌اند.

---

## بکاپ

`backup.sh` این‌ها را می‌گیرد و ۱۴ نسخهٔ آخر را نگه می‌دارد:

- `pg_dump` کامل دیتابیس
- `deploy/.env`
- `deploy/keys/`
- `deploy/releases/`

بکاپ‌ها رمز نشده‌اند — آن‌ها را جای امن و خارج از سرور نگه دار.
برای رمزگذاری:

```bash
gpg -c /opt/sr-connect/backups/sr-connect-*.tar.gz
```

---

## گزارش آسیب‌پذیری

اگر مشکل امنیتی پیدا کردی، لطفاً **issue عمومی نساز**.
یک security advisory خصوصی در GitHub باز کن یا مستقیم به نگه‌دارندهٔ مخزن پیام بده.
