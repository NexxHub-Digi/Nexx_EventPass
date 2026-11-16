import { currentUser } from '@/lib/security';import {db} from '@/lib/db';import {fail,handleError,ok,payload,str} from '@/lib/http';
export const runtime='nodejs';
export async function GET(){try{const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
  const rows=await db()`select g.event_id,g.gate_label,e.title,e.starts_at from gate_assignments g join events e on e.id=g.event_id where g.user_id=${u.id} union select e.id,'Organiser'::text,e.title,e.starts_at from events e where e.organiser_id=${u.id} order by starts_at desc`;
  return ok({gates:rows});}catch(e){return handleError(e);}}
export async function POST(req:Request){try{const u=await currentUser();if(!u)return fail('Sign in required',401);
  const b=await payload(req),eventId=str(b.eventId,40),email=str(b.email,254).toLowerCase(),gateLabel=str(b.gateLabel,60)||'Main gate';
  const e=await db()`select id from events where id=${eventId} and organiser_id=${u.id}`;if(!e[0])return fail('Not authorised',403);
  const staff=await db()`select id from app_users where email=${email}`;if(!staff[0])return fail('Staff must register an account first',404);
  await db()`insert into gate_assignments(event_id,user_id,gate_label) values(${eventId},${staff[0].id},${gateLabel}) on conflict(event_id,user_id) do update set gate_label=excluded.gate_label`;
  return ok({success:true});}catch(e){return handleError(e);}}
