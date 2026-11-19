alter table platform_support_cases add column if not exists payment_order_id uuid references ticket_orders(id);
create unique index if not exists platform_support_payment_order_idx
  on platform_support_cases(payment_order_id) where payment_order_id is not null;

create table if not exists payment_review_notifications (
  order_id uuid primary key references ticket_orders(id),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
insert into payment_review_notifications(order_id,created_at)
select id,receipt_uploaded_at from ticket_orders
where status='pending' and receipt_uploaded_at is not null and reservation_expires_at>now()
on conflict do nothing;
