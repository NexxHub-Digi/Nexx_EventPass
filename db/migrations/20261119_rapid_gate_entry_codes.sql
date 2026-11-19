-- Add a one-way indexed 12-character backup admission code for each online/offline credential.
-- No original QR/token values are changed, and no existing financial rows are rewritten.
create table if not exists ticket_entry_codes (
  event_id uuid not null references events(id),
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  ticket_id uuid unique references tickets(id),
  offline_ticket_id uuid unique references offline_tickets(id),
  issued_at timestamptz not null default now(),
  primary key(event_id,code_hash),
  constraint ticket_entry_codes_exact_source check ((ticket_id is not null) <> (offline_ticket_id is not null))
);
alter table entry_scans add column if not exists entry_method text not null default 'qr'
  check(entry_method in ('qr','manual'));
create index if not exists entry_scans_manual_attempts_idx on entry_scans(scanner_id,scanned_at desc) where entry_method='manual';
