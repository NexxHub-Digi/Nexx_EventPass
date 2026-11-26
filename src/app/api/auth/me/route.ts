import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {ok,handleError} from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
 try{
  const user=await currentUser();
  if(!user)return ok({user:null,portals:[]});
  const portals:string[]=[];
  if(user.account_status==='active'){
   portals.push('user');
   if(user.role==='organiser')portals.push('organiser');
   if(user.role==='platform_admin')portals.push('platform_admin');
   const assignments=await db()`select 1 from events e join app_users owner on owner.id=e.organiser_id
    where e.status='published' and e.verification_status='verified'
    and owner.role='organiser' and owner.account_status='active'
    and (e.organiser_id=${user.id} or exists (
      select 1 from gate_assignments g where g.event_id=e.id and g.user_id=${user.id}
    )) limit 1`;
   if(assignments.length)portals.push('gate');
  }
  return ok({user,portals});
 }catch(error){return handleError(error)}
}
