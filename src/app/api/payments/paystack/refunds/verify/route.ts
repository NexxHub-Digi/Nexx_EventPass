import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {paystackApi,paystackTestEnabled} from '@/lib/paystack';
import {matchesProcessedRefund,type ProviderRefund} from '@/lib/paystack-refund-verification';
import {fail,ok,payload,str} from '@/lib/http';
export const runtime='nodejs';
// Read-only provider lookup: this endpoint never initiates a refund or transfers money.
export async function POST(req:Request){
 try{
  const admin=await currentUser();
  if(!admin||admin.role!=='platform_admin'||admin.account_status!=='active')return fail('Platform administrator only',403);
  if(!paystackTestEnabled())return fail('Paystack sandbox verification is disabled',503);
  const b=await payload(req),orderId=str(b.orderId,40),providerId=str(b.providerRefundId,20);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)||!/^[1-9][0-9]{0,19}$/.test(providerId))return fail('Valid order and numeric provider refund ID required',400);
  const [record]=await db()`select p.id,p.provider_transaction_id,p.amount_kobo,o.status,o.refund_status
    from paystack_payments p join ticket_orders o on o.id=p.order_id where o.id=${orderId} and o.payment_method='paystack'`;
  if(!record||!record.provider_transaction_id||record.status==='approved'||!['review_required','initiated','settled'].includes(record.refund_status))
   return fail('Order must have a verified provider transaction and supervised refund review',409);
  const evidence=await paystackApi<ProviderRefund>('/refund/'+providerId);
  if(!matchesProcessedRefund(evidence,providerId,String(record.provider_transaction_id),Number(record.amount_kobo)))return fail('Provider has not confirmed a matching full test refund',409);
  const result=await db().begin(async tx=>{
    const [order]=await tx`select o.id,o.status,o.refund_status,p.id as payment_id,p.amount_kobo,p.provider_transaction_id
      from ticket_orders o join events e on e.id=o.event_id join paystack_payments p on p.order_id=o.id
      where o.id=${orderId} and o.payment_method='paystack' for update of e,o,p`;
    if(!order||order.status==='approved'||!['review_required','initiated','settled'].includes(order.refund_status)||
      !matchesProcessedRefund(evidence,providerId,String(order.provider_transaction_id),Number(order.amount_kobo)))return {error:'Order changed during verification'};
    const [actor]=await tx`select id from app_users where id=${admin.id} and role='platform_admin' and account_status='active' for share`;
    if(!actor)return {error:'Administrator access changed'};
    const active=await tx`select id from tickets where order_id=${orderId} and (status='issued' or redeemed_at is not null) limit 1`;
    if(active.length)return {error:'Active or redeemed tickets prevent settlement'};
    const [existing]=await tx`select provider_refund_id,status from paystack_refunds where payment_id=${order.payment_id} for update`;
    if(existing?.provider_refund_id&&existing.provider_refund_id!==providerId)return {error:'Another provider refund is associated with this order'};
    if(order.refund_status==='settled')return existing?.status==='processed'&&existing.provider_refund_id===providerId?{success:true,replayed:true}:{error:'Order already settled by another process'};
    const [written]=await tx`insert into paystack_refunds(payment_id,requested_by,reason,refund_reference,provider_refund_id,status)
      values(${order.payment_id},${admin.id},'Verified full sandbox refund',${'EP-R-'+order.payment_id},${providerId},'processed')
      on conflict(payment_id) do update set provider_refund_id=excluded.provider_refund_id,status='processed',updated_at=now()
      where paystack_refunds.provider_refund_id is null or paystack_refunds.provider_refund_id=excluded.provider_refund_id returning id`;
    if(!written)return {error:'Refund record changed'};
    await tx`update paystack_payments set status='refunded',updated_at=now(),last_error=null where id=${order.payment_id}`;
    await tx`update ticket_orders set status='cancelled',refund_status='settled',refund_note=${'Provider verified sandbox refund '+providerId},refund_updated_at=now(),refund_updated_by=${admin.id} where id=${orderId}`;
    await tx`insert into ticket_payment_audit(order_id,actor_id,action,details) values(${orderId},${admin.id},'paystack_refund_verified',${tx.json({providerId,amountKobo:Number(order.amount_kobo),mode:'test'})})`;
    await tx`insert into platform_admin_actions(admin_id,action,details) values(${admin.id},'paystack_refund_verified',${tx.json({orderId,providerId,mode:'test'})})`;
    return {success:true,replayed:false};
  });
  return 'error' in result?fail(String(result.error),409):ok({...result,mode:'test'});
 }catch(e){if((e as {code?:string})?.code==='23505')return fail('Refund evidence already belongs to a different order',409);return fail('Provider refund verification unavailable',503);}
}
