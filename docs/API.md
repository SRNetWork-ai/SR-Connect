# مرجع API

پایه: `https://<your-domain>/api`
همهٔ مسیرها JSON می‌گیرند و JSON برمی‌گردانند (به‌جز آپلود که `multipart/form-data` است).
احراز هویت با کوکی نشست `sr_session` انجام می‌شود؛ کلاینت نیتیو می‌تواند
`Authorization: Bearer <token>` بفرستد.

فرمت خطا همیشه یکسان است:

```json
{ "error": "توضیح قابل‌خواندن برای کاربر" }
```

| کد    | معنی                    |
| ----- | ----------------------- |
| `400` | ورودی نامعتبر           |
| `401` | وارد نشده‌ای            |
| `403` | دسترسی لازم را نداری    |
| `404` | پیدا نشد                |
| `410` | حذف شده                 |
| `413` | فایل بزرگ‌تر از حد مجاز |
| `415` | نوع فایل مجاز نیست      |
| `429` | rate limit              |

---

## سلامت و نسخه

### `GET /api/health`

بدون احراز هویت. برای health check داکر و اسکریپت `health.sh`.

### `GET /api/version?platform=win&channel=stable`

manifest آخرین نسخهٔ منتشرشدهٔ کلاینت (امضاشده با Ed25519).

### `GET /api/artifact/:name`

دانلود بستهٔ آپدیت. استریم می‌شود.

---

## احراز هویت

### `POST /api/auth/register`

```json
{ "username": "ali", "password": "…", "displayName": "علی", "invite": "ABCD1234" }
```

→ `201` + کوکی نشست. اگر `REQUIRE_INVITE=1` باشد، `invite` اجباری است.
rate limit: ۴ بار در ۵ دقیقه به ازای هر IP.

### `POST /api/auth/login`

```json
{ "identity": "ali", "password": "…" }
```

→ `200` + کوکی نشست. `identity` می‌تواند نام کاربری یا ایمیل باشد.
rate limit: ۸ بار در دقیقه، هم روی IP و هم روی نام کاربری.

### `POST /api/auth/logout` · `GET /api/auth/me`

---

## بارگذاری اولیه

### `GET /api/bootstrap`

هرچه UI برای اولین رندر لازم دارد، در **یک** درخواست:

```jsonc
{
  "user": {
    "id": "…",
    "username": "ali",
    "displayName": "علی",
    "avatarColor": "#5865F2",
    "avatarUrl": null,
    "bio": null,
    "isAdmin": true,
    "permissions": 524287,
    "roles": [],
  },
  "categories": [{ "id": "…", "name": "متنی", "position": 0 }],
  "channels": [
    {
      "id": "…",
      "categoryId": "…",
      "name": "عمومی",
      "type": "text",
      "topic": null,
      "position": 0,
      "isPrivate": false,
      "userLimit": 0,
      "bitrate": 64000,
    },
  ],
  "members": [{ "id": "…", "displayName": "علی", "status": "online" }],
  "readState": [{ "channelId": "…", "lastReadAt": "…", "unread": 3, "mentions": 1 }],
  "stats": { "members": 12, "online": 4, "voiceCapacity": 20, "uptimeSeconds": 1320 },
  "features": { "voice": true, "registration": true, "requireInvite": false, "uploads": true },
}
```

---

## کانال‌ها و پیام‌ها

### `GET /api/channels` · `POST /api/channels`

ساخت کانال نیاز به `MANAGE_CHANNELS` دارد.

### `GET /api/channels/:id/messages?before=<ISO>&limit=50`

صفحه‌بندی keyset روی `created_at`، از قدیم به جدید مرتب برمی‌گردد. `limit` حداکثر ۱۰۰.

