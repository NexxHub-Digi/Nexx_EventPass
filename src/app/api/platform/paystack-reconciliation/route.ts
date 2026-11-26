import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {paystackTestEnabled,isPaystackRefundState} from '@/lib/paystack';
import {reconcilePaystackReference} from '@/lib/paystack-fulfilment';
import {fail,ok,payload,str} from '@/lib/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const u=await currentUser();
  if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform administrator required',403);
  const sql=db();
  const payments=await sql`select p.reference,p.status,p.amount_kobo,p.updated_at,
    o.id as order_id,o.status as order_status,o.refund_status,e.title as event_title
    from paystack_payments p join ticket_orders o on o.id=p.order_id join events e on e.id=o.event_id
    where p.status in ('initiating','initialized','initialization_failed','reconciliation_required','refund_pending','refund_failed')
    order by p.updated_at desc,p.id limit 100`;
  const counts=await sql`select status,count(*)::int as total from paystack_payments group by status`;
  return ok({mode:'test',enabled:paystackTestEnabled(),payments,counts:Object.fromEntries(counts.map(c=>[c.status,Number(c.total)]))});
 }catch{return fail('Payment recovery queue unavailable',503)}
}
export async function POST(req:Request){
 try{
  const u=await currentUser();
  if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform administrator required',403);
  if(!paystackTestEnabled())return fail('Paystack sandbox is disabled',503);
  const b=await payload(req),reference=str(b.reference,40);
  if(!/^EP-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(reference))return fail('Invalid payment reference',400);
  const [p]=await db()`select order_id,status from paystack_payments where reference=${reference}`;
  if(!p)return fail('Payment not found',404);
  if(isPaystackRefundState(p.status)||p.status==='success')return fail('Use refund review or existing verified payment ledger',409);
  // Audit the requested operation before calling the same independently verified,
  // transactional reconciliation path used by buyer verification and webhooks.
  await db()`insert into platform_admin_actions(admin_id,action,details)
   values(${u.id},'paystack_recheck_requested',${JSON.stringify({orderId:p.order_id,reference,mode:'test'})}::jsonb)`;
  const result=await reconcilePaystackReference(reference);
  return ok({reference,...result,mode:'test'});
 }catch{return fail('Provider recheck unavailable; do not initiate a second charge',503)}
}
