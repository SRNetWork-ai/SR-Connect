# معماری SR-Connect

## نمای کلی

SR-Connect یک **monorepo با npm workspaces** است که سه بستهٔ اصلی دارد:

```
SR-Connect/
├─ apps/web/            Next.js 15 (App Router) — UI + همهٔ REST API ها
├─ apps/gateway/        سرور WebSocket روی Node — fan-out رویدادهای بلادرنگ
├─ packages/protocol/   تایپ‌ها، permission bits، قرارداد پیام‌ها (مشترک)
├─ deploy/              docker-compose، Caddy، LiveKit، coturn، اسکریپت‌ها
└─ docs/
```

چرا gateway جدا از Next.js؟ چون Next.js روی serverless-style runtime اجرا می‌شود
و اتصال WebSocket بلندمدت را به‌خوبی نگه نمی‌دارد. gateway یک پروسهٔ ساده و
stateless است که فقط سوکت‌ها را نگه می‌دارد و رویداد پخش می‌کند.

---

## جریان داده

```
کاربر ──HTTP──▶ apps/web ──INSERT──▶ PostgreSQL
                    │                    │
                    │              pg_notify('sr_events', …)
                    │                    │
                    │                    ▼
                    │              apps/gateway (LISTEN sr_events)
                    │                    │
کاربر ◀──WebSocket──┴────────────────────┘
```

1. کلاینت پیام را با `POST /api/channels/:id/messages` می‌فرستد.
2. `apps/web` آن را در جدول `messages` می‌نویسد.
3. در همان تراکنش `pg_notify('sr_events', payload)` صدا زده می‌شود.
4. `apps/gateway` که `LISTEN sr_events` کرده، payload را می‌گیرد.
5. gateway آن را فقط برای سوکت‌هایی که مجاز به دیدن آن کانال‌اند می‌فرستد.

**چرا `LISTEN/NOTIFY` و نه Redis؟** برای ۲۰ تا چند صد کاربر همزمان،
Postgres کاملاً کافی است و یک سرویس کمتر یعنی RAM کمتر، پیکربندی کمتر و
نقطهٔ خرابی کمتر. اگر روزی به چند هزار کاربر رسیدی، لایهٔ `db/events.ts`
را می‌شود بدون تغییر بقیهٔ کد به Redis Pub/Sub عوض کرد.

---

## احراز هویت

| لایه      | مکانیزم                                                     |
| --------- | ----------------------------------------------------------- |
| رمز عبور  | `scrypt` با salt تصادفی ۱۶ بایتی (`lib/auth/password.ts`)   |
| نشست      | توکن تصادفی ۳۲ بایتی، ذخیره به‌صورت hash در جدول `sessions` |
| کوکی      | `httpOnly` + `Secure` + `SameSite=Lax`، عمر ۳۰ روز          |
| WebSocket | **تیکت یک‌بارمصرف ۶۰ ثانیه‌ای**                             |
| صدا       | JWT اختصاصی LiveKit با TTL کوتاه، صادرشده سمت سرور          |

### چرا تیکت برای WebSocket؟

کوکی نشست `httpOnly` است، پس جاوااسکریپت کلاینت نمی‌تواند آن را بخواند و
در URL سوکت بگذارد. پس:

```
POST /api/realtime/ticket      (با کوکی)
  ←  { ticket: "…", expiresIn: 60 }

WS  wss://host/ws?ticket=…
  →  gateway تیکت را در جدول realtime_tickets مصرف (حذف) می‌کند
```

هر تیکت فقط **یک بار** قابل استفاده است. کلاینت‌های native می‌توانند مستقیماً
توکن نشست را بدهند (چون کوکی ندارند).

---

## مدل دسترسی

`packages/protocol/src/permissions.ts` — یک bitmask با ۱۹ بیت:

```ts
(VIEW_CHANNEL,
  SEND_MESSAGES,
  MANAGE_MESSAGES,
  EMBED_LINKS,
  ATTACH_FILES,
  ADD_REACTIONS,
  MENTION_EVERYONE,
  CONNECT,
  SPEAK,
  STREAM,
  MUTE_MEMBERS,
  DEAFEN_MEMBERS,
  MOVE_MEMBERS,
  PRIORITY_SPEAKER,
  MANAGE_CHANNELS,
  MANAGE_ROLES,
  KICK_MEMBERS,
  BAN_MEMBERS,
  ADMINISTRATOR);
```

