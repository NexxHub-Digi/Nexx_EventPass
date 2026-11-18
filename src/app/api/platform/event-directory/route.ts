import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,str} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const u=await currentUser();if(!u||u.account_status!=='active'||!['organiser','platform_admin'].includes(u.role))return fail('Organiser or Platform Admin required',403);
  const query=str(new URL(req.url).searchParams.get('q'),120).toLowerCase();
  const eventId=str(new URL(req.url).searchParams.get('eventId'),40);
  const canSeeAll=u.role==='platform_admin';
  const rows=await db()`select e.id,e.title,e.venue,e.starts_at,e.status,e.verification_status,e.capacity,e.price_ngn,e.ticket_theme,e.admission_label,
   host.id as organiser_id,host.full_name as organiser_name,host.email as organiser_email,
   (select count(*)::int from tickets t where t.event_id=e.id) as tickets_issued,
   (select count(*)::int from tickets t where t.event_id=e.id and t.redeemed_at is not null) as checked_in,
   (select count(*)::int from ticket_orders o where o.event_id=e.id and o.status='pending' and o.reservation_expires_at>now()) as pending_orders,
   (select coalesce(sum(o.quantity),0)::int from ticket_orders o where o.event_id=e.id and o.status='pending' and o.reservation_expires_at>now()) as reserved_seats,
   (select coalesce(sum(o.amount_ngn),0)::bigint from ticket_orders o where o.event_id=e.id and o.status='approved') as confirmed_revenue_ngn,
   (select count(*)::int from ticket_orders o where o.event_id=e.id and o.refund_status in ('review_required','initiated')) as refund_cases,
   (select count(*)::int from gate_assignments g where g.event_id=e.id) as active_gate_operators
   from events e join app_users host on host.id=e.organiser_id
   where (${canSeeAll} or e.organiser_id=${u.id}) and
    (${eventId}='' or e.id::text=${eventId}) and
    (${query}='' or lower(e.title) like ${'%'+query+'%'} or lower(host.full_name) like ${'%'+query+'%'})
   order by e.created_at desc limit 200`;
  return ok({events:rows});
 }catch(e){return handleError(e)}
}
