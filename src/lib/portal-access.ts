import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';

export type ProtectedPortal='organiser'|'gate'|'platform-admin';

/** Authorise a workspace on the server before its client component is rendered. */
export async function requirePortal(portal:ProtectedPortal){
 const user=await currentUser();
 if(!user){redirect('/login/'+portal)}
 if(user.account_status!=='active'){
  redirect('/login/'+portal+'?access=inactive');
 }
 if(portal==='organiser'&&user.role!=='organiser')redirect('/login/organiser?access=denied');
 if(portal==='platform-admin'&&user.role!=='platform_admin')redirect('/login/platform-admin?access=denied');
 if(portal==='gate'){
  const assignments=await db()`select 1 from events e join app_users owner on owner.id=e.organiser_id
   where e.status='published' and e.verification_status='verified'
   and owner.role='organiser' and owner.account_status='active'
   and (e.organiser_id=${user.id} or exists (
     select 1 from gate_assignments g where g.event_id=e.id and g.user_id=${user.id}
   )) limit 1`;
  if(!assignments.length)redirect('/login/gate?access=denied');
 }
 return user;
}
