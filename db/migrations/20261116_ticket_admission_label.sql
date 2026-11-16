-- Custom ticket admission copy is tenant/event-specific and is snapshotted on issue.
alter table events add column if not exists admission_label text not null default 'ADMIT ONE';
alter table ticket_deliveries add column if not exists admission_label text not null default 'ADMIT ONE';
