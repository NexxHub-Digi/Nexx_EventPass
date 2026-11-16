-- EventPass schema. Run only in a dedicated EventPass Supabase project.
create extension if not exists pgcrypto;
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 name text not null check(length(name) between 2 and 140),
 venue text not null,
 starts_at timestamptz not null,
 capacity integer not null check(capacity between 1 and 1000000),
 status text not null default 'draft' check(status in ('draft','published','cancelled')),
 created_at timestamptz not null default now()
);
create table if not exists public.event_staff (
 event_id uuid not null references public.events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('supervisor','gate')),
 primary key(event_id,user_id)
);
create table if not exists public.tickets (
 id uuid primary key,
 event_id uuid not null references public.events(id) on delete restrict,
 guest_name text not null,
 guest_email text not null,
 tier text not null,
 qr_token text not null unique,
 issued_by uuid not null references auth.users(id),
 status text not null default 'issued' check(status in ('issued','redeemed','revoked')),
 created_at timestamptz not null default now(),
 checked_in_at timestamptz,
 checked_in_by uuid references auth.users(id),
 gate text
);
create index if not exists eventpass_tickets_event_status_idx on public.tickets(event_id,status);
create table if not exists public.entry_audit (
 id bigint generated always as identity primary key,
 event_id uuid not null references public.events(id),
 ticket_id uuid references public.tickets(id),
 staff_id uuid not null references auth.users(id),
 gate text not null,
 outcome text not null check(outcome in ('valid','duplicate','invalid')),
 reason text,
 occurred_at timestamptz not null default now()
);
create index if not exists eventpass_entry_audit_event_idx on public.entry_audit(event_id,occurred_at desc);
alter table public.events enable row level security;
alter table public.event_staff enable row level security;
alter table public.tickets enable row level security;
alter table public.entry_audit enable row level security;
drop policy if exists eventpass_events_select on public.events;
create policy eventpass_events_select on public.events for select to anon,authenticated using (
 status='published' or owner_id=(select auth.uid())
);
drop policy if exists eventpass_events_owner_insert on public.events;
create policy eventpass_events_owner_insert on public.events for insert to authenticated with check(owner_id=(select auth.uid()));
drop policy if exists eventpass_events_owner_update on public.events;
create policy eventpass_events_owner_update on public.events for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
drop policy if exists eventpass_staff_select on public.event_staff;
create policy eventpass_staff_select on public.event_staff for select to authenticated using(
 user_id=(select auth.uid()) or exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select auth.uid()))
);
drop policy if exists eventpass_staff_owner_insert on public.event_staff;
create policy eventpass_staff_owner_insert on public.event_staff for insert to authenticated with check(
 exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select auth.uid()))
);
drop policy if exists eventpass_staff_owner_delete on public.event_staff;
create policy eventpass_staff_owner_delete on public.event_staff for delete to authenticated using(
 exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select auth.uid()))
);
drop policy if exists eventpass_tickets_owner_select on public.tickets;
create policy eventpass_tickets_owner_select on public.tickets for select to authenticated using (
 exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select auth.uid()))
);
drop policy if exists eventpass_audit_owner_select on public.entry_audit;
create policy eventpass_audit_owner_select on public.entry_audit for select to authenticated using (
 exists(select 1 from public.events e where e.id=event_id and e.owner_id=(select auth.uid()))
);
-- No client-side INSERT/UPDATE/DELETE permissions on tickets or entry audit.
revoke all on public.tickets from anon,authenticated;
grant select on public.tickets to authenticated;
revoke all on public.entry_audit from anon,authenticated;
grant select on public.entry_audit to authenticated;
grant select on public.events to anon,authenticated;
grant insert,update on public.events to authenticated;
grant select,insert,delete on public.event_staff to authenticated;

create or replace function public.issue_ticket(
 p_id uuid,p_event_id uuid,p_actor uuid,p_guest_name text,p_guest_email text,p_tier text,p_qr_token text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events%rowtype; n bigint; t public.tickets%rowtype;
begin
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Event not found';end if;
 if e.owner_id <> p_actor then raise exception 'FORBIDDEN';end if;
 if e.status <> 'published' then raise exception 'Event not published';end if;
 select count(*) into n from public.tickets where event_id=p_event_id and status<>'revoked';
 if n>=e.capacity then raise exception 'Capacity reached';end if;
 insert into public.tickets(id,event_id,guest_name,guest_email,tier,qr_token,issued_by)
 values(p_id,p_event_id,p_guest_name,p_guest_email,p_tier,p_qr_token,p_actor)
 returning * into t;
 return jsonb_build_object('id',t.id,'event_id',t.event_id,'guest_name',t.guest_name,'guest_email',t.guest_email,'tier',t.tier,'qr_token',t.qr_token,'status',t.status);
end $$;
revoke all on function public.issue_ticket(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.issue_ticket(uuid,uuid,uuid,text,text,text,text) to service_role;

create or replace function public.redeem_ticket(
 p_ticket_id uuid,p_event_id uuid,p_actor_uid uuid,p_gate text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.events%rowtype;t public.tickets%rowtype;outcome text;reason text;at_time timestamptz;
begin
 select * into e from public.events where id=p_event_id;
 if not found then raise exception 'Event not found';end if;
 if not (e.owner_id=p_actor_uid or exists(select 1 from public.event_staff s where s.event_id=p_event_id and s.user_id=p_actor_uid)) then
 raise exception 'FORBIDDEN';
 end if;
 -- UPDATE serialises concurrent redemption attempts on the same ticket.
 update public.tickets set status='redeemed',checked_in_at=now(),checked_in_by=p_actor_uid,gate=p_gate
 where id=p_ticket_id and event_id=p_event_id and status='issued' and e.status='published'
 and now() between e.starts_at - interval '6 hours' and e.starts_at + interval '24 hours'
 returning * into t;
 if found then outcome:='valid';reason:='Admission approved';at_time:=t.checked_in_at;
 else
  select * into t from public.tickets where id=p_ticket_id and event_id=p_event_id;
  if t.id is null then outcome:='invalid';reason:='Unknown ticket';
  elsif t.status='redeemed' then outcome:='duplicate';reason:='Ticket already redeemed';at_time:=t.checked_in_at;
  elsif t.status='revoked' then outcome:='invalid';reason:='Ticket revoked';
  else outcome:='invalid';reason:='Event not open for check-in';end if;
 end if;
 insert into public.entry_audit(event_id,ticket_id,staff_id,gate,outcome,reason)
 values(p_event_id,case when t.id is null then null else t.id end,p_actor_uid,p_gate,outcome,reason);
 return jsonb_build_object('outcome',outcome,'reason',reason,'ticket_id',t.id,'guest_name',case when outcome='valid' then t.guest_name else null end,'checked_in_at',at_time);
end $$;
revoke all on function public.redeem_ticket(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.redeem_ticket(uuid,uuid,uuid,text) to service_role;
