-- دوستی و پیام خصوصی
create table if not exists friendships (
  id           uuid primary key default gen_random_uuid(),
  user_low     uuid not null references users(id) on delete cascade,
  user_high    uuid not null references users(id) on delete cascade,
  requested_by uuid not null references users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  check (user_low <> user_high),
  check (requested_by = user_low or requested_by = user_high),
  unique (user_low, user_high)
);
create index if not exists friendships_low_status_idx on friendships(user_low, status);
create index if not exists friendships_high_status_idx on friendships(user_high, status);

create table if not exists direct_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_low   uuid not null references users(id) on delete cascade,
  user_high  uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_low <> user_high),
  unique (user_low, user_high)
);

create table if not exists direct_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references direct_conversations(id) on delete cascade,
  author_id       uuid not null references users(id) on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz
);
create index if not exists direct_messages_conversation_created_idx
  on direct_messages(conversation_id, created_at desc, id desc);

create table if not exists user_preferences (
  user_id            uuid primary key references users(id) on delete cascade,
  allow_dm_from      text not null default 'friends'
                     check (allow_dm_from in ('everyone', 'friends', 'nobody')),
  notify_messages    boolean not null default true,
  notify_mentions    boolean not null default true,
  notify_calls       boolean not null default true,
  theme              text not null default 'dark'
                     check (theme in ('dark', 'midnight', 'contrast')),
  updated_at         timestamptz not null default now()
);