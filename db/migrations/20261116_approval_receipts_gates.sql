-- Nexx EventPass: organiser approvals and manual-payment evidence
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS requested_role text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES app_users(id);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS receipt_mime text;
ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS receipt_data bytea;
ALTER TABLE ticket_orders ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz;
CREATE TABLE IF NOT EXISTS organiser_payment_accounts(
 organiser_id uuid primary key references app_users(id) on delete cascade,
 bank_name text not null,
 account_name text not null,
 account_number text not null,
 updated_at timestamptz not null default now()
);
CREATE TABLE IF NOT EXISTS gate_invitations(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references events(id) on delete cascade,
 organiser_id uuid not null references app_users(id),invitee_email text not null,
 gate_label text not null default 'Main gate',status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 created_at timestamptz not null default now(),unique(event_id,invitee_email)
);
