# مرجع API

پایه: `https://<your-domain>/api`
همهٔ مسیرها JSON می‌گیرند و JSON برمی‌گردانند.
احراز هویت با کوکی نشست (`sr_session`) انجام می‌شود.

فرمت خطا:

```json
{ "error": "کد_خطا", "message": "توضیح قابل‌خواندن" }
```

---

## سلامت و نسخه

### `GET /api/health`
بدون احراز هویت. برای health check و لودبالانسر.

```json
{ "ok": true, "db": "up", "version": "1.0.0", "uptime": 132840 }
```

### `GET /api/version?platform=win&channel=stable`
manifest آخرین نسخهٔ منتشرشدهٔ کلاینت.

```json
{
  "version": "1.1.0",
  "url": "/api/artifact/SR-Connect-1.1.0-win-x64.exe",
  "digest": "9f2c…",
  "signature": "base64…",
  "notes": "رفع باگ قطع صدا",
  "publishedAt": "2025-01-14T10:00:00.000Z",
  "mandatory": false
}
```

`platform`: `win` | `mac` | `linux` | `web` — `channel`: `stable` | `beta` | `dev`

### `GET /api/artifact/:name`
دانلود فایل پکیج. پاسخ استریم می‌شود و از Range پشتیبانی می‌کند.

---

## احراز هویت

### `POST /api/auth/register`
```json
{ "username": "ali", "password": "…", "displayName": "علی", "invite": "ABCD1234" }
```
→ `201` + کوکی نشست. اگر ثبت‌نام عمومی بسته باشد، `invite` اجباری است.

### `POST /api/auth/login`
```json
{ "username": "ali", "password": "…", "remember": true }
```
→ `200` + کوکی نشست (۳۰ روز اگر `remember` باشد، وگرنه session cookie).

### `POST /api/auth/logout`
نشست فعلی را باطل و کوکی را پاک می‌کند.

### `GET /api/auth/me`
```json
{ "id": "usr_…", "username": "ali", "displayName": "علی",
  "avatarUrl": null, "roles": ["rol_admin"], "permissions": "524287" }
```

---

## بارگذاری اولیه

### `GET /api/bootstrap`
همهٔ چیزی که UI برای اولین رندر لازم دارد، در **یک** درخواست:

```json
{
  "user": { … },
  "server": { "name": "SR-Connect", "iconUrl": null },
  "categories": [ { "id": "cat_…", "name": "متنی", "position": 0 } ],
  "channels": [
    { "id": "chn_…", "categoryId": "cat_…", "name": "عمومی",
      "type": "text", "position": 0, "topic": null }
  ],
  "roles": [ { "id": "rol_…", "name": "ادمین", "color": "#5865F2",
               "position": 100, "permissions": "524287" } ],
  "members": [ { "id": "usr_…", "displayName": "علی", "status": "online" } ],
  "apiVersion": 3,
  "appVersion": "1.0.0"
}
```

---

## کانال‌ها

### `GET /api/channels`
فهرست کانال‌هایی که کاربر بیت `VIEW_CHANNEL` را روی آن‌ها دارد.

### `POST /api/channels`
نیاز به `MANAGE_CHANNELS`.
```json
{ "name": "بازی", "type": "voice", "categoryId": "cat_…", "topic": null }
```

### `GET /api/channels/:id/messages?before=<msgId>&limit=50`
صفحه‌بندی cursor-based، از جدید به قدیم. `limit` حداکثر ۱۰۰.

```json
{ "messages": [ { "id": "msg_…", "channelId": "chn_…",
    "author": { "id": "usr_…", "displayName": "علی" },
    "content": "سلام", "createdAt": "2025-01-14T10:00:00.000Z",
    "editedAt": null, "attachments": [] } ],
  "hasMore": true }
```

### `POST /api/channels/:id/messages`
نیاز به `SEND_MESSAGES`. حداکثر ۴۰۰۰ کاراکتر.
```json
{ "content": "سلام!", "nonce": "c-1736847600000" }
```
`nonce` برای optimistic UI است و در رویداد `message_create` برگردانده می‌شود.

