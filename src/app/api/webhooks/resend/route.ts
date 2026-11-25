import {db} from '@/lib/db';
import {fail,ok} from '@/lib/http';
import {verifyResendEvent} from '@/lib/resend-webhook';
export const runtime='nodejs';
export async function POST(req:Request){
 const secret=process.env.RESEND_WEBHOOK_SECRET;
 if(!secret)return fail('Webhook unavailable',503);
 if(!req.body)return fail('Invalid webhook',400);
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];
 let length=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>65536){await reader.cancel();return fail('Payload too large',413)}chunks.push(value)}
 }catch{return fail('Invalid webhook',400)}
 const event=verifyResendEvent(Buffer.concat(chunks),req.headers,secret);
 if(!event)return fail('Invalid webhook signature or event',400);
 if(event.ignored)return ok({ignored:true});
 try{
  // Journal even if the provider ID is not attached to the outbox yet; correlation is read-time.
  await db()`insert into ticket_email_webhook_events(webhook_id,provider_id,event_type,occurred_at)
    values(${event.id},${event.providerId},${event.type},${event.occurredAt}) on conflict(webhook_id) do nothing`;
  return ok({received:true});
 }catch{return fail('Webhook persistence unavailable',503)}
}
