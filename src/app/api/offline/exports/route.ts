import {db} from '@/lib/db';
import {offlineAccess,uuid} from '@/lib/offline-access';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  const b=await payload(req),eventId=str(b.eventId,40),format=str(b.format,12),ids=Array.isArray(b.ticketIds)?b.ticketIds:[];
  if(!uuid.test(eventId)||!['png','zip'].includes(format)||ids.length<1||ids.length>500||new Set(ids).size!==ids.length||ids.some(x=>!uuid.test(x)))return fail('Select 1–500 tickets and a valid export format',400);
  const access=await offlineAccess(eventId,'export');if(!access)return fail('Export permission required',403);
  const matches=await db()`select id from offline_tickets where event_id=${eventId} and id=any(${ids}::uuid[]) and status='issued'`;
  if(matches.length!==ids.length)return fail('One or more tickets are unavailable for export',409);
  const ref=crypto.randomUUID();
  await db()`insert into offline_ticket_audit(organiser_id,event_id,actor_id,operation_id,action,details)
    values(${access.event.organiser_id},${eventId},${access.user.id},${ref},'export_requested',
    ${JSON.stringify({format,count:ids.length,ticketIds:ids})}::jsonb)`;
  return ok({exportId:ref,count:ids.length});
 }catch(e){return handleError(e)}
}
