import {createHash} from 'node:crypto';
import {db} from '@/lib/db';
import {validWebhook,paystackRequest} from '@/lib/paystack';
export const runtime='nodejs';
export async function POST(req:Request){try{
 const raw=Buffer.from(await req.arrayBuffer());
 if(raw.length>1000000)return new Response('Payload too large',{status:413});
 if(!validWebhook(raw,req.headers.get('x-paystack-signature'),req.headers.get('paystack-signature')))return new Response('Invalid signature',{status:401});
 const body=JSON.parse(raw.toString('utf8')) as {event?:string;data?:{reference?:string;amount?:number;currency?:string;status?:string;id?:number}};
 const event=String(body.event||'');const reference=String(body.data?.reference||'');
 if(event!=='charge.success'||!/^EP-[0-9a-f-]{36}$/.test(reference))return Response.json({received:true});
 // Never issue tickets based solely on a webhook payload. Verify independently.
 const verified=await paystackRequest<{reference:string;status:string;amount:number;currency:string;id:number}>('/transaction/verify/'+encodeURIComponent(reference));
 const payment=await db()`select id,order_id,amount_kobo,status from paystack_payments where reference=${reference}`;
 if(!payment[0])return Response.json({received:true});
 if(verified.reference!==reference||verified.status!=='success'||verified.currency!=='NGN'||Number(verified.amount)!==Number(payment[0].amount_kobo)){
  await db()`update paystack_payments set status='reconciliation_required',updated_at=now() where reference=${reference} and status='initialized'`;
  return Response.json({received:true,reconciliation_required:true});
 }
 const eventKey=createHash('sha256').update(event+':'+reference+':'+String(verified.id)).digest('hex');
 await db().begin(async tx=>{
  await tx`insert into paystack_events(event_key,reference,event_type) values(${eventKey},${reference},${event}) on conflict do nothing`;
  await tx`update paystack_payments set status='success',provider_transaction_id=${String(verified.id)},provider_paid_at=now(),updated_at=now() where reference=${reference} and status='initialized'`;
 });
 // Fulfilment intentionally deferred until existing ticket issuance transaction is safely reused.
 return Response.json({received:true,fulfilment:'pending'});
 }catch{return new Response('Webhook processing failed',{status:500})}}
