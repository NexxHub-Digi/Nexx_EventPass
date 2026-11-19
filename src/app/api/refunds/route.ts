import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const u=await currentUser();if(!u||u.account_status!=='active'||!['organiser','platform_admin'].includes(u.role))return fail('Organiser or Platform Admin only',403);
  const eventId=str(new URL(req.url).searchParams.get('eventId'),40);
  const orders=u.role==='platform_admin'?
   await db()`select o.id,o.event_id,o.buyer_id,o.status,o.quantity,o.amount_ngn,o.refund_status,o.refund_note,o.reservation_expires_at,o.created_at,
    e.title as event_title,host.full_name as organiser_name,buyer.email as buyer_email
    from ticket_orders o join events e on e.id=o.event_id join app_users host on host.id=e.organiser_id
    join app_users buyer on buyer.id=o.buyer_id
    where (${eventId}='' or o.event_id::text=${eventId}) and
     (o.refund_status!='not_required' or (o.status='pending' and o.reservation_expires_at<=now() and o.receipt_data is not null))
    order by o.created_at desc limit 150`:
   await db()`select o.id,o.event_id,o.buyer_id,o.status,o.quantity,o.amount_ngn,o.refund_status,o.refund_note,o.reservation_expires_at,o.created_at,
    e.title as event_title,host.full_name as organiser_name,buyer.email as buyer_email
    from ticket_orders o join events e on e.id=o.event_id join app_users host on host.id=e.organiser_id
    join app_users buyer on buyer.id=o.buyer_id
    where e.organiser_id=${u.id} and (${eventId}='' or o.event_id::text=${eventId})
    and (o.refund_status!='not_required' or (o.status='pending' and o.reservation_expires_at<=now() and o.receipt_data is not null))
    order by o.created_at desc limit 150`;
  return ok({orders});
 }catch(e){return handleError(e)}
}
export async function PATCH(req:Request){
 try{
  const u=await currentUser();if(!u||u.account_status!=='active'||!['organiser','platform_admin'].includes(u.role))return fail('Organiser or Platform Admin only',403);
  const b=await payload(req),orderId=str(b.orderId,40),action=str(b.action,30),note=str(b.note,500);
  if(!/^[0-9a-f-]{36}$/i.test(orderId)||!['review_required','initiated','settled'].includes(action))return fail('Invalid refund update',400);
  if(action==='settled'&&note.length<10)return fail('Provide settlement evidence/reference in the note before marking refunded',400);
  const result=await db().begin(async tx=>{
   const rows=await tx`select o.id,o.amount_ngn,o.status,o.refund_status,o.receipt_data,o.reservation_expires_at,
     e.organiser_id from ticket_orders o join events e on e.id=o.event_id where o.id=${orderId} for update of o`;
   const order=rows[0];if(!order)return {error:'Order not found',status:404};
   if(u.role!=='platform_admin'&&order.organiser_id!==u.id)return {error:'Not your event',status:403};
   if(order.status==='approved')return {error:'Issued ticket requires supervised cancellation first',status:409};
   if(!order.receipt_data||Number(order.amount_ngn)<=0)return {error:'No paid receipt to reconcile',status:409};
   if(order.refund_status==='settled')return {error:'Refund already settled. No further status changes are allowed',status:409};
   if(action==='initiated'&&!['review_required','initiated'].includes(order.refund_status))return {error:'Open refund review before initiating repayment',status:409};
   if(action==='review_required'&&!['not_required','review_required'].includes(order.refund_status))return {error:'Cannot return an initiated or settled refund to review',status:409};
   if(action==='settled'&&order.refund_status!=='initiated')return {error:'Record refund initiation before verifying settlement',status:409};
   await tx`update ticket_orders set refund_status=${action},refund_note=${note},refund_updated_at=now(),refund_updated_by=${u.id}
     where id=${orderId}`;
   await tx`insert into ticket_payment_audit(order_id,actor_id,action,details)
    values(${orderId},${u.id},${'refund_'+action},${JSON.stringify({note})}::jsonb)`;
   await tx`insert into platform_admin_actions(admin_id,action,details)
     select ${u.id},'refund_status',${JSON.stringify({orderId,action})}::jsonb
     where ${u.role==='platform_admin'}`;
   return {success:true,refund_status:action};
  });
  if('error' in result)return fail(String(result.error),Number(result.status));
  return ok(result);
 }catch(e){return handleError(e)}
}
