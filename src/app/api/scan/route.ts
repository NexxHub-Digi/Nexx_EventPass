import {decodeEncryptedQr,qrEventHint} from '@/lib/qr-encryption';
import {normalizeAdmissionCode} from '@/lib/admission-code';
import {currentUser,decodeQR} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,handleError,ok,payload,str} from '@/lib/http';
export const runtime='nodejs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result={outcome:string;message:string;reason?:string;prior?:string|null;admittedAt?:string|null;testOnly?:boolean;opensAt?:string|null};

export async function POST(req:Request){
 try{
  const u=await currentUser();
  if(!u||u.account_status!=='active')return fail('Active gate account required',403);
  const b=await payload(req),eventId=str(b.eventId,40),code=b.code,testOnly=b.testOnly===true;
  if(!UUID.test(eventId))return fail('Select a valid assigned event',400);
  if(typeof code!=='string'||code.length<10||code.length>2048)return fail('Scan a QR or enter the 12-character ticket code',400);

  const sql=db();
  const perm=await sql`select g.gate_label from gate_assignments g join events e on e.id=g.event_id
    join app_users owner on owner.id=e.organiser_id
    where g.event_id=${eventId} and g.user_id=${u.id} and e.status='published' and e.verification_status='verified' and owner.role='organiser' and owner.account_status='active'
    union select 'Organiser'::text from events e join app_users owner on owner.id=e.organiser_id
    where e.id=${eventId} and e.organiser_id=${u.id} and owner.account_status='active' and owner.role='organiser' and e.status='published' and e.verification_status='verified'`;
  if(!perm[0])return fail('Not assigned to this event',403);
  const gateLabel=String(perm[0].gate_label);
  const [event]=await sql`select qr_keyword_ciphertext,starts_at,
    (starts_at between now()-interval '24 hours' and now()+interval '2 hours'
      and coalesce(ends_at,starts_at+interval '24 hours')>now()) as admission_open
    from events where id=${eventId}`;
  const manualCode=normalizeAdmissionCode(code);
  const hint=manualCode?null:qrEventHint(code);
  if(hint&&hint!==eventId.toLowerCase()){
   if(!testOnly)await sql`insert into entry_scans(event_id,scanner_id,outcome,gate_label) values(${eventId},${u.id},'wrong_event',${gateLabel})`;
   return ok({outcome:'wrong_event',message:'Ticket belongs to another event',testOnly});
  }
  let decoded:{eventId:string;ticketId:string}|null=null;
  if(manualCode){
   // Indexed equality lookup avoids a full-ticket scan even for large events.
   const matches=await sql`select id from tickets where event_id=${eventId} and admission_code=${manualCode}
     union all select id from offline_tickets where event_id=${eventId} and admission_code=${manualCode} limit 2`;
   if(matches.length===1)decoded={eventId,ticketId:matches[0].id};
  }else{
   decoded=event?.qr_keyword_ciphertext?
    decodeEncryptedQr(code,eventId,String(event.qr_keyword_ciphertext)):decodeQR(code);
  }
  if(!decoded||decoded.eventId.toLowerCase()!==eventId.toLowerCase()){
   if(!testOnly)await sql`insert into entry_scans(event_id,scanner_id,outcome,gate_label) values(${eventId},${u.id},'invalid',${gateLabel})`;
   return ok({outcome:'invalid',message:'Ticket code is not valid for this event',testOnly});
  }

  if(testOnly){
   // A rehearsal verifies cryptographic/manual credentials and issue status but
   // never redeems, changes inventory, or creates a real admission record.
   const rows=await sql`select id,status,redeemed_at,true as active from tickets where id=${decoded.ticketId} and event_id=${eventId}
     union all select id,status,redeemed_at,active from offline_tickets where id=${decoded.ticketId} and event_id=${eventId}`;
   const ticket=rows[0];
   const outcome=!ticket?'invalid':ticket.status==='revoked'?'revoked':ticket.redeemed_at?'duplicate':
     ticket.status==='issued'&&ticket.active?'valid_test':'inactive_or_unavailable';
   return ok({testOnly:true,outcome,
     message:outcome==='valid_test'?'Valid unused ticket — TEST ONLY. Entry was not recorded.':'Test failed: ticket is not eligible.',
     opensAt:new Date(new Date(event.starts_at).getTime()-7200000).toISOString()});
  }

  const result=await sql.begin(async tx=>{
   const updated=await tx`update tickets set redeemed_at=now(),redeemed_by=${u.id}
     where id=${decoded.ticketId} and event_id=${eventId} and status='issued' and redeemed_at is null
      and exists(select 1 from events where id=${eventId} and status='published'
      and starts_at between now()-interval '24 hours' and now()+interval '2 hours'
      and coalesce(ends_at,starts_at+interval '24 hours')>now()) returning id,redeemed_at`;
   const offlineUpdated=updated[0]?[]:await tx`update offline_tickets set redeemed_at=now(),redeemed_by=${u.id}
     where id=${decoded.ticketId} and event_id=${eventId} and status='issued' and active=true and redeemed_at is null
      and exists(select 1 from events where id=${eventId} and status='published' and verification_status='verified'
      and starts_at between now()-interval '24 hours' and now()+interval '2 hours'
      and coalesce(ends_at,starts_at+interval '24 hours')>now()) returning id,redeemed_at`;
   let outcome='approved',prior:string|null=null,reason:string|undefined=undefined;
   let onlineTicketId=updated[0]?.id??null,offlineTicketId=offlineUpdated[0]?.id??null;
   if(!updated[0]&&!offlineUpdated[0]){
    const previous=await tx`select id,status,redeemed_at,true as active,'online' as source from tickets
      where id=${decoded.ticketId} and event_id=${eventId}
      union all select id,status,redeemed_at,active,'offline' as source from offline_tickets
      where id=${decoded.ticketId} and event_id=${eventId}`;
    const old=previous[0];
    outcome=!old?'invalid':old.status==='revoked'?'revoked':old.redeemed_at?'duplicate':'inactive_or_unavailable';
    prior=old?.redeemed_at||null;
    if(old?.source==='online')onlineTicketId=old.id;
    if(old?.source==='offline')offlineTicketId=old.id;
    if(outcome==='inactive_or_unavailable')reason=!event.admission_open?'event_not_open':old?.active===false?'ticket_inactive':'ticket_unavailable';
   }
   await tx`insert into entry_scans(event_id,ticket_id,offline_ticket_id,scanner_id,outcome,gate_label)
    values(${eventId},${onlineTicketId},${offlineTicketId},${u.id},${outcome},${gateLabel})`;
   if(offlineUpdated[0])await tx`insert into offline_ticket_audit(organiser_id,event_id,batch_id,ticket_id,actor_id,operation_id,action,details)
      select organiser_id,event_id,batch_id,id,${u.id},${crypto.randomUUID()},'gate_admitted',
       jsonb_build_object('gateLabel',${gateLabel}::text) from offline_tickets where id=${decoded.ticketId}`;
   const admittedAt=updated[0]?.redeemed_at||offlineUpdated[0]?.redeemed_at||null;
   return {outcome,reason,prior,admittedAt};
  });
  const opensAt=result.reason==='event_not_open'?new Date(new Date(event.starts_at).getTime()-7200000).toISOString():null;
  const message=result.outcome==='approved'?'Entry approved — admit attendee':
    result.outcome==='duplicate'?'Already admitted — do not admit again':
    result.reason==='event_not_open'?'This ticket is valid but admission is not open yet. Use Test ticket to rehearse safely.':
    result.reason==='ticket_inactive'?'Ticket has not been activated by the organiser.':'Entry denied';
  return ok({...result,message,opensAt,testOnly:false} satisfies Result);
 }catch(e){return handleError(e)}
}
