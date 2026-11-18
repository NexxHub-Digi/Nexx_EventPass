import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {ok,fail,handleError} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const u=await currentUser();
  if(!u||u.account_status!=='active')return fail('Active account required',403);
  const eventId=new URL(req.url).searchParams.get('eventId')||'';
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(eventId))return fail('Valid event required',400);
  const allowed=await db()`select 1 from gate_assignments g join events e on e.id=g.event_id join app_users owner on owner.id=e.organiser_id
    where g.event_id=${eventId} and g.user_id=${u.id} and e.status='published' and e.verification_status='verified' and owner.account_status='active'
    union select 1 from events e where e.id=${eventId} and e.organiser_id=${u.id} and u.role='organiser' and e.status='published' and e.verification_status='verified'`;
  if(!allowed[0])return fail('Not assigned to this event',403);
  const scans=await db()`select id,outcome,gate_label,created_at from entry_scans where event_id=${eventId} and scanner_id=${u.id} order by created_at desc limit 100`;
  const counts=await db()`select count(*)::int as total,count(*) filter(where outcome='approved')::int as approved,count(*) filter(where outcome!='approved')::int as denied from entry_scans where event_id=${eventId} and scanner_id=${u.id}`;
  return ok({scans,counts:counts[0]});
 }catch(e){return handleError(e)}
}
