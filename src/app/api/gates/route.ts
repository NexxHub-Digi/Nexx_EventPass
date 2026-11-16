import {randomBytes,createHash} from 'node:crypto';
import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
const validEmail=(email:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validUuid=(id:string)=>/^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(id);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function GET(){
 try{
 const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
 const gates=await db()`select g.event_id,g.gate_label,e.title,e.starts_at,e.organiser_id,o.full_name as organiser_name
 from gate_assignments g join events e on e.id=g.event_id join app_users o on o.id=e.organiser_id
 where g.user_id=${u.id} and o.role='organiser' and o.account_status='active'
 union select e.id,'Organiser'::text,e.title,e.starts_at,e.organiser_id,u.full_name
 from events e where e.organiser_id=${u.id} and u.role='organiser' and u.account_status='active'
 order by starts_at desc`;
 const invitations=u.role==='organiser'?await db()`select i.id,i.event_id,i.invitee_email,i.gate_label,i.status,
 i.created_at,i.token_expires_at,i.accepted_at from gate_invitations i where i.organiser_id=${u.id}
 order by i.created_at desc limit 100`:[];
 return ok({gates,invitations});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{
 const u=await currentUser();if(!u||u.role!=='organiser'||u.account_status!=='active')return fail('Active organiser required',403);
 const b=await payload(req),eventId=str(b.eventId,40),email=str(b.email,254).toLowerCase(),gateLabel=str(b.gateLabel,60)||'Main gate';
 if(!validUuid(eventId)||!validEmail(email))return fail('Valid event and email required',400);
 const owned=await db()`select id from events where id=${eventId} and organiser_id=${u.id} and status='published'`;
 if(!owned[0])return fail('Only the owning organiser can invite operators to a published event',403);
 if(email===u.email.toLowerCase())return fail('Organiser already has gate access',409);
 const token=randomBytes(32).toString('base64url'),tokenHash=hash(token);
 const invited=await db()`insert into gate_invitations(event_id,organiser_id,invitee_email,gate_label,status,token_hash,token_expires_at,accepted_by,accepted_at)
 values(${eventId},${u.id},${email},${gateLabel},'pending',${tokenHash},now()+interval '72 hours',null,null)
 on conflict(event_id,invitee_email) do update set gate_label=excluded.gate_label,status='pending',
 token_hash=excluded.token_hash,token_expires_at=excluded.token_expires_at,accepted_by=null,accepted_at=null,created_at=now()
 returning id,token_expires_at`;
 // Re-invitation never grants access automatically: recipient must accept the fresh token.
 const base=process.env.NEXT_PUBLIC_SITE_URL||new URL(req.url).origin;
 const link=new URL('/invite/gate',base);
 link.searchParams.set('token',token);
 return ok({success:true,status:'pending',invitationId:invited[0].id,
  expiresAt:invited[0].token_expires_at,invitationLink:link.toString(),
  message:'Invitation created. Share this one-time link privately with the invited person. They can register or sign in to accept.'});
 }catch(e){return handleError(e)}
}
export async function DELETE(req:Request){
 try{
 const u=await currentUser();if(!u||u.role!=='organiser'||u.account_status!=='active')return fail('Active organiser required',403);
 const b=await payload(req),eventId=str(b.eventId,40),email=str(b.email,254).toLowerCase();
 if(!validUuid(eventId)||!validEmail(email))return fail('Event and operator email required',400);
 const owned=await db()`select id from events where id=${eventId} and organiser_id=${u.id}`;
 if(!owned[0])return fail('Not your event',403);
 await db().begin(async tx=>{
  await tx`update gate_invitations set status='revoked',token_hash=null,token_expires_at=null
   where event_id=${eventId} and lower(invitee_email)=${email} and organiser_id=${u.id}`;
  await tx`delete from gate_assignments where event_id=${eventId}
   and user_id in(select id from app_users where lower(email)=${email})`;
 });
 return ok({success:true});
 }catch(e){return handleError(e)}
}
