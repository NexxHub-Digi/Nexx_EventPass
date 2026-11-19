import {db} from '@/lib/db';
import {offlineAccess,uuid} from '@/lib/offline-access';
import {createEncryptedQr} from '@/lib/qr-encryption';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';

export async function GET(req:Request){
 try{
  const url=new URL(req.url),eventId=str(url.searchParams.get('eventId'),40),batchId=str(url.searchParams.get('batchId'),40);
  const access=await offlineAccess(eventId,'view');if(!access)return fail('Inventory access denied',403);
  if(batchId&&!uuid.test(batchId))return fail('Invalid batch',400);
  const rows=await db()`select t.id,t.batch_id,t.serial_number,t.event_id,t.status,t.active,t.distribution,
   t.recipient_name,t.recipient_contact,t.sale_amount_ngn,t.sale_note,t.redeemed_at,t.replaced_by,t.created_at,
   b.category,b.ticket_theme,b.admission_label
   from offline_tickets t join offline_ticket_batches b on b.id=t.batch_id
   where t.event_id=${eventId} and (${batchId}='' or t.batch_id::text=${batchId})
   order by t.created_at desc,t.serial_number asc limit 500`;
  const canExport=Boolean(await offlineAccess(eventId,'export'));
  return ok({tickets:rows.map(t=>({...t,qr:canExport&&t.status==='issued'?
    createEncryptedQr(t.id,t.event_id,String(access.event.qr_keyword_ciphertext)):null}))});
 }catch(e){return handleError(e)}
}

export async function PATCH(req:Request){
 try{
  const b=await payload(req),eventId=str(b.eventId,40),action=str(b.action,30);
  const ids=Array.isArray(b.ticketIds)?b.ticketIds:[];
  if(!uuid.test(eventId)||ids.length<1||ids.length>500||ids.some(x=>typeof x!=='string'||!uuid.test(x))||new Set(ids).size!==ids.length)return fail('Select 1–500 distinct ticket IDs',400);
  if(!['activate','deactivate','distribution'].includes(action))return fail('Unknown inventory operation',400);
  const permission=action==='distribution'?'distribute':'activate';
  const access=await offlineAccess(eventId,permission);
  if(!access)return fail('Permission denied',403);
  const label=str(b.distribution,25),amount=b.amountNgn===null||b.amountNgn===undefined||b.amountNgn===''?null:Number(b.amountNgn);
  if(action==='distribution'&&label==='sold'&&!await offlineAccess(eventId,'sales'))return fail('Offline sales recording permission required',403);
  if(action==='distribution'&&(!['unassigned','sold','distributed','complimentary'].includes(label)||amount!==null&&(!Number.isSafeInteger(amount)||amount<0)||label!=='sold'&&amount!==null))return fail('Invalid distribution label or amount',400);
  const recipientName=str(b.recipientName,120)||null,contact=str(b.recipientContact,120)||null,note=str(b.note,500)||null;
  const operationId=crypto.randomUUID();
  const result=await db().begin(async tx=>{
   const locked=await tx`select id,status,active,redeemed_at,distribution,sale_amount_ngn,recipient_name,recipient_contact from offline_tickets where event_id=${eventId} and id=any(${ids}::uuid[]) for update`;
   if(locked.length!==ids.length)return {error:'One or more tickets are not in this event',status:404};
   if(action!=='distribution'&&locked.some(t=>t.status!=='issued'||t.redeemed_at))return {error:'Revoked or redeemed tickets cannot be activated or deactivated',status:409};
   for(const t of locked){
    if(action==='distribution')await tx`update offline_tickets set distribution=${label},sale_amount_ngn=${label==='sold'?amount:null},
      recipient_name=${recipientName},recipient_contact=${contact},sale_note=${note} where id=${t.id}`;
    else await tx`update offline_tickets set active=${action==='activate'} where id=${t.id}`;
    await tx`insert into offline_ticket_audit(organiser_id,event_id,batch_id,ticket_id,actor_id,operation_id,action,details)
     select organiser_id,event_id,batch_id,id,${access.user.id},${operationId},${action},
      ${JSON.stringify({distribution:label,amountNgn:label==='sold'?amount:null,note})}::jsonb ||
      jsonb_build_object('previousActive',${Boolean(t.active)}::boolean,'previousDistribution',${String(t.distribution)}::text,'previousAmountNgn',${t.sale_amount_ngn}::integer)
     from offline_tickets where id=${t.id}`;
   }
   return {updated:locked.length};
  });
  if('error' in result)return fail(String(result.error),Number(result.status));
  return ok({...result,operationId});
 }catch(e){return handleError(e)}
}
