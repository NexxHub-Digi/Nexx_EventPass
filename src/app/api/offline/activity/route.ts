import {db} from '@/lib/db';
import {offlineAccess} from '@/lib/offline-access';
import {fail,ok,handleError,str} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const id=str(new URL(req.url).searchParams.get('eventId'),40);
  const access=await offlineAccess(id,'reports');if(!access)return fail('Activity reporting permission required',403);
  const history=await db()`select a.id,a.action,a.operation_id,a.ticket_id,a.batch_id,a.details,a.created_at,u.full_name as actor_name
   from offline_ticket_audit a join app_users u on u.id=a.actor_id
   where a.event_id=${id} order by a.created_at desc limit 250`;
  return ok({history});
 }catch(e){return handleError(e)}
}
