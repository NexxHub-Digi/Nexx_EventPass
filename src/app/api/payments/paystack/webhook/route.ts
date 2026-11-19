import {createHash} from 'node:crypto';
import {validPaystackWebhook} from '@/lib/paystack';
import {reconcilePaystackReference} from '@/lib/paystack-fulfilment';
import {db} from '@/lib/db';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  const raw=Buffer.from(await req.arrayBuffer());
  if(raw.length>1000000)return new Response('Payload too large',{status:413});
  if(!validPaystackWebhook(raw,req.headers.get('paystack-signature'),req.headers.get('x-paystack-signature')))
   return new Response('Invalid signature',{status:401});
  const msg=JSON.parse(raw.toString('utf8')) as {event?:string;data?:{reference?:string;id?:number|string}};
  const event=String(msg.event||''),reference=String(msg.data?.reference||'');
  if(event!=='charge.success'||!/^EP-[a-f0-9-]{36}$/i.test(reference))return Response.json({received:true});
  const result=await reconcilePaystackReference(reference);
  if(result.status==='pending')return new Response('Still awaiting verified provider settlement',{status:503});
  const eventKey=createHash('sha256').update(event+':'+reference+':'+String(msg.data?.id||'')).digest('hex');
  await db()`insert into paystack_events(event_key,reference,event_type) values(${eventKey},${reference},${event})
   on conflict do nothing`;
  return Response.json({received:true,state:result.status});
 }catch(error){
  console.error('Paystack test webhook reconciliation failed',error instanceof Error?error.message:'unknown');
  return new Response('Temporary provider reconciliation error',{status:503});
 }
}
