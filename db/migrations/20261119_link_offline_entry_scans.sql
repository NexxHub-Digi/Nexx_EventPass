alter table entry_scans add column if not exists offline_ticket_id uuid references offline_tickets(id);

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='entry_scans'::regclass and conname='entry_scans_single_ticket_source') then
    alter table entry_scans add constraint entry_scans_single_ticket_source
      check (ticket_id is null or offline_ticket_id is null);
  end if;
end $$;
create index if not exists idx_entry_scans_offline_ticket on entry_scans(offline_ticket_id)
  where offline_ticket_id is not null;
