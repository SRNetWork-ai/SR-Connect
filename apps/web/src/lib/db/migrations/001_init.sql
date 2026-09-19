-- SR-Connect — اسکیمای پایه
create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      citext not null unique,
  email         citext unique,
  display_name  text   not null,
  password_hash text   not null,
  avatar_color  text   not null default '#5865F2',
  status        text   not null default 'offline'
                check (status in ('online','idle','dnd','offline')),
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  token_hash   text not null unique,
  user_agent   text,
  ip           inet,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expires_idx on sessions(expires_at);

create table if not exists roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#99AAB5',
  permissions integer not null default 0,
  position    integer not null default 0,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists roles_one_default on roles(is_default) where is_default;

create table if not exists user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table if not exists categories (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  position integer not null default 0
);

create table if not exists channels (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name        text not null,
  type        text not null default 'text' check (type in ('text','voice','stage')),
  topic       text,
  position    integer not null default 0,
  is_private  boolean not null default false,
  user_limit  integer not null default 20,
  bitrate     integer not null default 64000,
  created_at  timestamptz not null default now()
);
create index if not exists channels_category_idx on channels(category_id, position);

create table if not exists channel_overrides (
  channel_id uuid not null references channels(id) on delete cascade,
  role_id    uuid not null references roles(id) on delete cascade,
  allow      integer not null default 0,
  deny       integer not null default 0,
  primary key (channel_id, role_id)
);

create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  author_id  uuid references users(id) on delete set null,
  content    text not null,
  system     boolean not null default false,
  reply_to   uuid references messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz
);
-- کلید صفحه‌بندی تاریخچه: از جدید به قدیم
create index if not exists messages_channel_created_idx
  on messages(channel_id, created_at desc, id desc);

create table if not exists attachments (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  filename   text not null,
  size       bigint not null,
  mime       text not null,
  path       text not null
);

create table if not exists invites (
  code       text primary key,
  created_by uuid references users(id) on delete set null,
  role_id    uuid references roles(id) on delete set null,
  max_uses   integer not null default 0,
  uses       integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id         bigserial primary key,
  actor_id   uuid references users(id) on delete set null,
  action     text not null,
  target     text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on audit_log(created_at desc);

create table if not exists settings (
  key   text primary key,
  value jsonb not null
);
