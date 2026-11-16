-- Guest wallet visibility through verified Supabase Auth email.
drop policy if exists eventpass_tickets_guest_select on public.tickets;
create policy eventpass_tickets_guest_select on public.tickets for select to authenticated
using (lower(guest_email)=lower(coalesce((select auth.jwt()->>'email'),'')));
-- Resolve an existing, authenticated staff member by email, owner-only.
create or replace function public.assign_event_staff_by_email(
 p_event_id uuid,p_owner_uid uuid,p_email text,p_role text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare staff_uid uuid;
begin
 if not exists(select 1 from public.events where id=p_event_id and owner_id=p_owner_uid)
 then raise exception 'FORBIDDEN';end if;
 if p_role not in ('gate','supervisor') then raise exception 'Invalid role';end if;
 select id into staff_uid from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null;
 if staff_uid is null then raise exception 'Staff member must sign in and verify their email first';end if;
 insert into public.event_staff(event_id,user_id,role)
 values(p_event_id,staff_uid,p_role)
 on conflict(event_id,user_id) do update set role=excluded.role;
 return jsonb_build_object('event_id',p_event_id,'user_id',staff_uid,'role',p_role);
end $$;
revoke all on function public.assign_event_staff_by_email(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.assign_event_staff_by_email(uuid,uuid,text,text) to service_role;
