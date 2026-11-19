import {db} from '@/lib/db';
import {offlineAccess,uuid} from '@/lib/offline-access';
import {fillMissingTicketCredentials} from '@/lib/ticket-credentials';
import {ensureEntryCodes} from '@/lib/ticket-entry-code';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';

export async function GET(req:Request){
 try{
  const url=new URL(req.url),eventId=str(url.searchParams.get('eventId'),40),batchId=str(url.searchParams.get('batchId'),40);
  const search=str(url.searchParams.get('search'),80).toLowerCase();
  const access=await offlineAccess(eventId,'view');if(!access)return fail('Inventory access denied',403);
  if(batchId&&!uuid.test(batchId))return fail('Invalid batch',400);
  const rows=await db()`select t.id,t.batch_id,t.serial_number,t.event_id,t.status,t.qr_credential,t.active,t.distribution,
   t.recipient_name,t.recipient_contact,t.sale_amount_ngn,t.sale_note,t.redeemed_at,t.replaced_by,t.created_at,
   b.category,b.ticket_theme,b.admission_label
   from offline_tickets t join offline_ticket_batches b on b.id=t.batch_id
   where t.event_id=${eventId} and (${batchId}='' or t.batch_id::text=${batchId})
    and (${search}='' or strpos(t.id::text,${search})=1 or t.serial_number::text=${search})
   order by t.created_at desc,t.serial_number asc,t.id limit 500`;
  const canExport=Boolean(await offlineAccess(eventId,'export'));
  const backfilled=await fillMissingTicketCredentials('offline_tickets', canExport ? rows
   .filter(t=>t.status==='issued' && !t.qr_credential)
   .map(t=>({id:t.id,eventId:t.event_id,keyword:access.event.qr_keyword_ciphertext})) : []);
  const backupCodes=canExport?await ensureEntryCodes('offline',rows.filter(t=>t.status==='issued').map(t=>({id:t.id,eventId:t.event_id}))):new Map<string,string>();
  return ok({tickets:rows.map(({qr_credential,...t})=>({...t,
   entry_code:canExport&&t.status==='issued'?(backupCodes.get(t.id)||null):null,
   qr:canExport&&t.status==='issued'?(qr_credential ?? backfilled.get(t.id) ?? null):null}))});
 }catch(e){return handleError(e)}
}

export async function PATCH(req:Request){
 try{
  const b=await payload(req),eventId=str(b.eventId,40),action=str(b.action,30);
  const ids=Array.isArray(b.ticketIds)?b.ticketIds:[];
  if(!uuid.test(eventId)||ids.length<1||ids.length>500||ids.some(x=>typeof x!=='string'||!uuid.test(x))||new Set(ids).size!==ids.length)return fail('Select 1–500 distinct ticket IDs',400);
  if(!['activate','deactivate','distribution','revoke'].includes(action))return fail('Unknown inventory operation',400);
  const permission=action==='distribution'?'distribute':action==='revoke'?'revoke':'activate';
  const reason=str(b.reason,250);
  if(action==='revoke'&&reason.length<5)return fail('Enter a revocation reason of at least five characters',400);
  const access=await offlineAccess(eventId,permission);
  if(!access)return fail('Permission denied',403);
  const label=str(b.distribution,25),amount=b.amountNgn===null||b.amountNgn===undefined||b.amountNgn===''?null:Number(b.amountNgn);
  if(action==='distribution'&&label==='sold'&&!await offlineAccess(eventId,'sales'))return fail('Offline sales recording permission required',403);
  if(action==='distribution'&&(!['unassigned','sold','distributed','complimentary'].includes(label)||amount!==null&&(!Number.isSafeInteger(amount)||amount<0)||label!=='sold'&&amount!==null))return fail('Invalid distribution label or amount',400);
  const recipientName=str(b.recipientName,120)||null,contact=str(b.recipientContact,120)||null,note=str(b.note,500)||null;
  const operationId=crypto.randomUUID();
  const result=await db().begin(async tx=>{
   if(action==='revoke')await tx`select id from events where id=${eventId} for update`;
   const locked=await tx`select id,status,active,redeemed_at,distribution,sale_amount_ngn,recipient_name,recipient_contact from offline_tickets where event_id=${eventId} and id=any(${ids}::uuid[]) order by id for update`;
   if(locked.length!==ids.length)return {error:'One or more tickets are not in this event',status:404};
   if(locked.some(t=>t.status!=='issued'||(action!=='distribution'&&t.redeemed_at)))return {error:'Selection contains tickets ineligible for this action',status:409};
   for(const t of locked){
    if(action==='distribution')await tx`update offline_tickets set distribution=${label},sale_amount_ngn=${label==='sold'?amount:null},
      recipient_name=${recipientName},recipient_contact=${contact},sale_note=${note} where id=${t.id}`;
    else if(action==='revoke')await tx`update offline_tickets set status='revoked',active=false where id=${t.id}`;
    else await tx`update offline_tickets set active=${action==='activate'} where id=${t.id}`;
    await tx`insert into offline_ticket_audit(organiser_id,event_id,batch_id,ticket_id,actor_id,operation_id,action,details)
     select organiser_id,event_id,batch_id,id,${access.user.id},${operationId},${action},
      ${JSON.stringify(action==='revoke'?{reason,status:'revoked',active:false}:action==='distribution'?{distribution:label,amountNgn:label==='sold'?amount:null,note}:{active:action==='activate'})}::jsonb ||
      jsonb_build_object('previousActive',${Boolean(t.active)}::boolean,'previousDistribution',${String(t.distribution)}::text,'previousAmountNgn',${t.sale_amount_ngn}::integer)
     from offline_tickets where id=${t.id}`;
   }
   return {updated:locked.length};
  });
  if('error' in result)return fail(String(result.error),Number(result.status));
  return ok({...result,operationId});
 }catch(e){return handleError(e)}
}
