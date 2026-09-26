-- ایموجی/استیکر سرور، ولکام اسکرین، بکاپ، گزارش، اعلان سرور و تماس خصوصی

create table if not exists server_emojis (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null default 'emoji' check (kind in ('emoji', 'sticker')),
  path        text not null,
  mime        text not null,
  size        integer not null default 0,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (kind, name)
);
create index if not exists server_emojis_kind_idx on server_emojis(kind, created_at desc);

create table if not exists server_backups (
  id         uuid primary key default gen_random_uuid(),
  note       text not null default '',
  payload    jsonb not null,
  size       integer not null default 0,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists server_backups_created_idx on server_backups(created_at desc);

create table if not exists server_notification_prefs (
  user_id           uuid primary key references users(id) on delete cascade,
  level             text not null default 'all' check (level in ('all', 'mentions', 'nothing')),
  suppress_everyone boolean not null default false,
  mute_until        timestamptz,
  updated_at        timestamptz not null default now()
);

create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete set null,
  target_type text not null check (target_type in ('server', 'user', 'message')),
  target_id   text,
  reason      text not null,
  status      text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at  timestamptz not null default now()
);
create index if not exists reports_status_idx on reports(status, created_at desc);

create table if not exists direct_calls (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references direct_conversations(id) on delete cascade,
  caller_id       uuid not null references users(id) on delete cascade,
  callee_id       uuid not null references users(id) on delete cascade,
  video           boolean not null default false,
  status          text not null default 'ringing'
                  check (status in ('ringing', 'active', 'ended', 'declined', 'missed')),
  created_at      timestamptz not null default now(),
  answered_at     timestamptz,
  ended_at        timestamptz
);
create index if not exists direct_calls_callee_idx on direct_calls(callee_id, status, created_at desc);
create index if not exists direct_calls_caller_idx on direct_calls(caller_id, status, created_at desc);
