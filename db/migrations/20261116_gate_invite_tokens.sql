-- Secure, reusable gate invitation workflow. Tokens are stored only as SHA-256 hashes.
alter table gate_invitations add column if not exists token_hash text;
alter table gate_invitations add column if not exists token_expires_at timestamptz;
alter table gate_invitations add column if not exists accepted_by uuid references app_users(id);
alter table gate_invitations add column if not exists accepted_at timestamptz;
create unique index if not exists idx_gate_invitations_token_hash on gate_invitations(token_hash) where token_hash is not null;
