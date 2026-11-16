import { decodeEncryptedQr } from '@/lib/qr-encryption';
import { currentUser, decodeQR } from '@/lib/security';import { db } from '@/lib/db';import { fail, handleError, ok, payload, str } from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){try{const u=await currentUser();if(!u)return fail('Gate staff must sign in',401);
  const b=await payload(req),eventId=str(b.eventId,40),code=b.code;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) return fail('Select a valid assigned event',400);
  if(typeof code!=='string'||code.length<10||code.length>2048) return fail('A QR credential is required',400);
  const perm=await db()`select g.gate_label from gate_assignments g where g.event_id=${eventId} and g.user_id=${u.id} union select 'Organiser'::text from events e where e.id=${eventId} and e.organiser_id=${u.id}`;
  if(!perm[0])return fail('Not assigned to this event',403);
  const gateLabel=String(perm[0].gate_label);
  const eventSecurity=await db()`select qr_keyword_ciphertext from events where id=${eventId}`;
  const encrypted=eventSecurity[0]?.qr_keyword_ciphertext;
  const decoded=encrypted ? decodeEncryptedQr(code,eventId,String(encrypted)) : decodeQR(code);
  if(!decoded || decoded.eventId!==eventId){await db()`insert into entry_scans(event_id,scanner_id,outcome,gate_label) values(${eventId},${u.id},${decoded?'wrong_event':'invalid'},${gateLabel})`;return ok({outcome:decoded?'wrong_event':'invalid',message:'Entry denied'});}
  const result=await db().begin(async tx=>{
    const updated=await tx`update tickets set redeemed_at=now(),redeemed_by=${u.id} where id=${decoded.ticketId} and event_id=${eventId} and status='issued' and redeemed_at is null and exists(select 1 from events where id=${eventId} and status='published' and starts_at between now() - interval '24 hours' and now() + interval '2 hours' and coalesce(ends_at, starts_at + interval '24 hours') > now()) returning id,redeemed_at`;
    let outcome='approved';let prior=null;
    if(!updated[0]){const old=await tx`select status,redeemed_at from tickets where id=${decoded.ticketId} and event_id=${eventId}`;outcome=!old[0]?'invalid':old[0].status==='revoked'?'revoked':old[0].redeemed_at?'duplicate':'invalid';prior=old[0]?.redeemed_at||null;}
    await tx`insert into entry_scans(event_id,ticket_id,scanner_id,outcome,gate_label) values(${eventId},${outcome==='invalid'?null:decoded.ticketId},${u.id},${outcome},${gateLabel})`;
    return {outcome,prior,admittedAt:updated[0]?.redeemed_at||null};
  });
  return ok({...result,message:result.outcome==='approved'?'Entry approved':'Entry denied'});
}catch(e){return handleError(e);}}
