import {randomUUID} from 'node:crypto';
import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {paystackApi,paystackTestEnabled,commissionKobo} from '@/lib/paystack';
import {fail,handleError,ok,payload,str} from '@/lib/http';
import {categoryIdPattern as uuid} from '@/lib/event-inventory';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  const user=await currentUser();
  if(!user||user.account_status!=='active')return fail('Sign in required',401);
  if(!paystackTestEnabled())return fail('Paystack test mode is not configured',503);
  const body=await payload(req),orderId=str(body.orderId,40);
  if(!uuid.test(orderId))return fail('Valid reservation required',400);
  const origin=new URL(req.url).origin;
  if(!origin.startsWith('https://'))return fail('Secure HTTPS checkout required',400);
  const result=await db().begin(async tx=>{
   const [order]=await tx`select o.id,o.buyer_id,o.amount_ngn,o.status,o.payment_method,o.reservation_expires_at,
    e.organiser_id,e.status as event_status,e.verification_status,e.starts_at,e.visibility,owner.account_status,owner.role as owner_role,
    a.subaccount_code,policy.basis_points
    from ticket_orders o join events e on e.id=o.event_id join app_users owner on owner.id=e.organiser_id
    join paystack_organiser_accounts a on a.organiser_id=e.organiser_id
    cross join platform_commission_policy policy
    where o.id=${orderId} and o.buyer_id=${user.id} for update of o`;
   if(!order||order.status!=='pending'||order.payment_method!=='paystack'||
    new Date(order.reservation_expires_at).getTime()<=Date.now()||
    new Date(order.starts_at).getTime()+4*60*60*1000<=Date.now()||
    order.event_status!=='published'||order.verification_status!=='verified'||
    order.account_status!=='active'||order.owner_role!=='organiser'||order.visibility!=='public')return {error:'Active Paystack reservation required',status:409};
   const [prior]=await tx`select reference,authorization_url,status from paystack_payments where order_id=${orderId}`;
   if(prior)return {prior};
   const amount=Number(order.amount_ngn)*100;
   if(!Number.isSafeInteger(amount)||amount<=0)return {error:'Invalid payable amount',status:400};
   const fee=commissionKobo(Number(order.amount_ngn),Number(order.basis_points));
   const reference='EP-'+randomUUID();
   await tx`insert into paystack_payments(order_id,buyer_id,organiser_id,reference,amount_kobo,
    commission_basis_points,commission_kobo,subaccount_code)
    values(${orderId},${user.id},${order.organiser_id},${reference},${amount},
     ${order.basis_points},${fee},${order.subaccount_code})`;
   return {reference,amount,fee,subaccount:order.subaccount_code,orderId};
  });
  if('error' in result)return fail(String(result.error),Number(result.status));
  if('prior' in result){
   const p=result.prior;
   if(p?.status==='initialized'&&p?.authorization_url)return ok({authorization_url:p.authorization_url,reference:p.reference,mode:'test',replayed:true});
   return fail('Payment initiation is in progress or needs reconciliation. Open My Orders.',409);
  }
  try{
   const provider=await paystackApi<{authorization_url:string;reference:string}>('/transaction/initialize','POST',{
    email:user.email,amount:result.amount,currency:'NGN',reference:result.reference,
    subaccount:result.subaccount,transaction_charge:result.fee,bearer:'account',
    callback_url:origin+'/?tab=Tickets&paystack_reference='+encodeURIComponent(result.reference),
    metadata:{eventpass_order_id:result.orderId}
   });
   if(provider.reference!==result.reference||
    !/^https:\/\/checkout\.paystack\.com\/[A-Za-z0-9_-]+(?:\?.*)?$/.test(provider.authorization_url))
    throw Error('Unexpected provider authorization response');
   await db()`update paystack_payments set authorization_url=${provider.authorization_url},
    status='initialized',updated_at=now() where reference=${result.reference} and status='initiating'`;
   return ok({authorization_url:provider.authorization_url,reference:result.reference,mode:'test'});
  }catch(error){
   await db()`update paystack_payments set status='initialization_failed',last_error='Provider initialization was not completed',
    updated_at=now() where reference=${result.reference} and status='initiating'`;
   throw error;
  }
 }catch(error){return handleError(error)}
}
