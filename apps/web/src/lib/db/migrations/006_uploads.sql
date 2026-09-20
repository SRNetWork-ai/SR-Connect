-- آواتار و بیوی کاربر
alter table users add column if not exists avatar_url text;
alter table users add column if not exists bio text;

-- پیوست قبل از ارسال پیام «یتیم» ذخیره می‌شود و بعد به پیام وصل می‌گردد،
-- پس message_id باید بتواند موقتاً خالی باشد.
alter table attachments alter column message_id drop not null;

-- ابعاد تصویر برای جلوگیری از پرش چیدمان هنگام لود
alter table attachments add column if not exists width  int;
alter table attachments add column if not exists height int;
alter table attachments add column if not exists created_at timestamptz not null default now();
create index if not exists attachments_message_idx on attachments(message_id);

-- لاگ ممیزی اگر ستون meta ندارد
alter table audit_log add column if not exists meta jsonb;

-- پاکسازی پیوست‌های یتیم قدیمی (بیش از یک روز بدون پیام)
create index if not exists attachments_orphan_idx
  on attachments(created_at) where message_id is null;
