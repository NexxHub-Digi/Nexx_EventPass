import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
 try{const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
 const gates=await db()`select g.event_id,g.gate_label,e.title,e.starts_at,e.organiser_id,
 o.full_name as organiser_name from gate_assignments g join events e on e.id=g.event_id
 join app_users o on o.id=e.organiser_id where g.user_id=${u.id}
 union select e.id,'Organiser'::text,e.title,e.starts_at,e.organiser_id,u.full_name from events e where e.organiser_id=${u.id}
 order by starts_at desc`;
 const invitations= u.role==='organiser' ? await db()`select i.id,i.event_id,i.invitee_email,i.gate_label,i.status,i.created_at
 from gate_invitations i where i.organiser_id=${u.id} order by i.created_at desc limit 100`: [];
 return ok({gates,invitations});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{const u=await currentUser();if(!u||u.role!=='organiser'||u.account_status!=='active')return fail('Active organiser required',403);
 const b=await payload(req),eventId=str(b.eventId,40),email=str(b.email,254).toLowerCase(),gateLabel=str(b.gateLabel,60)||'Main gate';
 if(!/^[0-9a-f-]{36}$/i.test(eventId)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail('Valid event and email required');
 const owned=await db()`select id from events where id=${eventId} and organiser_id=${u.id}`;
 if(!owned[0])return fail('Only this event organiser can invite gate operators',403);
 if(email===u.email)return fail('Organiser already has gate access',409);
 const record=await db()`insert into gate_invitations(event_id,organiser_id,invitee_email,gate_label)
 values(${eventId},${u.id},${email},${gateLabel}) on conflict(event_id,invitee_email)
 do update set gate_label=excluded.gate_label,status='pending' returning id,status`;
 // Only independently Google-verified identities can automatically accept gate invitations.
 const verified=await db()`select u.id from app_users u join oauth_identities i on i.user_id=u.id
 where lower(u.email)=${email} and lower(i.provider_email)=${email} and u.account_status='active' limit 1`;
 if(verified[0]){
  await db().begin(async tx=>{
   await tx`insert into gate_assignments(event_id,user_id,gate_label) values(${eventId},${verified[0].id},${gateLabel})
     on conflict(event_id,user_id) do update set gate_label=excluded.gate_label`;
   await tx`update gate_invitations set status='accepted' where id=${record[0].id}`;
  });
  return ok({success:true,status:'accepted',message:'Verified User assigned to your event'});
 }
 return ok({success:true,status:'pending',message:'Invitation saved. Operator must register and verify the invited email with Google to activate access'});
 }catch(e){return handleError(e)}
}
export async function DELETE(req:Request){
 try{const u=await currentUser();if(!u||u.role!=='organiser'||u.account_status!=='active')return fail('Active organiser required',403);
 const b=await payload(req),eventId=str(b.eventId,40),email=str(b.email,254).toLowerCase();
 if(!/^[0-9a-f-]{36}$/i.test(eventId)||!email)return fail('Event and operator email required');
 const owned=await db()`select id from events where id=${eventId} and organiser_id=${u.id}`;
 if(!owned[0])return fail('Not your event',403);
 await db().begin(async tx=>{
  await tx`update gate_invitations set status='revoked' where event_id=${eventId} and lower(invitee_email)=${email} and organiser_id=${u.id}`;
  await tx`delete from gate_assignments where event_id=${eventId} and user_id in(select id from app_users where lower(email)=${email})`;
 });
 return ok({success:true});
 }catch(e){return handleError(e)}
}
