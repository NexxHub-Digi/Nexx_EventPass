-- Event discovery, media and Google-only native sign-in.
alter table events add column if not exists description text not null default '';
alter table events add column if not exists category text not null default 'Other';
alter table events add column if not exists ticket_theme text not null default 'aurora';
create table if not exists event_media(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references events(id) on delete cascade,
 media_type text not null check(media_type in ('image','video','ticket_art')),
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
alter table mobile_auth_codes add column if not exists code_challenge text;

alter table events add column if not exists verification_status text not null default 'verified';
alter table events add column if not exists verified_by uuid references app_users(id);
alter table events add column if not exists verified_at timestamptz;
alter table event_media add column if not exists approved boolean not null default false;
alter table event_media drop constraint if exists event_media_media_type_check;
alter table event_media add constraint event_media_media_type_check check(media_type in ('image','video','ticket_art'));
create index if not exists idx_events_verification on events(verification_status,status);
