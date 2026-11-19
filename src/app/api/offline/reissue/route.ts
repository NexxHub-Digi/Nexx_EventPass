import {db} from '@/lib/db';
import {offlineAccess,uuid} from '@/lib/offline-access';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  const b=await payload(req),eventId=str(b.eventId,40),ticketId=str(b.ticketId,40),reason=str(b.reason,250);
  if(!uuid.test(eventId)||!uuid.test(ticketId)||reason.length<5)return fail('Valid ticket and replacement reason required',400);
  const access=await offlineAccess(eventId,'reissue');if(!access)return fail('Reissue permission required',403);
  const result=await db().begin(async tx=>{
   const original=await tx`select t.* from offline_tickets t where t.id=${ticketId} and t.event_id=${eventId} for update`;
   const old=original[0];if(!old)return {error:'Ticket not found',status:404};
   if(old.status!=='issued'||old.redeemed_at||old.replaced_by)return {error:'Only valid, unused tickets can be replaced',status:409};
   const replacement=await tx`insert into offline_tickets(batch_id,event_id,organiser_id,serial_number,status,active,distribution)
    values(${old.batch_id},${eventId},${old.organiser_id},
    (select coalesce(max(serial_number),0)+1 from offline_tickets where batch_id=${old.batch_id}),
    'issued',${old.active},'unassigned') returning id,serial_number,active`;
   await tx`update offline_tickets set status='revoked',active=false,replaced_by=${replacement[0].id} where id=${ticketId}`;
   await tx`insert into offline_ticket_audit(organiser_id,event_id,batch_id,ticket_id,actor_id,operation_id,action,details)
    values(${old.organiser_id},${eventId},${old.batch_id},${ticketId},${access.user.id},${crypto.randomUUID()},'reissued',
    ${JSON.stringify({reason,replacementId:replacement[0].id,oldDistribution:old.distribution,oldSaleAmountNgn:old.sale_amount_ngn})}::jsonb)`;
   return {replacement:replacement[0],revokedId:ticketId};
  });
  if('error' in result)return fail(String(result.error),Number(result.status));
  return ok(result);
 }catch(e){return handleError(e)}
}