محاسبهٔ دسترسی مؤثر:

```
base   = OR همهٔ نقش‌های کاربر
result = (base & ~overrideDeny) | overrideAllow
اگر ADMINISTRATOR ست باشد ⇒ همهٔ بیت‌ها مجاز
```

override ها در جدول `channel_overrides` به ازای هر جفت (کانال، نقش|کاربر) ذخیره می‌شوند.

---

## اسکیمای دیتابیس

`apps/web/src/lib/db/migrations/`

| migration            | جدول‌ها                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001_init.sql`       | `users`, `sessions`, `roles`, `user_roles`, `categories`, `channels`, `channel_overrides`, `messages`, `attachments`, `invites`, `audit_log`, `settings` |
| `002_releases.sql`   | `releases`, `client_versions`                                                                                                                            |
| `003_tickets.sql`    | `realtime_tickets`                                                                                                                                       |
| `004_reactions.sql`  | `message_reactions`                                                                                                                                      |
| `005_read_state.sql` | `read_state`, `mentions`                                                                                                                                 |
| `006_uploads.sql`    | ستون‌های `users.avatar_url`/`bio`، `attachments.width`/`height`/`created_at` و nullable شدن `attachments.message_id`                                     |

`attachments.message_id` عمداً nullable است: فایل قبل از ارسال پیام آپلود
می‌شود و «یتیم» می‌ماند تا هنگام `POST /messages` به پیام وصل شود.

migration ها **idempotent** اند (`create table if not exists`) و ترتیب اجرا
بر اساس نام فایل است. اجرا با `npm run migrate`.

---

## صدا (LiveKit)

- LiveKit به‌صورت **SFU** کار می‌کند: هر کلاینت یک upstream می‌فرستد و
  n-1 downstream می‌گیرد. پهنای باند سرور خطی رشد می‌کند، نه n².
- کانتینر LiveKit روی `network_mode: host` اجرا می‌شود تا رنج پورت UDP
  بدون NAT داکر کار کند (این برای کارایی حیاتی است).
- توکن اتصال در `POST /api/voice/token` ساخته می‌شود؛ سرور قبلش
  بیت‌های `CONNECT_VOICE` و `SPEAK` را روی همان کانال چک می‌کند و `canShare`
  را از بیت `SCREEN_SHARE` برمی‌گرداند.
- اشتراک صفحه از همان اتاق LiveKit با `setScreenShareEnabled` منتشر می‌شود؛
  ترک ویدئو در state ذخیره می‌شود و React آن را بالای لیست پیام‌ها می‌چیند.
- **coturn** به‌عنوان TURN/STUN برای کاربران پشت NAT سخت‌گیر یا فایروال شرکتی.
  روی `443/tcp` هم گوش می‌دهد تا از فایروال‌هایی که فقط HTTPS می‌دهند رد شود.

تنظیمات صوتی پیش‌فرض: Opus، DTX روشن، echo cancellation، noise suppression،
auto gain control.

---

## پروتکل بلادرنگ

`packages/protocol/src/realtime.ts` — `API_VERSION = 3`

پیام‌های کلاینت → سرور: `hello`, `ping`, `subscribe`, `unsubscribe`, `typing`, `presence`

پیام‌های سرور → کلاینت: `ready`, `pong`, `message_create`, `message_update`,
`message_delete`, `typing`, `presence`, `voice_state`, `channels_changed`,
`version_hint`, `error`

کدهای بستن اتصال:

| کد     | معنی                  |
| ------ | --------------------- |
| `4401` | تیکت نامعتبر یا منقضی |
| `4403` | دسترسی ندارد          |
| `4408` | heartbeat نرسید       |
| `4409` | نشست تکراری           |
| `4429` | rate limit            |
| `4500` | خطای سرور             |

heartbeat هر ۲۵ ثانیه، timeout در ۶۰ ثانیه. کلاینت با backoff نمایی
(۱→۲→۴→۸→۱۵ ثانیه + jitter) دوباره وصل می‌شود.

---

## فرانت‌اند

- **Next.js 15 App Router** با React 19 و Server Components برای صفحات اولیه
- **Zustand** برای state سمت کلاینت: `use-session`, `use-app`, `use-voice`
- **Framer Motion** برای انیمیشن‌ها
- **RTL-first**: `dir="rtl"` روی `<html>`، فونت **Vazirmatn**
- تم تیرهٔ الهام‌گرفته از Discord با CSS variables
- `middleware.ts` مسیرهای `/app/*` را محافظت می‌کند

> فونت‌های `woff2` در گیت کامیت نشده‌اند. `scripts/fonts.mjs` آن‌ها را از
> بستهٔ npm `vazirmatn` در `postinstall` کپی می‌کند.

---

## حالت دمو

اگر `DATABASE_URL` ست نباشد، برنامه به **حالت in-memory** می‌رود:
دیتای نمونه در حافظه ساخته می‌شود تا بشود UI را بدون Postgres دید.
این حالت فقط برای توسعه است و با ری‌استارت پاک می‌شود.

---

## فایل‌ها و پیوست‌ها

فایل‌ها روی دیسک نگه داشته می‌شوند، نه S3 — این پروژه self-hosted است و یک
volume ساده کافی است.

```
deploy/uploads  ──(bind mount)──▶  /srv/uploads  (داخل کانتینر web)
```

- نام روی دیسک یک UUID + پسوند پاک‌شده است؛ هیچ بخشی از نام کاربر وارد مسیر نمی‌شود.
- نوع فایل با allow-list بررسی می‌شود؛ `image/svg+xml` عمداً مجاز نیست
  چون SVG می‌تواند اسکریپت داشته باشد.
- ابعاد تصویر بدون کتابخانهٔ خارجی از هدر PNG/GIF/JPEG/WebP خوانده می‌شود تا
  UI بتواند جای تصویر را از قبل رزرو کند و چیدمان نپرد.
- `GET /api/files/:name` نیازمند ورود است و با
  `Content-Security-Policy: default-src 'none'; sandbox` سرو می‌شود.
- بکاپ روزانه پوشهٔ `uploads` را هم برمی‌دارد (با `SKIP_UPLOADS=1` قابل حذف است).

---

## خوانده‌نشده‌ها

دو جدول کوچک این کار را می‌کنند:

- `read_state(user_id, channel_id, last_read_at)` — آخرین لحظهٔ خواندن
- `mentions(message_id, user_id, channel_id, seen)` — منشن‌های دیده‌نشده

`GET /api/bootstrap` شمارش اولیه را می‌دهد، کلاینت با هر `message_create`
شمارنده را محلی بالا می‌برد، و با باز کردن کانال پیام `ack_read` روی سوکت
می‌فرستد تا در همهٔ دستگاه‌ها صفر شود.

## پوسته‌ی اپ و جابه‌جایی نماها

`/app`، `/app/updates` و `/app/settings` هر سه یک پوسته‌ی مشترک دارند
(`app/app/layout.tsx`) و محتوایشان از `components/shell/ShellViews.tsx` می‌آید.

جابه‌جایی بین این سه نما **کلاینت‌ساید** است و از `store/use-shell.ts` می‌آید،
نه از روتر Next. دلیلش سرعت است: چون ریشه‌ی اپ `force-dynamic` است، هر ناوبری
با `<Link>` یک رفت‌وبرگشت RSC می‌شد که روی اینترنت کند چند ثانیه طول می‌کشید.
با استور، جابه‌جایی صفر درخواست شبکه دارد؛ URL با `history.pushState` هم‌گام
می‌شود تا لینک مستقیم و دکمه‌ی back مرورگر همچنان کار کنند.

## سقف زمانی روی تماس صوتی

`store/use-voice.ts` هر انتظار شبکه‌ای را با `withTimeout` می‌بندد:
گرفتن توکن ۸ ثانیه، وب‌سوکت ۸ ثانیه، اتصال WebRTC ۱۰ ثانیه و کل `connect`
۱۵ ثانیه. بدون این سقف‌ها، وقتی پورت‌های UDP سرور بسته باشد LiveKit ده‌ها
ثانیه تلاش می‌کند و کاربر فکر می‌کند دکمه کار نمی‌کند. `leave()` هم منتظر
`disconnect` نمی‌ماند تا قطع تماس فوری دیده شود.
