-- Capacity-safe short-lived inventory holds for manually verified payments.
alter table ticket_orders add column if not exists reservation_expires_at timestamptz;
alter table ticket_orders add column if not exists refund_status text not null default 'not_required';
alter table ticket_orders add column if not exists refund_note text not null default '';
alter table ticket_orders add column if not exists refund_updated_at timestamptz;
alter table ticket_orders add column if not exists refund_updated_by uuid references app_users(id);
create index if not exists idx_order_inventory_hold on ticket_orders(event_id,reservation_expires_at) where status='pending';
create index if not exists idx_refund_review on ticket_orders(refund_status,created_at);
-- Existing pending orders predate reservations; preserve a short migration grace.
update ticket_orders set reservation_expires_at=now()+interval '45 minutes' where status='pending' and reservation_expires_at is null;
