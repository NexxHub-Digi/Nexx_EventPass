-- External EventPass ticketing: additive migration. Existing online orders/tickets are untouched.
alter table events add column if not exists visibility text not null default 'public';
alter table events drop constraint if exists events_visibility_check;
alter table events add constraint events_visibility_check check (visibility in ('public','unlisted','private'));

create table if not exists offline_ticket_batches (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references events(id),
 organiser_id uuid not null references app_users(id),
 created_by uuid not null references app_users(id),
 idempotency_key text not null,
 label text not null default '',
 category text not null default 'General',
 ticket_theme text not null,
 admission_label text not null default 'ADMIT ONE',
 quantity int not null check (quantity between 1 and 500),
 created_at timestamptz not null default now(),
 unique (organiser_id,idempotency_key)
);
create index if not exists offline_batches_event_idx on offline_ticket_batches(event_id,created_at desc);

create table if not exists offline_tickets (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references offline_ticket_batches(id),
 event_id uuid not null references events(id),
 organiser_id uuid not null references app_users(id),
 serial_number int not null check (serial_number > 0),
 status text not null default 'issued' check (status in ('issued','revoked')),
 active boolean not null default false,
 distribution text not null default 'unassigned' check(distribution in ('unassigned','distributed','sold','complimentary')),
 recipient_name text,
 recipient_contact text,
 sale_amount_ngn integer check (sale_amount_ngn is null or sale_amount_ngn >= 0),
 sale_note text,
 redeemed_at timestamptz,
 redeemed_by uuid references app_users(id),
 replaced_by uuid references offline_tickets(id),
 created_at timestamptz not null default now(),
 unique (batch_id,serial_number)
);
create index if not exists offline_tickets_event_idx on offline_tickets(event_id,status,active);
create index if not exists offline_tickets_batch_idx on offline_tickets(batch_id);

create table if not exists offline_ticket_audit (
 id uuid primary key default gen_random_uuid(),
 organiser_id uuid not null references app_users(id),
 event_id uuid not null references events(id),
 batch_id uuid references offline_ticket_batches(id),
 ticket_id uuid references offline_tickets(id),
 actor_id uuid not null references app_users(id),
 operation_id uuid not null,
 action text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists offline_audit_event_idx on offline_ticket_audit(event_id,created_at desc);

create table if not exists offline_ticket_staff (
 id uuid primary key default gen_random_uuid(),
 organiser_id uuid not null references app_users(id),
 user_id uuid not null references app_users(id),
 permissions text[] not null default '{}',
 scope text not null check(scope in ('selected','all')),
 selected_event_ids uuid[] not null default '{}',
 include_future boolean not null default false,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 revoked_at timestamptz,
 unique (organiser_id,user_id)
);