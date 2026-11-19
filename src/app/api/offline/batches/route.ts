import {db} from '@/lib/db';
import {currentUser} from '@/lib/security';
import {offlineAccess,uuid} from '@/lib/offline-access';
import {createEncryptedQr} from '@/lib/qr-encryption';
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
  const label=str(b.label,120),category=str(b.category,60)||'General',active=b.active===true,key=str(b.idempotencyKey,120);
  if(!qty||key.length<12||!uuid.test(eventId))return fail('Valid quantity (1–500) and idempotency key required',400);
  const e=access.event;
  if(e.status!=='published'||!e.qr_keyword_ciphertext)return fail('Publish and configure QR security for this event first',409);
  if(new Date(e.starts_at).getTime()<=Date.now())return fail('Cannot issue tickets for an event that already started',409);
  // A staff member with generate but not activate can prepare inactive inventory only.
  if(active&&!await offlineAccess(eventId,'activate'))return fail('Ticket activation permission required',403);
  const result=await db().begin(async tx=>{
   const exists=await tx`select id,quantity from offline_ticket_batches where organiser_id=${e.organiser_id} and idempotency_key=${key}`;
   if(exists[0])return {existing:true,batch:exists[0]};
   const locked=await tx`select id,capacity from events where id=${eventId} and organiser_id=${e.organiser_id} for update`;
   if(!locked[0])return {error:'Event unavailable',status:404};
   const counts=await tx`select
    (select count(*)::int from tickets where event_id=${eventId} and status='issued') as online,
    (select count(*)::int from offline_tickets where event_id=${eventId} and status='issued') as offline,
    (select coalesce(sum(quantity),0)::int from ticket_orders where event_id=${eventId} and status='pending' and reservation_expires_at>now()) as reserved`;
   const used=Number(counts[0].online)+Number(counts[0].offline)+Number(counts[0].reserved);
   if(used+qty>Number(locked[0].capacity))return {error:'Insufficient remaining event capacity',status:409,available:Math.max(0,Number(locked[0].capacity)-used)};
   const batches=await tx`insert into offline_ticket_batches(event_id,organiser_id,created_by,idempotency_key,label,category,ticket_theme,admission_label,quantity)
    values(${eventId},${e.organiser_id},${access.user.id},${key},${label},${category},${String(e.ticket_theme)},${String(e.admission_label)},${qty})
    returning id,event_id,quantity,created_at`;
   const batch=batches[0];
   await tx`insert into offline_tickets(batch_id,event_id,organiser_id,serial_number,active)
     select ${batch.id},${eventId},${e.organiser_id},generate_series(1,${qty}),${active}`;
   await tx`insert into offline_ticket_audit(organiser_id,event_id,batch_id,actor_id,operation_id,action,details)
    values(${e.organiser_id},${eventId},${batch.id},${access.user.id},${crypto.randomUUID()},'batch_generated',
     ${JSON.stringify({quantity:qty,active,category,label})}::jsonb)`;
   return {batch};
  });
  if('error' in result)return fail(String(result.error),Number(result.status));
  return ok({...result,message:result.existing?'Existing batch returned (duplicate request suppressed)':'Offline ticket batch created'},result.existing?200:201);
 }catch(e){return handleError(e)}
}
