import {createHash} from 'node:crypto';
import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function POST(req:Request){
 try{
 const u=await currentUser();if(!u||u.account_status!=='active')return fail('Sign in or register to accept this invitation',401);
 const b=await payload(req),token=str(b.token,200);
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))return fail('Invalid invitation link',400);
 const result=await db().begin(async tx=>{
  const rows=await tx`select i.id,i.event_id,i.invitee_email,i.gate_label,i.status,i.token_expires_at,
   owner.role as organiser_role,owner.account_status as organiser_status,e.status as event_status
   from gate_invitations i join events e on e.id=i.event_id
   join app_users owner on owner.id=i.organiser_id
   where i.token_hash=${hash(token)} for update of i`;
  const i=rows[0];
  if(!i||i.status!=='pending'||!i.token_expires_at||new Date(i.token_expires_at).getTime()<=Date.now())
   return {error:'Invitation expired, revoked or already used',status:410};
  if(i.organiser_role!=='organiser'||i.organiser_status!=='active'||i.event_status!=='published')
   return {error:'This organiser or event is inactive',status:403};
  const verified=await tx`select 1 from oauth_identities where user_id=${u.id} and provider='google' and lower(provider_email)=${u.email.toLowerCase()} limit 1`;
  if(!verified[0])return {error:'Confirm the invited email through Google sign-in',status:403};
  if(i.invitee_email.toLowerCase()!==u.email.toLowerCase())
   return {error:'Sign in with the email address this invitation was sent to',status:403};
  await tx`insert into gate_assignments(event_id,user_id,gate_label) values(${i.event_id},${u.id},${i.gate_label})
   on conflict(event_id,user_id) do update set gate_label=excluded.gate_label`;
  await tx`update gate_invitations set status='accepted',accepted_by=${u.id},accepted_at=now(),
   token_hash=null,token_expires_at=null where id=${i.id}`;
  return {success:true,eventId:i.event_id,gateLabel:i.gate_label};
 });
 if('error' in result)return fail(String(result.error),Number(result.status));
 return ok(result);
 }catch(e){return handleError(e)}
}
