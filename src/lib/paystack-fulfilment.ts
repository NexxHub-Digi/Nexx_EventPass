import {db} from '@/lib/db';
import {paystackApi,paystackTestEnabled,validPaystackCharge,isPaystackRefundState,type VerifiedPaystackCharge} from '@/lib/paystack';
import {issueTicketCredential} from '@/lib/ticket-credentials';
import {registerEntryCode} from '@/lib/ticket-entry-code';
import {makeIssuedDesignSnapshot,type SavedDesign} from '@/lib/ticket-design-snapshot';
export type Reconciliation={status:'pending'|'issued'|'already_issued'|'reconciliation_required'|'refund_pending'|'refunded'|'refund_failed';ticketsIssued?:number};
export async function reconcilePaystackReference(reference:string):Promise<Reconciliation>{
 if(!paystackTestEnabled()||!/^EP-[a-f0-9-]{36}$/i.test(reference))throw Error('Paystack test mode or reference invalid');
 const [record]=await db()`select order_id,amount_kobo,status from paystack_payments where reference=${reference}`;
 if(!record)throw Error('Payment reference not found');
 if(isPaystackRefundState(record.status))return {status:record.status};
 const charge=await paystackApi<VerifiedPaystackCharge>('/transaction/verify/'+encodeURIComponent(reference));
 if(charge.status!=='success')return {status:'pending'};
 if(!validPaystackCharge(charge,reference,Number(record.amount_kobo))){
  await db()`update paystack_payments set status='reconciliation_required',last_error='Provider verification mismatch',updated_at=now()
   where reference=${reference} and status not in ('success','refund_pending','refunded','refund_failed')`;
  return {status:'reconciliation_required'};
 }
 return db().begin(async tx=>{
  const [link]=await tx`select o.event_id from paystack_payments p join ticket_orders o on o.id=p.order_id
   where p.reference=${reference}`;
  if(!link)throw Error('Provider payment has no reservation');
  // Every checkout and admission operation locks the event first to serialize inventory changes.
  const [event]=await tx`select e.id,e.capacity,e.status,e.verification_status,e.starts_at,e.organiser_id,
   a.role as owner_role,a.account_status as owner_status from events e join app_users a on a.id=e.organiser_id
   where e.id=${link.event_id} for update of e`;
  if(!event)throw Error('Event missing during reconciliation');
  const [order]=await tx`select * from ticket_orders where id=${record.order_id} for update`;
  const [payment]=await tx`select * from paystack_payments where reference=${reference} for update`;
  if(!order||!payment)throw Error('Payment record missing');
  if(isPaystackRefundState(payment.status))return {status:payment.status};
  if(order.status==='approved'&&payment.status==='success'){
   const [n]=await tx`select count(*)::int as count from tickets where order_id=${order.id}`;
   return {status:'already_issued' as const,ticketsIssued:Number(n.count)};
  }
  const valid=order.status==='pending'&&order.payment_method==='paystack'&&
   new Date(order.reservation_expires_at).getTime()>Date.now()&&
   new Date(event.starts_at).getTime()+4*60*60*1000>Date.now()&&
   event.status==='published'&&event.verification_status==='verified'&&
   event.owner_role==='organiser'&&event.owner_status==='active'&&
   payment.order_id===order.id&&payment.buyer_id===order.buyer_id&&
   payment.organiser_id===event.organiser_id&&payment.status!=='refunded'&&
   Number(order.amount_ngn)*100===Number(payment.amount_kobo);
  if(!valid){
   await tx`update paystack_payments set status='reconciliation_required',
    last_error='Paid reservation expired or no longer eligible',updated_at=now() where id=${payment.id}`;
   if(order.status!=='approved'&&order.refund_status==='not_required')await tx`update ticket_orders
    set refund_status='review_required',refund_note='Verified Paystack payment requires supervised reconciliation',
     refund_updated_at=now() where id=${order.id}`;
   return {status:'reconciliation_required' as const};
  }
  const [usage]=await tx`select
   ((select count(*)::int from tickets where event_id=${event.id} and status='issued')+
    (select count(*)::int from offline_tickets where event_id=${event.id} and status='issued')) as all_issued,
   ((select count(*)::int from tickets t join ticket_orders o on o.id=t.order_id where t.event_id=${event.id}
    and t.status='issued' and o.ticket_category_id is not distinct from ${order.ticket_category_id}::uuid)+
    (select count(*)::int from offline_tickets t join offline_ticket_batches b on b.id=t.batch_id
    where t.event_id=${event.id} and t.status='issued'
    and b.ticket_category_id is not distinct from ${order.ticket_category_id}::uuid)) as pool_issued`;
  const categories=await tx`select id,capacity from event_ticket_categories where event_id=${event.id}`;
  const selected=categories.find(c=>c.id===order.ticket_category_id);
  const pool=order.ticket_category_id?Number(selected?.capacity):
   Number(event.capacity)-categories.reduce((a,c)=>a+Number(c.capacity),0);
  if(!Number.isFinite(pool)||Number(usage.all_issued)+Number(order.quantity)>Number(event.capacity)||
     Number(usage.pool_issued)+Number(order.quantity)>pool){
   await tx`update paystack_payments set status='reconciliation_required',
     last_error='Inventory exhausted after provider settlement',updated_at=now() where id=${payment.id}`;
   await tx`update ticket_orders set refund_status='review_required',
     refund_note='Paid reservation requires inventory reconciliation',refund_updated_at=now()
     where id=${order.id} and refund_status='not_required'`;
   return {status:'reconciliation_required' as const};
  }
  const [design]=await tx`select e.ticket_theme,e.admission_label,e.qr_keyword_ciphertext,
    (select id from event_media m where m.event_id=e.id and m.media_type='ticket_art'
    and m.approved order by m.created_at asc limit 1) as ticket_art_id from events e where e.id=${event.id}`;
  const [savedDesign]=await tx`select version,theme_id,mode,fields,enabled from event_ticket_design_versions
   where event_id=${event.id} order by version desc limit 1`;
  const snapshot=makeIssuedDesignSnapshot((savedDesign||null) as SavedDesign|null,order.ticket_category_id||null);
  const issuedTheme=snapshot?.theme||design.ticket_theme;
  const [ledger]=await tx`insert into verified_order_payments
   (order_id,method,gross_ngn,commission_basis_points,collection_reference,verified_by)
   values(${order.id},'paystack',${order.amount_ngn},${payment.commission_basis_points},${reference},null)
   on conflict(order_id) do nothing returning order_id`;
  if(!ledger)throw Error('Reservation has a different payment ledger');
  for(let i=0;i<Number(order.quantity);i++){
   const id=crypto.randomUUID(),credential=issueTicketCredential(id,event.id,design.qr_keyword_ciphertext);
   await tx`insert into tickets(id,event_id,order_id,owner_id,qr_credential)
    values(${id},${event.id},${order.id},${order.buyer_id},${credential})`;
   await registerEntryCode(tx,event.id,id,'online');
   await tx`insert into ticket_deliveries
    (ticket_id,order_id,recipient_id,event_id,ticket_theme,ticket_art_id,admission_label,design_version,design_snapshot)
    values(${id},${order.id},${order.buyer_id},${event.id},
     ${issuedTheme},${design.ticket_art_id},${design.admission_label},${snapshot?.version||null},${snapshot?tx.json(snapshot):null})`;
  }
  await tx`update ticket_orders set status='approved',reviewed_at=now(),reviewed_by=null where id=${order.id}`;
  await tx`update paystack_payments set status='success',provider_transaction_id=${String(charge.id)},
    provider_paid_at=now(),updated_at=now(),last_error=null where id=${payment.id}`;
  await tx`insert into ticket_payment_audit(order_id,actor_id,action,details)
   values(${order.id},null,'paystack_payment_verified',
   ${JSON.stringify({reference,issued:Number(order.quantity),providerId:String(charge.id)})}::jsonb)`;
  return {status:'issued' as const,ticketsIssued:Number(order.quantity)};
 });
}
