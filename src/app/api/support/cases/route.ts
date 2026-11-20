import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {categoryIdPattern as uuid} from '@/lib/event-inventory';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
const valid=(id:string)=>/^[0-9a-f-]{36}$/i.test(id);
export async function GET(req:Request){
 try{
  const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
  const url=new URL(req.url);
  if(url.searchParams.get('scope')==='payment'){
   const cases=await db()`select id,payment_order_id,subject,status,resolution,updated_at
     from platform_support_cases where opened_by=${u.id} and payment_order_id is not null order by updated_at desc limit 100`;
   return ok({cases});
  }
  if(!['organiser','platform_admin'].includes(u.role))return fail('Active organiser or Platform Admin required',403);
  const orgId=str(url.searchParams.get('organiserId'),40);
  const cases=u.role==='platform_admin'?
   await db()`select c.*,org.full_name as organiser_name,org.email as organiser_email,owner.full_name as opened_by_name
    from platform_support_cases c join app_users org on org.id=c.organiser_id join app_users owner on owner.id=c.opened_by
    where (${orgId}='' or c.organiser_id::text=${orgId}) order by c.updated_at desc limit 150`:
   await db()`select c.*,org.full_name as organiser_name,org.email as organiser_email,owner.full_name as opened_by_name
    from platform_support_cases c join app_users org on org.id=c.organiser_id join app_users owner on owner.id=c.opened_by
    where c.organiser_id=${u.id} order by c.updated_at desc limit 100`;
  return ok({cases});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{
  const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
  const b=await payload(req),subject=str(b.subject,150),description=str(b.description,1500),requestedOrganiser=str(b.organiserId,40);
  if(b.orderId!==undefined){
   const id=str(b.orderId,40);
   if(!uuid.test(id)||description.length<10)return fail('Select an order and describe what happened');
   const cases=await db()`insert into platform_support_cases(organiser_id,opened_by,subject,description,payment_order_id)
    select e.organiser_id,${u.id},'Rejected payment: '||e.title,${description},o.id
    from ticket_orders o join events e on e.id=o.event_id
    where o.id=${id} and o.buyer_id=${u.id} and o.status='rejected' and o.amount_ngn>0 and o.receipt_uploaded_at is not null
    on conflict do nothing returning id,status`;
   if(cases[0])return ok({case:cases[0]},201);
   const [existing]=await db()`select id,status from platform_support_cases where opened_by=${u.id} and payment_order_id=${id}`;
   return existing?ok({case:existing}):fail('You can request payment support for your rejected orders with a submitted receipt',409);
  }
  if(!['organiser','platform_admin'].includes(u.role))return fail('Active organiser or admin required',403);
  const priority=str(b.priority,10)||'normal';
  if(subject.length<5||description.length<10||!['low','normal','high','urgent'].includes(priority))return fail('Provide a subject, description and valid priority',400);
  const orgId=u.role==='organiser'?u.id:requestedOrganiser;
  if(!valid(orgId))return fail('Select an organiser',400);
  const org=await db()`select id from app_users where id=${orgId} and role='organiser'`;
  if(!org[0])return fail('Organiser not found',404);
  const created=await db()`insert into platform_support_cases(organiser_id,opened_by,subject,description,priority)
    values(${orgId},${u.id},${subject},${description},${priority}) returning id,status,created_at`;
  return ok({case:created[0]},201);
 }catch(e){return handleError(e)}
}
export async function PATCH(req:Request){
 try{
  const u=await currentUser();if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform Admin only',403);
  const b=await payload(req),id=str(b.id,40),status=str(b.status,20),priority=str(b.priority,10),resolution=str(b.resolution,1500);
  if(!valid(id)||!['open','in_progress','resolved','closed'].includes(status)||!['low','normal','high','urgent'].includes(priority))return fail('Invalid case update',400);
  const result=await db().begin(async tx=>{
   const [previous]=await tx`select id,organiser_id,status,priority,resolution from platform_support_cases where id=${id} for update`;
   if(!previous)return {error:'Support case not found',status:404};
   const finalResolution=resolution||String(previous.resolution||'');
   if(['resolved','closed'].includes(status)&&finalResolution.trim().length<10)
    return {error:'Record a meaningful case-specific resolution (at least 10 characters) before closing support',status:400};
   if(previous.status===status&&previous.priority===priority&&String(previous.resolution||'')===finalResolution)
    return {error:'No changes to save for this support case',status:409};
   const [updated]=await tx`update platform_support_cases
    set status=${status},priority=${priority},resolution=${finalResolution},assigned_to=${u.id},updated_at=now()
    where id=${id} returning id,organiser_id,status,priority,resolution,updated_at`;
   await tx`insert into platform_admin_actions(admin_id,target_user_id,action,details) values
    (${u.id},${previous.organiser_id},'resolve_support_case',
     ${tx.json({caseId:id,fromStatus:previous.status,toStatus:status,fromPriority:previous.priority,toPriority:priority,hasResolution:finalResolution.trim().length>=10})})`;
   return {case:updated};
  });
  if('error' in result)return fail(String(result.error),typeof result.status==='number'?result.status:400);
  return ok({case:result.case});
 }catch(e){return handleError(e)}
}
