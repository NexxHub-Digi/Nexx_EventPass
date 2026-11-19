create table if not exists organiser_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references app_users(id),
  bank_name text not null,
  account_name text not null,
  account_number text not null check (account_number ~ '^[0-9]{10,12}$'),
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references app_users(id),
  reviewed_at timestamptz,
  review_note text not null default '',
  unique (organiser_id,id)
);
create index if not exists organiser_bank_review_idx on organiser_bank_accounts(status,created_at);
create unique index if not exists organiser_bank_open_account_idx
  on organiser_bank_accounts(organiser_id,lower(bank_name),account_number) where status in ('pending','verified');

alter table events add column if not exists payment_account_id uuid;
alter table ticket_orders add column if not exists payment_account_id uuid references organiser_bank_accounts(id);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='events'::regclass and conname='events_own_payment_account_fk') then
    alter table events add constraint events_own_payment_account_fk
      foreign key (organiser_id,payment_account_id) references organiser_bank_accounts(organiser_id,id);
  end if;
end $$;

-- Import existing details into the review queue. A saved account is not evidence of verification.
-- Match older events to their imported account so verified details become available after review.
with imported as (
  insert into organiser_bank_accounts(organiser_id,bank_name,account_name,account_number)
  select organiser_id,bank_name,account_name,account_number from organiser_payment_accounts legacy
  where account_number ~ '^[0-9]{10,12}$'
    and not exists(select 1 from organiser_bank_accounts a where a.organiser_id=legacy.organiser_id
      and lower(a.bank_name)=lower(legacy.bank_name) and a.account_number=legacy.account_number)
  on conflict do nothing returning id,organiser_id
)
update events e set payment_account_id=a.id from imported a
where e.organiser_id=a.organiser_id and e.price_ngn>0 and e.payment_account_id is null;
