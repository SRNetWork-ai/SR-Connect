-- ری‌اکشن‌ها: یک ردیف به ازای (پیام، کاربر، ایموجی)
create table if not exists message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references users(id)    on delete cascade,
  emoji      text not null check (length(emoji) between 1 and 24),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists message_reactions_msg_idx on message_reactions(message_id);
