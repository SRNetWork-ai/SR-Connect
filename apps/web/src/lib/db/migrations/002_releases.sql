-- مخزن ریلیز؛ منبع حقیقتِ /api/version
create table if not exists releases (
  version      text primary key,
  channel      text not null default 'stable'
               check (channel in ('stable','beta','nightly')),
  min_client   text not null default '0.0.0',
  api_version  integer not null default 3,
  mandatory    boolean not null default false,
  rollout      integer not null default 100 check (rollout between 0 and 100),
  yanked       boolean not null default false,
  notes        jsonb not null default '[]'::jsonb,
  artifacts    jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists releases_channel_idx on releases(channel, published_at desc);

-- چه دستگاهی روی چه نسخه‌ای است؟ ورودی نمودار «توزیع نسخه» در مرکز آپدیت.
create table if not exists client_versions (
  device_id   text primary key,
  user_id     uuid references users(id) on delete set null,
  version     text not null,
  platform    text not null default 'web',
  channel     text not null default 'stable',
  last_seen_at timestamptz not null default now()
);
create index if not exists client_versions_version_idx on client_versions(version);
