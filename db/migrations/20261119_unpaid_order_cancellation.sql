alter table ticket_orders drop constraint if exists ticket_orders_status_check;
alter table ticket_orders add constraint ticket_orders_status_check
  check (status in ('pending','approved','rejected','cancelled'));
