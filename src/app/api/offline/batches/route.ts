import {db} from '@/lib/db';
import { availableEventTickets, categoryIdPattern } from '@/lib/event-inventory';
import {issueTicketCredential} from '@/lib/ticket-credentials';
import {offlineAccess,uuid} from '@/lib/offline-access';
import {fail,ok,handleError,payload,str,positiveInt} from '@/lib/http';
export const runtime='nodejs';

export async function GET(req:Request){
 try{
  const id=str(new URL(req.url).searchParams.get('eventId'),40);
  const access=await offlineAccess(id,'view');
  if(!access)return fail('Not authorised for event inventory',403);
  const batches=await db()`select b.id,b.event_id,b.label,b.category,b.ticket_theme,b.admission_label,b.quantity,b.created_at,
   (select count(*)::int from offline_tickets t where t.batch_id=b.id and t.status='issued') as valid_count,
   (select count(*)::int from offline_tickets t where t.batch_id=b.id and t.active=true and t.status='issued') as active_count,
   (select count(*)::int from offline_tickets t where t.batch_id=b.id and t.redeemed_at is not null) as admitted_count
   from offline_ticket_batches b where b.event_id=${id} order by b.created_at desc limit 100`;
  return ok({batches});
 }catch(e){return handleError(e)}
}

export async function POST(req:Request){
 try{
  const b=await payload(req),eventId=str(b.eventId,40),qty=positiveInt(b.quantity,500);
  const access=await offlineAccess(eventId,'generate');
  if(!access)return fail('Ticket generation permission required',403);
  const categoryId=str(b.ticketCategoryId,40).toLowerCase()||null;
  if(categoryId&&!categoryIdPattern.test(categoryId))return fail('Invalid ticket category');
  const label=str(b.label,120),active=b.active===true,key=str(b.idempotencyKey,120);
  if(!qty||key.length<12||!uuid.test(eventId))return fail('Valid quantity (1–500) and idempotency key required',400);
  const e=access.event;
  // A staff member with generate but not activate can prepare inactive inventory only.
  if(active&&!await offlineAccess(eventId,'activate'))return fail('Ticket activation permission required',403);
  const result=await db().begin(async tx=>{
   const [event]=await tx`select id,capacity,status,verification_status,ticket_theme,admission_label,
     qr_keyword_ciphertext,starts_at>now() as upcoming from events
     where id=${eventId} and organiser_id=${e.organiser_id} for update`;
   if(!event)return {error:'Event unavailable',status:404};
   const existing=await tx`select id,event_id,created_by,quantity from offline_ticket_batches
     where organiser_id=${e.organiser_id} and idempotency_key=${key}`;
   if(existing[0]){
    if(existing[0].event_id!==eventId||existing[0].created_by!==access.user.id)
     return {error:'Use a new idempotency key for this batch',status:409};
    return {existing:true,batch:{id:existing[0].id,event_id:eventId,quantity:existing[0].quantity}};
   }
   if(event.status!=='published'||event.verification_status!=='verified'||!event.qr_keyword_ciphertext||!event.upcoming)
    return {error:'Choose an upcoming verified event with QR encryption configured',status:409};
   const inventory=await availableEventTickets(tx,event.id,Number(event.capacity),categoryId);
   if(!inventory)return {error:'Ticket category is not available for this event',status:400};
   const {available}=inventory;
   const category=inventory.categoryName||str(b.category,60)||'General';
   if(qty>available)return {error:'Insufficient remaining event capacity',status:409,available};
   const batches=await tx`insert into offline_ticket_batches(event_id,organiser_id,created_by,idempotency_key,label,category,ticket_theme,admission_label,quantity,ticket_category_id)
    values(${eventId},${e.organiser_id},${access.user.id},${key},${label},${category},${String(event.ticket_theme)},${String(event.admission_label)},${qty},${categoryId})
    on conflict(organiser_id,idempotency_key) do nothing returning id,event_id,quantity,created_at`;
   const batch=batches[0];
   if(!batch)return {error:'Use a new idempotency key for this batch',status:409};
   const tickets=Array.from({length:qty},(_,index)=>{
    const id=crypto.randomUUID();
    return {id,batch_id:batch.id,event_id:event.id,organiser_id:e.organiser_id,serial_number:index+1,
     active,qr_credential:issueTicketCredential(id,event.id,event.qr_keyword_ciphertext)};
   });
   await tx`insert into offline_tickets ${tx(tickets)}`;
   await tx`insert into offline_ticket_audit(organiser_id,event_id,batch_id,actor_id,operation_id,action,details)
    values(${e.organiser_id},${eventId},${batch.id},${access.user.id},${crypto.randomUUID()},'batch_generated',
     ${JSON.stringify({quantity:qty,active,category,label})}::jsonb)`;
   return {batch};
  });
  if('error' in result)return fail(String(result.error),Number(result.status));
  return ok({...result,message:result.existing?'Existing batch returned (duplicate request suppressed)':'Offline ticket batch created'},result.existing?200:201);
 }catch(e){return handleError(e)}
}
