-- وضعیت خواندن هر کاربر در هر کانال
create table if not exists read_state (
  user_id       uuid not null references users(id)    on delete cascade,
  channel_id    uuid not null references channels(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  last_read_id  uuid,
  updated_at    timestamptz not null default now(),
  primary key (user_id, channel_id)
);
create index if not exists read_state_user_idx on read_state(user_id);

-- منشن‌ها جدا شمرده می‌شوند تا نشان قرمز فقط برای منشن باشد
create table if not exists mentions (
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references users(id)    on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  seen       boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
-- برای شمارش سریع «منشن‌های دیده‌نشده» در bootstrap
create index if not exists mentions_unseen_idx
  on mentions(user_id, channel_id) where seen = false;
create index if not exists mentions_user_channel_idx on mentions(user_id, channel_id, created_at desc);
