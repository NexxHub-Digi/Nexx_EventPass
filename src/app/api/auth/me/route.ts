import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {ok,handleError} from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
 try{
  const user=await currentUser();
  if(!user)return ok({user:null,portals:[]});
  const portals:string[]=['user'];
  if(user.account_status==='active'){
   if(user.role==='organiser')portals.push('organiser');
   if(user.role==='platform_admin')portals.push('platform_admin');
   const assignments=await db()`select 1 from gate_assignments where user_id=${user.id} limit 1`;
   if(assignments.length)portals.push('gate');
  }
  return ok({user,portals});
 }catch(error){return handleError(error)}
}
