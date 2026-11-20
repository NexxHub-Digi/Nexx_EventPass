-- Immutable per-delivery ticket design configuration.
-- Existing issued tickets remain valid and retain their current event theme/artwork
-- with a NULL design snapshot; this migration is additive and non-destructive.
alter table ticket_deliveries add column if not exists design_version integer;
alter table ticket_deliveries add column if not exists design_snapshot jsonb;
create index if not exists idx_ticket_deliveries_design_version
 on ticket_deliveries(event_id,design_version) where design_version is not null;
