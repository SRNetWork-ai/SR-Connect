-- بلیت یک‌بارمصرف برای اتصال وب‌سوکت.
-- کوکی نشست httpOnly است و جاوااسکریپت نمی‌تواند آن را بخواند، پس اپ وب
-- قبل از هر اتصال یک بلیت کوتاه‌عمر می‌گیرد و گیت‌وی همان را مصرف می‌کند.
create table if not exists realtime_tickets (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index if not exists realtime_tickets_expires_idx on realtime_tickets(expires_at);
