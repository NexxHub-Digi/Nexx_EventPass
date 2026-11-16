-- Event discovery, media and Google-only native sign-in.
alter table events add column if not exists description text not null default '';
alter table events add column if not exists category text not null default 'Other';
alter table events add column if not exists ticket_theme text not null default 'aurora';
create table if not exists event_media(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references events(id) on delete cascade,
 media_type text not null check(media_type in ('image','video')),
 mime_type text not null,
 media_data bytea not null,
 file_name text not null,
 created_at timestamptz not null default now()
);
create index if not exists event_media_event_created on event_media(event_id,created_at);
create table if not exists mobile_auth_codes(
 code_hash text primary key,
 user_id uuid not null references app_users(id) on delete cascade,
 client text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index if not exists mobile_auth_codes_expires on mobile_auth_codes(expires_at);
