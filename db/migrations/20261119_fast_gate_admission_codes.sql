-- Additive, non-destructive human-readable backup codes for the authorised gate.
-- Old QR credentials remain valid and are never changed by this migration.
-- The API populates existing issued tickets lazily on an authorised wallet/inventory read.
alter table tickets add column if not exists admission_code varchar(12);
alter table offline_tickets add column if not exists admission_code varchar(12);
create unique index if not exists tickets_event_admission_code_idx on tickets(event_id,admission_code) where admission_code is not null;
create unique index if not exists offline_tickets_event_admission_code_idx on offline_tickets(event_id,admission_code) where admission_code is not null;
