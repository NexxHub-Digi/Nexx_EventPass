create table if not exists event_ticket_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  name text not null check (char_length(trim(name)) between 1 and 60),
  capacity integer not null check (capacity > 0),
  unique (event_id, id)
);
create unique index if not exists event_ticket_categories_name_idx
  on event_ticket_categories (event_id, lower(name));

alter table ticket_orders add column if not exists ticket_category_id uuid;
alter table offline_ticket_batches add column if not exists ticket_category_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ticket_orders_event_category_fk' and conrelid='ticket_orders'::regclass) then
    alter table ticket_orders add constraint ticket_orders_event_category_fk
      foreign key (event_id, ticket_category_id) references event_ticket_categories(event_id,id);
  end if;
  if not exists (select 1 from pg_constraint where conname='offline_batches_event_category_fk' and conrelid='offline_ticket_batches'::regclass) then
    alter table offline_ticket_batches add constraint offline_batches_event_category_fk
      foreign key (event_id, ticket_category_id) references event_ticket_categories(event_id,id);
  end if;
end $$;