```jsonc
{
  "messages": [
    {
      "id": "…",
      "channelId": "…",
      "content": "سلام **دنیا**",
      "createdAt": "2025-01-14T10:00:00.000Z",
      "editedAt": null,
      "system": false,
      "replyTo": null,
      "replyPreview": {
        "id": "…",
        "authorName": "رضا",
        "authorColor": "#EB459E",
        "excerpt": "پیام قبلی…",
        "deleted": false,
      },
      "author": {
        "id": "…",
        "username": "ali",
        "displayName": "علی",
        "avatarColor": "#5865F2",
        "avatarUrl": "/api/files/…",
      },
      "attachments": [
        {
          "id": "…",
          "filename": "shot.png",
          "size": 51234,
          "mime": "image/png",
          "url": "/api/files/…",
          "width": 1280,
          "height": 720,
        },
      ],
      "reactions": [{ "emoji": "👍", "count": 3, "me": true }],
    },
  ],
  "hasMore": true,
}
```

`me` در ری‌اکشن‌ها همیشه نسبت به کاربرِ درخواست‌دهنده حساب می‌شود.

### `POST /api/channels/:id/messages`

نیاز به `SEND_MESSAGE`؛ با پیوست، `ATTACH_FILES` هم لازم است.

```json
{ "content": "سلام!", "replyTo": null, "attachmentIds": ["att_…"] }
```

منشن‌ها به شکل `<@uuid>` داخل متن می‌آیند و سرور جدول `mentions` را پر می‌کند.
rate limit: ۴۵ پیام در دقیقه.

### `PATCH /api/channels/:id/messages/:messageId`

فقط نویسندهٔ پیام. `{ "content": "متن جدید" }` → پیام با `editedAt` پر برمی‌گردد.

### `DELETE /api/channels/:id/messages/:messageId`

نویسنده، یا هر کسی که `MANAGE_MESSAGES` دارد. حذف نرم است (`deleted_at`)
و اگر مدیر پیام دیگری را پاک کند، در `audit_log` ثبت می‌شود.

### `POST /api/channels/:id/messages/:messageId/reactions`

`{ "emoji": "👍" }` — نیاز به `ADD_REACTION`. حداکثر ۲۴ ایموجی متمایز روی هر پیام.

### `DELETE /api/channels/:id/messages/:messageId/reactions?emoji=👍`

ری‌اکشن خودِ کاربر را برمی‌دارد. هر دو مسیر لیست تازهٔ `reactions` را برمی‌گردانند.

### `POST /api/channels/:id/read`

کانال را «خوانده» علامت می‌زند و شمارندهٔ منشن را صفر می‌کند.
همین کار از روی وب‌سوکت هم با پیام `ack_read` ممکن است.

---

## فایل‌ها

### `POST /api/uploads` — `multipart/form-data`

فیلد `files` (یک یا چند بار). پیوست ابتدا بدون پیام ذخیره می‌شود و
هنگام ارسال پیام با `attachmentIds` به آن وصل می‌گردد.

```json
{
  "attachments": [
    {
      "id": "att_…",
      "filename": "shot.png",
      "size": 51234,
      "mime": "image/png",
      "url": "/api/files/…",
      "width": 1280,
      "height": 720
    }
  ]
}
```

سقف پیش‌فرض: ۲۵ مگابایت برای هر فایل، ۱۰ فایل در هر پیام.
نوع‌های مجاز: تصویر (png/jpeg/webp/gif/avif)، ویدئو (mp4/webm)،
صدا (mpeg/ogg/wav)، pdf، zip، متن ساده و json. `image/svg+xml` عمداً مجاز نیست.

### `POST /api/uploads?kind=avatar`

فیلد `avatar`، فقط یک تصویر و حداکثر ۴ مگابایت.

### `GET /api/files/:name`

سرو کردن فایل. نیازمند ورود است (فایل‌ها عمومی نیستند)، با
`Content-Disposition: inline`، `nosniff` و `Content-Security-Policy: default-src 'none'; sandbox`.

---

## پروفایل

### `PATCH /api/users/me`

```json
{ "displayName": "علی", "bio": "…", "avatarColor": "#5865F2", "avatarAttachmentId": "att_…" }
```

`avatarAttachmentId: null` آواتار را برمی‌دارد. پاسخ، کاربر کامل با نقش‌ها و ماسک دسترسی است.

---

## صدا

### `POST /api/voice/token`

```json
{ "channelId": "chn_…" }
```

→ `{ "token": "…", "url": "wss://…/rtc", "room": "channel:…",
     "canSpeak": true, "canShare": true, "channel": { … } }`

