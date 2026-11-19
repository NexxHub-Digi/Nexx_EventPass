alter table event_ticket_categories add column if not exists price_ngn integer
  check (price_ngn between 0 and 214748364);

alter table ticket_orders add column if not exists unit_price_ngn integer
  check (unit_price_ngn >= 0);
