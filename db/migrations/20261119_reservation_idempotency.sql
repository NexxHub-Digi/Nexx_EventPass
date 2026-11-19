alter table ticket_orders add column if not exists reservation_key uuid;
create unique index if not exists ticket_orders_buyer_reservation_key_idx
  on ticket_orders(buyer_id,reservation_key);
