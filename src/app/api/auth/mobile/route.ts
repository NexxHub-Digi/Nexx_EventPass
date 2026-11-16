import {createHash} from 'node:crypto';
import {db} from '@/lib/db';
import {issueSession} from '@/lib/security';
import {fail,handleError,ok,payload,str} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  const b=await payload(req),code=str(b.code,100),client=str(b.client,30),verifier=str(b.codeVerifier,80);
  if(!/^[A-Za-z0-9_-]{43}$/.test(code)||!['user','organiser','gate','platform_admin'].includes(client)||!/^[a-f0-9]{64}$/.test(verifier))
   return fail('Invalid native authentication code',400);
  const result=await db().begin(async tx=>{
   const rows=await tx`delete from mobile_auth_codes where code_hash=${createHash('sha256').update(code).digest('hex')}
    and client=${client} and code_challenge=${createHash('sha256').update(verifier).digest('hex')} and expires_at>now() returning user_id`;
   if(!rows[0])return {error:'Login code expired or already used',status:410};
   const users=await tx`select id,email,role,account_status,requested_role,full_name from app_users where id=${rows[0].user_id}`;
   const user=users[0];
   if(!user||user.account_status!=='active')return {error:'Account inactive',status:403};
   if(client==='platform_admin'&&user.role!=='platform_admin')return {error:'Administrator access denied',status:403};
   if(client==='gate'){
    const permission=await tx`select exists(select 1 from gate_assignments g
     join events e on e.id=g.event_id join app_users owner on owner.id=e.organiser_id
     where g.user_id=${user.id} and e.status='published' and owner.account_status='active' and owner.role='organiser')
     or ( ${user.role==='organiser'} and exists(select 1 from events e where e.organiser_id=${user.id} and e.status='published')) as eligible`;
    if(!permission[0]?.eligible)return {error:'Not assigned to an active gate',status:403};
   }
   if(client==='organiser'&&user.role!=='organiser'&&user.requested_role!=='organiser')return {error:'Organiser application required',status:403};
   return {user};
  });
  if('error' in result)return fail(String(result.error),Number(result.status));
  const token=await issueSession(String(result.user.id));
  return ok({token,user:result.user});
 }catch(e){return handleError(e)}
}
