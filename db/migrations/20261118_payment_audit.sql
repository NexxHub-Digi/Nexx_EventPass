create table if not exists ticket_payment_audit (
 id bigint generated always as identity primary key,
 order_id uuid not null references ticket_orders(id),
 actor_id uuid not null references app_users(id),
 action text not null,
 details jsonb not null default '{}'::jsonb,
 occurred_at timestamptz not null default now()
);
create index if not exists idx_payment_audit_order on ticket_payment_audit(order_id,occurred_at desc);
