import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const u=await currentUser();if(!u||u.account_status!=='active'||!['organiser','platform_admin'].includes(u.role))return fail('Organiser or Platform Admin only',403);
  const eventId=str(new URL(req.url).searchParams.get('eventId'),40);
  const orders=u.role==='platform_admin'?
   await db()`select o.id,o.event_id,o.buyer_id,o.status,o.payment_method,o.quantity,o.amount_ngn,o.refund_status,o.refund_note,o.reservation_expires_at,o.created_at,
    e.title as event_title,host.full_name as organiser_name,buyer.email as buyer_email
    from ticket_orders o join events e on e.id=o.event_id join app_users host on host.id=e.organiser_id
    join app_users buyer on buyer.id=o.buyer_id
    where (${eventId}='' or o.event_id::text=${eventId}) and
     (o.refund_status!='not_required' or (o.status='pending' and o.reservation_expires_at<=now() and o.receipt_data is not null))
    order by o.created_at desc limit 150`:
   await db()`select o.id,o.event_id,o.buyer_id,o.status,o.payment_method,o.quantity,o.amount_ngn,o.refund_status,o.refund_note,o.reservation_expires_at,o.created_at,
    e.title as event_title,host.full_name as organiser_name,buyer.email as buyer_email
    from ticket_orders o join events e on e.id=o.event_id join app_users host on host.id=e.organiser_id
    join app_users buyer on buyer.id=o.buyer_id
    where e.organiser_id=${u.id} and (${eventId}='' or o.event_id::text=${eventId})
    and (o.refund_status!='not_required' or (o.status='pending' and o.reservation_expires_at<=now() and o.receipt_data is not null))
    order by o.created_at desc limit 150`;
  // Administrators can inspect previously issued paid orders before a supervised
  // cancellation. Redeemed, already revoked, or partially issued admissions are
  // presented as blocked, not as actionable refund buttons.
  const issuedOrders=u.role==='platform_admin'?await db()`select o.id,o.event_id,o.quantity,o.amount_ngn,o.payment_method,
    e.title as event_title,buyer.email as buyer_email,
    count(t.id)::int as ticket_count,
    count(t.id) filter(where t.status='issued' and t.redeemed_at is null)::int as unused_count,
    count(t.id) filter(where t.redeemed_at is not null)::int as admitted_count
    from ticket_orders o join events e on e.id=o.event_id
    join app_users buyer on buyer.id=o.buyer_id
    left join tickets t on t.order_id=o.id
    where o.status='approved' and (${eventId}='' or o.event_id::text=${eventId})
    group by o.id,e.title,buyer.email
    order by o.created_at desc limit 100`:[];
  return ok({orders,issuedOrders});
 }catch(e){return handleError(e)}
}
export async function PATCH(req:Request){
 try{
  const u=await currentUser();if(!u||u.account_status!=='active'||!['organiser','platform_admin'].includes(u.role))return fail('Organiser or Platform Admin only',403);
  const b=await payload(req),orderId=str(b.orderId,40),action=str(b.action,30),note=str(b.note,500);
  if(!/^[0-9a-f-]{36}$/i.test(orderId)||!['cancel_issued','review_required','initiated','settled'].includes(action))return fail('Invalid refund update',400);
  if(action==='cancel_issued'&&note.trim().length<15)return fail('Explain the supervised cancellation and reason (15+ characters)',400);
  if(action==='settled'&&note.length<10)return fail('Provide settlement evidence/reference in the note before marking refunded',400);
  const result=await db().begin(async tx=>{
   // The event lock serializes cancellation with inventory writers; each ticket row is
   // additionally locked to serialize against concurrent gate admission.
   const rows=await tx`select o.id,o.event_id,o.quantity,o.amount_ngn,o.payment_method,o.status,o.refund_status,o.receipt_data,o.reservation_expires_at,
     e.organiser_id from ticket_orders o join events e on e.id=o.event_id where o.id=${orderId} for update of e,o`;
   const order=rows[0];if(!order)return {error:'Order not found',status:404};
   if(u.role!=='platform_admin'&&order.organiser_id!==u.id)return {error:'Not your event',status:403};
   if(action==='cancel_issued'){
    if(u.role!=='platform_admin')return {error:'Only Platform Administrator can cancel issued tickets',status:403};
    if(order.status!=='approved')return {error:'Only approved orders with issued tickets can be cancelled here',status:409};
    const tickets=await tx`select id,status,redeemed_at from tickets where order_id=${orderId} order by id for update`;
    if(tickets.length!==Number(order.quantity)||tickets.some(t=>t.status!=='issued'||t.redeemed_at))
     return {error:'Cancellation blocked: all tickets must be currently issued and unused',status:409};
    const [verified]=await tx`select order_id from verified_order_payments where order_id=${orderId}`;
    if(Number(order.amount_ngn)>0&&!verified)return {error:'Payment verification must be reconciled first',status:409};
    await tx`update tickets set status='revoked' where order_id=${orderId} and status='issued'`;
    const nextRefund=Number(order.amount_ngn)>0?'review_required':'not_required';
    await tx`update ticket_orders set status='cancelled',refund_status=${nextRefund},refund_note=${note},
      refund_updated_at=now(),refund_updated_by=${u.id} where id=${orderId}`;
    await tx`insert into ticket_payment_audit(order_id,actor_id,action,details)
      values(${orderId},${u.id},'issued_tickets_cancelled',
       ${tx.json({reason:note,revoked:tickets.length,refundStatus:nextRefund,paymentMethod:order.payment_method})})`;
    await tx`insert into platform_admin_actions(admin_id,target_user_id,action,details)
      select ${u.id},o.buyer_id,'cancel_issued_order',${tx.json({orderId,reason:note,revoked:tickets.length,refundStatus:nextRefund})}
      from ticket_orders o where o.id=${orderId}`;
    return {success:true,order_status:'cancelled',refund_status:nextRefund,revoked:tickets.length};
   }
   if(order.status==='approved')return {error:'Issued ticket requires supervised cancellation first',status:409};
   if(order.status==='cancelled'&&order.refund_status==='not_required')return {error:'This cancellation requires no refund',status:409};
   if(order.payment_method==='paystack'&&action==='settled')
    return {error:'Paystack refunds require provider-verified settlement; manual settlement is prohibited',status:409};
   if(Number(order.amount_ngn)<=0)return {error:'This order has no refundable amount',status:409};
   if(order.status==='cancelled'){
    const verified=await tx`select 1 from verified_order_payments where order_id=${orderId}`;
    if(!verified.length)return {error:'No verified payment exists for this cancellation',status:409};
    if(u.role!=='platform_admin')return {error:'Refund of a cancelled issued order requires Platform Administrator',status:403};
   }else if(!order.receipt_data)return {error:'No submitted receipt to reconcile',status:409};
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
