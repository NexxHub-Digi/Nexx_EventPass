import { decodeEncryptedQr,qrEventHint } from '@/lib/qr-encryption';
import {entryCodeHash} from '@/lib/ticket-entry-code';
import { currentUser, decodeQR } from '@/lib/security';import { db } from '@/lib/db';import { fail, handleError, ok, payload, str } from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){try{const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active gate account required',403);
  const b=await payload(req),eventId=str(b.eventId,40),code=b.code,testOnly=b.testOnly===true;
  const entryMethod=typeof code==='string'&&code.trim().toUpperCase().replace(/[\s-]/g,'').startsWith('NX')&&code.length<=64?'manual':'qr';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) return fail('Select a valid assigned event',400);
  if(typeof code!=='string'||code.trim().length<10||code.length>2048) return fail('A QR credential or backup code is required',400);
  const perm=await db()`select g.gate_label,e.qr_keyword_ciphertext,e.starts_at,e.ends_at from gate_assignments g join events e on e.id=g.event_id
    join app_users owner on owner.id=e.organiser_id
    where g.event_id=${eventId} and g.user_id=${u.id} and e.status='published' and e.verification_status='verified' and owner.role='organiser' and owner.account_status='active'
    union select 'Organiser'::text,e.qr_keyword_ciphertext,e.starts_at,e.ends_at from events e join app_users owner on owner.id=e.organiser_id
    where e.id=${eventId} and e.organiser_id=${u.id} and owner.account_status='active' and owner.role='organiser' and e.status='published' and e.verification_status='verified'`;
  if(!perm[0])return fail('Not assigned to this event',403);
  const gateLabel=String(perm[0].gate_label);
  const encrypted=perm[0].qr_keyword_ciphertext;
  const manualHash=entryMethod==='manual'?entryCodeHash(code):null;
  if(entryMethod==='manual'){
    // Only authenticated event gates can test codes. Limit online guessing without slowing QR scans.
    const [attempts]=await db()`select count(*)::int as count from entry_scans
      where scanner_id=${u.id} and event_id=${eventId} and entry_method='manual'
      and outcome='invalid' and scanned_at>now()-interval '1 minute'`;
    if(Number(attempts.count)>=20)return fail('Too many incorrect codes. Wait one minute or scan the QR instead.',429);
  }
  // Expose a distinct wrong-event outcome before attempting event-specific decryption.
  // Never admit based on a QR prefix; the actual ticket still requires cryptographic verification.
  const embeddedEventId=entryMethod==='manual'?null:qrEventHint(code);
  if(embeddedEventId && /^[0-9a-f-]{36}$/i.test(embeddedEventId) && embeddedEventId!==eventId){
    if(!testOnly)await db()`insert into entry_scans(event_id,scanner_id,outcome,gate_label,entry_method)
     values(${eventId},${u.id},'wrong_event',${gateLabel},'qr')`;
    return ok({outcome:'wrong_event',message:'Ticket belongs to another event',testOnly});
  }
  const codeMatch=manualHash?await db()`select ticket_id,offline_ticket_id from ticket_entry_codes
    where event_id=${eventId} and code_hash=${manualHash} limit 1`:[];
  const source=codeMatch[0]?.offline_ticket_id?'offline':codeMatch[0]?.ticket_id?'online':null;
  const decoded=entryMethod==='manual'?
    (source?{eventId,ticketId:String(codeMatch[0].ticket_id||codeMatch[0].offline_ticket_id)}:null):
    (encrypted ? decodeEncryptedQr(code,eventId,String(encrypted)) : decodeQR(code));
  if(!decoded || decoded.eventId!==eventId){
    // Even in rehearsal, log incorrect manual guesses so rate-limits cannot be bypassed.
    if(!testOnly||entryMethod==='manual')await db()`insert into entry_scans(event_id,scanner_id,outcome,gate_label,entry_method)
      values(${eventId},${u.id},${decoded?'wrong_event':'invalid'},${gateLabel},${entryMethod})`;
    return ok({outcome:decoded?'wrong_event':'invalid',message:'Entry denied',entry_method:entryMethod,testOnly});
  }
  const startsAt=new Date(perm[0].starts_at).getTime();
  const endsAt=perm[0].ends_at?new Date(perm[0].ends_at).getTime():startsAt+86400000;
  const admissionOpensAt=new Date(startsAt-7200000).toISOString();
  const admissionOpen=startsAt>=Date.now()-86400000&&startsAt<=Date.now()+7200000&&endsAt>Date.now();
  if(testOnly){
    // Safe rehearsal: no ticket redemption, entry scan, or financial change.
    const rows=await db()`select id,status,redeemed_at,true as active from tickets
     where id=${decoded.ticketId} and event_id=${eventId}
     union all select id,status,redeemed_at,active from offline_tickets
     where id=${decoded.ticketId} and event_id=${eventId}`;
    const ticket=rows[0];
    const outcome=!ticket?'invalid':ticket.status==='revoked'?'revoked':ticket.redeemed_at?'duplicate':
      ticket.status==='issued'&&ticket.active?'valid_test':'inactive_or_unavailable';
    return ok({testOnly:true,outcome,entry_method:entryMethod,opensAt:admissionOpensAt,
      message:outcome==='valid_test'?'TEST ONLY — valid unused ticket. Entry was not recorded.':
      'TEST ONLY — ticket is not eligible. Entry was not recorded.'});
  }
  const result=await db().begin(async tx=>{
    const updated=source==='offline'?[]:await tx`update tickets set redeemed_at=now(),redeemed_by=${u.id} where id=${decoded.ticketId} and event_id=${eventId} and status='issued' and redeemed_at is null and exists(select 1 from events where id=${eventId} and status='published' and starts_at between now() - interval '24 hours' and now() + interval '2 hours' and coalesce(ends_at, starts_at + interval '24 hours') > now()) returning id,redeemed_at`;
    // Offline tickets have no buyer account or payment order. Their security state is independent.
    const offlineUpdated=updated[0]||source==='online'?[]:await tx`update offline_tickets set redeemed_at=now(),redeemed_by=${u.id}
     where id=${decoded.ticketId} and event_id=${eventId} and status='issued' and active=true
      and redeemed_at is null and exists(select 1 from events where id=${eventId}
      and status='published' and verification_status='verified'
      and starts_at between now() - interval '24 hours' and now() + interval '2 hours'
      and coalesce(ends_at,starts_at+interval '24 hours') > now())
     returning id,redeemed_at`;
    let outcome='approved';let prior=null;
    let onlineTicketId=updated[0]?.id??null;
    let offlineTicketId=offlineUpdated[0]?.id??null;
    if(!updated[0]&&!offlineUpdated[0]){const previous=await tx`select id,status,redeemed_at,'online' as source from tickets where id=${decoded.ticketId} and event_id=${eventId}
      union all select id,status,redeemed_at,'offline' as source from offline_tickets where id=${decoded.ticketId} and event_id=${eventId}`;
      const old=previous[0];outcome=!old?'invalid':old.status==='revoked'?'revoked':old.redeemed_at?'duplicate':'inactive_or_unavailable';prior=old?.redeemed_at||null;
      if(old?.source==='online')onlineTicketId=old.id;
      if(old?.source==='offline')offlineTicketId=old.id;
    }
    await tx`insert into entry_scans(event_id,ticket_id,offline_ticket_id,scanner_id,outcome,gate_label,entry_method)
      values(${eventId},${onlineTicketId},${offlineTicketId},${u.id},${outcome},${gateLabel},${entryMethod})`;
    if(offlineUpdated[0])await tx`insert into offline_ticket_audit(organiser_id,event_id,batch_id,ticket_id,actor_id,operation_id,action,details)
       select organiser_id,event_id,batch_id,id,${u.id},${crypto.randomUUID()},'gate_admitted',
        jsonb_build_object('gateLabel',${gateLabel}::text,'entryMethod',${entryMethod}::text) from offline_tickets where id=${decoded.ticketId}`;
    return {outcome,prior,admittedAt:updated[0]?.redeemed_at||offlineUpdated[0]?.redeemed_at||null};
  });
  const early=result.outcome==='inactive_or_unavailable'&&!admissionOpen;
  return ok({...result,testOnly:false,entry_method:entryMethod,
   reason:early?'event_not_open':undefined,opensAt:early?admissionOpensAt:null,
   message:result.outcome==='approved'?'Entry approved — admit attendee':
    result.outcome==='duplicate'?'Ticket already admitted — do not admit again':
    early?'Admission for this event has not opened. Use rehearsal mode to verify without redeeming tickets.':
    'Entry denied — do not admit'});
}catch(e){return handleError(e);}}
