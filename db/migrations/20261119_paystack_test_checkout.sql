-- Test-mode Paystack checkout. Do not enable live keys or auto-approve financial accounts.
alter table ticket_orders drop constraint if exists ticket_orders_payment_method_check;
alter table ticket_orders add constraint ticket_orders_payment_method_check
 check (payment_method in ('manual','onsite','free','paystack'));
alter table verified_order_payments drop constraint if exists verified_order_payments_method_check;
alter table verified_order_payments add constraint verified_order_payments_method_check
 check (method in ('manual','onsite','free','paystack'));
-- Automated provider actions must not impersonate a user in the audit trail.
alter table ticket_payment_audit alter column actor_id drop not null;

create table if not exists paystack_organiser_accounts (
 organiser_id uuid primary key references app_users(id),
 subaccount_code text not null unique check (subaccount_code ~ '^ACCT_[A-Za-z0-9]+$'),
 provider_account_name text not null,
 provider_account_number text not null,
 verified_by uuid not null references app_users(id),
 verified_at timestamptz not null default now(),
 verification_note text not null,
 created_at timestamptz not null default now()
);

create table if not exists paystack_payments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references ticket_orders(id),
 buyer_id uuid not null references app_users(id),
 organiser_id uuid not null references app_users(id),
 reference text not null unique,
 amount_kobo bigint not null check (amount_kobo>0),
 commission_basis_points integer not null check (commission_basis_points between 0 and 10000),
 commission_kobo bigint not null check (commission_kobo>=0 and commission_kobo<=amount_kobo),
 subaccount_code text not null,
 authorization_url text,
 status text not null default 'initiating' check
  (status in ('initiating','initialized','initialization_failed','success','reconciliation_required','refund_pending','refunded','refund_failed')),
 provider_transaction_id text,
 provider_paid_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists paystack_payments_organiser_idx on paystack_payments(organiser_id,created_at desc);

create table if not exists paystack_events (
 event_key text primary key,
 reference text,
 event_type text not null,
 received_at timestamptz not null default now()
);

create table if not exists paystack_refunds (
 id uuid primary key default gen_random_uuid(),
 payment_id uuid not null unique references paystack_payments(id),
 requested_by uuid not null references app_users(id),
 reason text not null,
 refund_reference text not null unique,
 provider_refund_id text,
 status text not null default 'requested'
   check(status in ('requested','pending','processing','processed','failed','needs_attention')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