`canShare` از بیت `SCREEN_SHARE` می‌آید و تعیین می‌کند دکمهٔ اشتراک صفحه فعال باشد یا نه.

---

## بلادرنگ

### `POST /api/realtime/ticket`

`{ "ticket": "…", "expiresIn": 60 }` — تیکت **یک‌بارمصرف** و ۶۰ ثانیه‌ای.
rate limit: ۳۰ بار در دقیقه.

---

## دعوت‌نامه و مدیریت

### `GET|POST /api/invites` — نیاز به `CREATE_INVITE`

### `GET|POST|PATCH /api/admin/roles` — نیاز به `MANAGE_ROLES`

### `GET /api/admin/audit?limit=60` — نیاز به `MANAGE_ROLES`

```json
{
  "entries": [
    {
      "id": "12",
      "action": "message.delete",
      "actorName": "علی",
      "target": "msg_…",
      "meta": { "channelId": "…" },
      "createdAt": "2025-01-14T10:00:00.000Z"
    }
  ]
}
```

### `GET|PATCH /api/admin/releases` — نیاز به `MANAGE_UPDATES`

---

## پروتکل WebSocket

```
wss://<your-domain>/ws
```

نسخهٔ قرارداد: **`API_VERSION = 4`**. اگر کلاینت عدد دیگری بفرستد، اتصال با
کد `4002` بسته می‌شود. هر پیام یک آبجکت JSON با کلید `t` است.

### کلاینت → سرور

| `t`           | payload                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `hello`       | `{ token, clientVersion, apiVersion }` — اولین پیام، حداکثر ۱۰ ثانیه فرصت |
| `ping`        | `{ ts }`                                                                  |
| `subscribe`   | `{ channelIds: [] }` — حداکثر ۲۰۰ کانال                                   |
| `typing`      | `{ channelId }`                                                           |
| `presence`    | `{ status: "online" \| "idle" \| "dnd" \| "offline" }`                    |
| `ack_read`    | `{ channelId, messageId }`                                                |
| `voice_state` | `{ channelId, muted, deafened, streaming }`                               |

### سرور → کلاینت

| `t`                | توضیح                                                       |
| ------------------ | ----------------------------------------------------------- |
| `ready`            | `{ user, serverTime, apiVersion, latest }`                  |
| `pong`             | `{ ts }`                                                    |
| `message_create`   | `{ message }` — ری‌اکشن‌ها برای هر گیرنده شخصی‌سازی می‌شوند |
| `message_update`   | `{ message }` — ویرایش متن یا تغییر پیوست                   |
| `message_delete`   | `{ channelId, messageId }`                                  |
| `reaction_update`  | `{ channelId, messageId, reactions }`                       |
| `read_state`       | `{ channelId, unread, mentions }`                           |
| `typing`           | `{ channelId, userId, displayName, expiresAt }`             |
| `presence_update`  | `{ userId, status }`                                        |
| `voice_update`     | `{ channelId, participants }`                               |
| `channels_changed` | ساختار کانال‌ها عوض شد — `bootstrap` را دوباره بگیر         |
| `version_hint`     | `{ latest, mandatory, minClient }`                          |
| `error`            | `{ code, message }`                                         |

heartbeat: سرور هر **۲۵ ثانیه** ping می‌زند؛ اگر **۶۰ ثانیه** از کلاینت خبری نشود
اتصال بسته می‌شود.

### کدهای بستن

| کد     | معنی                          |
| ------ | ----------------------------- |
| `4001` | تیکت/نشست نامعتبر             |
| `4002` | نسخهٔ API ناسازگار            |
| `4003` | کلاینت خیلی قدیمی است         |
| `4008` | rate limit یا heartbeat نرسید |
| `4100` | خاموشی نرم سرور               |

### محدودیت‌ها (`LIMITS` در `@sr/protocol`)

```
messageLength          4000
attachmentsPerMessage    10
attachmentBytes       25 MB
avatarBytes            4 MB
reactionsPerMessage      24
emojiLength              24
messagesPerMinute        60
typingPerMinute          30
socketsPerUser            4
heartbeatMs           25000
heartbeatTimeoutMs    60000
```
