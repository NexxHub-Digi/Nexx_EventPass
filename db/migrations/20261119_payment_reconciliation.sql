alter table events add column if not exists onsite_payments_enabled boolean not null default false;

alter table ticket_orders add column if not exists payment_method text not null default 'manual'
  check (payment_method in ('manual','onsite','free'));

create table if not exists platform_commission_policy (
  singleton boolean primary key default true check (singleton),
  basis_points integer not null check (basis_points between 0 and 10000),
  updated_by uuid references app_users(id),
  updated_at timestamptz not null default now()
);
insert into platform_commission_policy (basis_points) values (0) on conflict do nothing;

create table if not exists verified_order_payments (
  order_id uuid primary key references ticket_orders(id),
  method text not null check (method in ('manual','onsite','free')),
  gross_ngn integer not null check (gross_ngn >= 0),
  commission_basis_points integer not null check (commission_basis_points between 0 and 10000),
  commission_ngn integer generated always as
    (round(gross_ngn::numeric * commission_basis_points / 10000)::integer) stored,
  collection_reference text not null,
  verified_by uuid references app_users(id),
  verified_at timestamptz not null default now()
);

-- Historical approvals predate commission policy. Preserve their totals at zero commission.
insert into verified_order_payments(order_id,method,gross_ngn,commission_basis_points,collection_reference,verified_by,verified_at)
select id,case when amount_ngn=0 then 'free' else payment_method end,
  amount_ngn,0,payment_reference,reviewed_by,coalesce(reviewed_at,created_at)
from ticket_orders where status='approved' on conflict do nothing;

create table if not exists commission_reconciliations (
  order_id uuid primary key references verified_order_payments(order_id),
  received_ngn integer not null check (received_ngn >= 0),
  reference text not null,
  recorded_by uuid not null references app_users(id),
  recorded_at timestamptz not null default now()
);
create unique index if not exists commission_reconciliation_reference_idx
  on commission_reconciliations (lower(reference)) where received_ngn>0;