---

## صدا

### `POST /api/voice/token`
```json
{ "channelId": "chn_…" }
```
→
```json
{ "token": "eyJhbGciOi…", "url": "wss://chat.example.com/livekit",
  "room": "chn_…", "identity": "usr_…", "expiresIn": 21600 }
```
سرور قبل از صدور، بیت‌های `CONNECT` و `SPEAK` را بررسی می‌کند.

---

## بلادرنگ

### `POST /api/realtime/ticket`
```json
{ "ticket": "rt_…", "expiresIn": 60, "url": "wss://chat.example.com/ws" }
```
تیکت **یک‌بارمصرف** است و بعد از مصرف در gateway حذف می‌شود.

---

## دعوت‌نامه

### `GET /api/invites` — نیاز به `MANAGE_ROLES`
### `POST /api/invites`
```json
{ "maxUses": 10, "expiresInHours": 168, "roleId": null }
```
→ `{ "code": "ABCD1234", "url": "https://…/register?invite=ABCD1234" }`

---

## مدیریت

### `GET /api/admin/roles` — فهرست نقش‌ها
### `POST /api/admin/roles`
```json
{ "name": "مدیر", "color": "#ED4245", "permissions": "3072", "position": 50 }
```
### `PATCH /api/admin/roles`
```json
{ "id": "rol_…", "permissions": "3584" }
```
یا برای انتساب نقش: `{ "userId": "usr_…", "addRoles": ["rol_…"], "removeRoles": [] }`

### `GET /api/admin/releases` — فهرست نسخه‌ها
### `PATCH /api/admin/releases`
```json
{ "id": "rel_…", "published": true, "channel": "stable", "mandatory": false }
```

همهٔ مسیرهای `/api/admin/*` نیاز به بیت `ADMINISTRATOR` دارند.

---

## پروتکل WebSocket

```
wss://<your-domain>/ws?ticket=<ticket>
```

### کلاینت → سرور

| `op` | payload |
|---|---|
| `hello` | `{ apiVersion: 3, clientVersion: "1.0.0", platform: "web" }` |
| `ping` | `{ t: <epoch_ms> }` |
| `subscribe` | `{ channels: ["chn_…"] }` |
| `unsubscribe` | `{ channels: ["chn_…"] }` |
| `typing` | `{ channelId: "chn_…" }` |
| `presence` | `{ status: "online" \| "idle" \| "dnd" \| "invisible" }` |

### سرور → کلاینت

| `op` | توضیح |
|---|---|
| `ready` | بعد از `hello` — شامل `sessionId`, `heartbeatInterval`, `apiVersion` |
| `pong` | پاسخ `ping` با همان `t` |
| `message_create` / `message_update` / `message_delete` | رویدادهای پیام |
| `typing` | `{ channelId, userId, expiresAt }` |
| `presence` | `{ userId, status }` |
| `voice_state` | `{ channelId, userId, muted, deafened, speaking }` |
| `channels_changed` | ساختار کانال‌ها عوض شد — `bootstrap` را دوباره بگیر |
| `version_hint` | نسخهٔ جدید منتشر شد — `{ version, mandatory }` |
| `error` | `{ code, message }` |

heartbeat: هر **۲۵ ثانیه** `ping` بفرست. اگر ۶۰ ثانیه چیزی نیاید، اتصال بسته می‌شود.

### کدهای بستن

| کد | معنی |
|---|---|
| `4400` | پیام نامعتبر |
| `4401` | تیکت نامعتبر یا منقضی |
| `4403` | دسترسی ندارد |
| `4406` | نسخهٔ API ناسازگار |
| `4408` | heartbeat نرسید |
| `4409` | نشست تکراری |
| `4429` | rate limit |
| `4500` | خطای سرور |

### محدودیت‌ها (`LIMITS`)

```
MESSAGE_MAX_LENGTH   4000
MESSAGES_PER_FETCH    100
SUBSCRIBE_MAX_CHANNELS 200
PAYLOAD_MAX_BYTES    65536
TYPING_TTL_MS          8000
```
