-- Existing credentials are populated on the first authorised read after deployment.
-- Previously exported credentials still validate against the original ticket ID.
alter table tickets add column if not exists qr_credential text;
alter table offline_tickets add column if not exists qr_credential text;
