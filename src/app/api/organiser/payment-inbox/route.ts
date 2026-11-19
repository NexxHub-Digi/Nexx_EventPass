import { db } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/http';
import { currentUser } from '@/lib/security';

export const runtime='nodejs';

export async function GET(){
 try{
  const user=await currentUser();
  if(!user||user.role!=='organiser'||user.account_status!=='active')return fail('Active organiser required',403);
  const sql=db();
  const payments=await sql`select o.id,o.event_id,e.title as event_title,o.amount_ngn,o.quantity,o.payment_reference,
    o.reservation_expires_at,o.receipt_uploaded_at,o.receipt_mime,u.full_name as buyer_name,n.read_at
   from ticket_orders o join events e on e.id=o.event_id join app_users u on u.id=o.buyer_id
   join payment_review_notifications n on n.order_id=o.id
   where e.organiser_id=${user.id} and o.status='pending' and o.reservation_expires_at>now()
   order by o.reservation_expires_at,o.id limit 100`;
  const [counts]=await sql`select count(*)::int as pending,count(*) filter(where n.read_at is null)::int as unread
   from ticket_orders o join events e on e.id=o.event_id join payment_review_notifications n on n.order_id=o.id
   where e.organiser_id=${user.id} and o.status='pending' and o.reservation_expires_at>now()`;
  return ok({payments,...counts});
 }catch(error){return handleError(error)}
}

export async function PATCH(){
 try{
  const user=await currentUser();
  if(!user||user.role!=='organiser'||user.account_status!=='active')return fail('Active organiser required',403);
  await db()`update payment_review_notifications n set read_at=now()
   from ticket_orders o join events e on e.id=o.event_id
   where n.order_id=o.id and e.organiser_id=${user.id} and o.status='pending'
    and o.reservation_expires_at>now() and n.read_at is null`;
  return ok({success:true});
 }catch(error){return handleError(error)}
}
