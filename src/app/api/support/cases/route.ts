import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
const valid=(id:string)=>/^[0-9a-f-]{36}$/i.test(id);
export async function GET(req:Request){
 try{
  const u=await currentUser();if(!u||u.account_status!=='active'||!['organiser','platform_admin'].includes(u.role))return fail('Active organiser or Platform Admin required',403);
  const url=new URL(req.url),orgId=str(url.searchParams.get('organiserId'),40);
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
  const u=await currentUser();if(!u||u.account_status!=='active'||!['organiser','platform_admin'].includes(u.role))return fail('Active organiser or admin required',403);
  const b=await payload(req),subject=str(b.subject,150),description=str(b.description,1500),requestedOrganiser=str(b.organiserId,40);
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
  const row=await db()`update platform_support_cases set status=${status},priority=${priority},resolution=${resolution},assigned_to=${u.id},updated_at=now()
    where id=${id} returning id,organiser_id,status`;
  if(!row[0])return fail('Case not found',404);
  await db()`insert into platform_admin_actions(admin_id,target_user_id,action,details) values
    (${u.id},${row[0].organiser_id},'resolve_support_case',${JSON.stringify({caseId:id,status,priority})}::jsonb)`;
  return ok({case:row[0]});
 }catch(e){return handleError(e)}
}
