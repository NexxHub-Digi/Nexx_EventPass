import {randomUUID} from 'node:crypto';
import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {paystackRequest,commissionKobo} from '@/lib/paystack';
import {fail,handleError,ok,payload} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){try{
 const user=await currentUser();if(!user||user.account_status!=='active')return fail('Sign in required',401);
 const input=await payload(req);const orderId=String(input.orderId||'');
 if(!/^[a-f0-9-]{36}$/i.test(orderId))return fail('Invalid order',400);
 const rows=await db()`select o.id,o.buyer_id,o.amount_ngn,o.status,o.reservation_expires_at,e.organiser_id,a.subaccount_code,s.commission_basis_points from ticket_orders o join events e on e.id=o.event_id join paystack_organiser_accounts a on a.organiser_id=e.organiser_id and a.verified_at is not null cross join paystack_settings s where o.id=${orderId} and o.buyer_id=${user.id} limit 1`;
 const order=rows[0];if(!order||order.status!=='pending'||new Date(order.reservation_expires_at).getTime()<=Date.now())return fail('Active reservation required',409);
 const amountKobo=Math.round(Number(order.amount_ngn)*100);if(!Number.isSafeInteger(amountKobo)||amountKobo<=0)return fail('Invalid payable amount',400);
 const existing=await db()`select reference,status from paystack_payments where order_id=${orderId} and status in ('initialized','success') order by created_at desc limit 1`;
 if(existing[0])return fail('Payment already initiated; verify existing reference first',409);
 const reference='EP-'+randomUUID();const fee=commissionKobo(amountKobo,Number(order.commission_basis_points));
 await db()`insert into paystack_payments(order_id,buyer_id,organiser_id,reference,amount_kobo,commission_kobo,subaccount_code) values(${orderId},${user.id},${order.organiser_id},${reference},${amountKobo},${fee},${order.subaccount_code})`;
 const result=await paystackRequest<{authorization_url:string;reference:string}>('/transaction/initialize','POST',{email:user.email,amount:amountKobo,currency:'NGN',reference,subaccount:order.subaccount_code,transaction_charge:fee,bearer:'account',metadata:{order_id:orderId}});
 if(result.reference!==reference||!result.authorization_url.startsWith('https://checkout.paystack.com/'))throw Error('Unexpected Paystack checkout response');
 return ok({authorization_url:result.authorization_url,reference,mode:'test'});
 }catch(e){return handleError(e)}}
