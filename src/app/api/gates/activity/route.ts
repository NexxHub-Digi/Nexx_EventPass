import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:Request){
 try{const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
 const eventId=new URL(req.url).searchParams.get('eventId')||'';
 if(!/^[0-9a-f-]{36}$/i.test(eventId))return fail('Event ID required');
 const permitted=await db()`select exists(select 1 from events where id=${eventId} and organiser_id=${u.id})
 or exists(select 1 from gate_assignments where event_id=${eventId} and user_id=${u.id}) as allowed`;
 if(!permitted[0]?.allowed)return fail('Not assigned to this event',403);
 const scans=await db()`select s.id,s.outcome,s.gate_label,s.scanned_at,s.ticket_id,
 u.full_name as operator from entry_scans s left join app_users u on u.id=s.scanner_id
 where s.event_id=${eventId} order by s.scanned_at desc limit 100`;
 const counts=await db()`select count(*)::int as total,count(*) filter(where outcome='approved')::int as admitted,
 count(*) filter(where outcome='duplicate')::int as duplicates from entry_scans where event_id=${eventId}`;
 return ok({scans,stats:counts[0]});
 }catch(e){return handleError(e)}
}
