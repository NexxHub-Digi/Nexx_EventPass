-- Append-only Ticket Studio edit history. Does not alter issued ticket snapshots or admission credentials.
create table if not exists event_ticket_design_versions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  version integer not null check(version>=1),
  theme_id text not null references ticket_theme_catalog(id),
  mode text not null check(mode in ('ticket','qr','both')),
  fields jsonb not null check(jsonb_typeof(fields)='object'),
  enabled jsonb not null check(jsonb_typeof(enabled)='object'),
  saved_by uuid not null references app_users(id),
  created_at timestamptz not null default now(),
  unique(event_id,version)
);
create index if not exists idx_event_ticket_design_versions_latest
  on event_ticket_design_versions(event_id,version desc);
