-- Multi-tenant administrator support and immediate, in-app ticket delivery.
create table if not exists platform_support_cases (
 id uuid primary key default gen_random_uuid(),
 organiser_id uuid not null references app_users(id),
 opened_by uuid not null references app_users(id),
 assigned_to uuid references app_users(id),
 subject text not null,
 description text not null,
 status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 resolution text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_support_organiser on platform_support_cases(organiser_id,created_at desc);
create table if not exists platform_settings (
 setting_key text primary key,
 setting_value jsonb not null,
 updated_by uuid references app_users(id),
 updated_at timestamptz not null default now()
);
create table if not exists ticket_deliveries (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null unique references tickets(id),
 order_id uuid not null references ticket_orders(id),
 recipient_id uuid not null references app_users(id),
 event_id uuid not null references events(id),
 ticket_theme text not null,
 ticket_art_id uuid references event_media(id) on delete set null,
 delivery_channel text not null default 'in_app',
 status text not null default 'available',
 created_at timestamptz not null default now(),
 viewed_at timestamptz
);
create index if not exists idx_ticket_deliveries_recipient on ticket_deliveries(recipient_id,created_at desc);
