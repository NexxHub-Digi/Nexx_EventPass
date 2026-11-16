import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
 try{const u=await currentUser();if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform admin only',403);
  const accounts=await db()`select u.id,u.email,u.full_name,u.role,u.account_status,u.requested_role,u.created_at,u.approved_at,
  (select count(*)::int from events e where e.organiser_id=u.id) as event_count
  from app_users u where u.requested_role='organiser' or u.role='organiser' order by case when u.requested_role='organiser' then 0 else 1 end,u.created_at desc limit 200`;
  return ok({organisers:accounts});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{const admin=await currentUser();if(!admin||admin.role!=='platform_admin'||admin.account_status!=='active')return fail('Platform admin only',403);
 const b=await payload(req),action=str(b.action,30),id=str(b.userId,40),email=str(b.email,254).toLowerCase();
 if(!['approve','reject','suspend','restore','create'].includes(action))return fail('Unknown approval action',400);
 if(action==='create'){
  if(!email)return fail('Verified existing User email required');
  const found=await db()`select u.id,u.role from app_users u where lower(u.email)=${email} and exists(select 1 from oauth_identities i where i.user_id=u.id and lower(i.provider_email)=${email}) limit 1`;
  if(!found[0]||found[0].role==='platform_admin')return fail('Create organisers from an existing Google-verified User account',400);
  await db()`update app_users set role='organiser',requested_role=null,account_status='active',approved_by=${admin.id},approved_at=now() where id=${found[0].id}`;
  return ok({success:true});
 }
 if(!/^[0-9a-f-]{36}$/i.test(id)||id===admin.id)return fail('Invalid organiser account');
 const record=await db()`select id,role,account_status,requested_role from app_users where id=${id} limit 1`;
 if(!record[0]||record[0].role==='platform_admin')return fail('Cannot modify this account',403);
 if(action==='approve'){
  if(record[0].requested_role!=='organiser'||record[0].role!=='user'||record[0].account_status!=='active')return fail('Not a pending organiser request',409);
  await db()`update app_users set role='organiser',requested_role=null,account_status='active',approved_by=${admin.id},approved_at=now() where id=${id}`;
 }else if(action==='reject'){
  if(record[0].requested_role!=='organiser')return fail('Not an organiser application',409);
  await db()`update app_users set requested_role=null,account_status='active' where id=${id}`;
 }else if(action==='suspend'){
  if(record[0].role!=='organiser')return fail('Not an organiser',409);
  await db()`update app_users set account_status='suspended' where id=${id}`;
 }else{
  if(record[0].role!=='organiser'||record[0].account_status!=='suspended')return fail('Account is not a suspended organiser',409);
  await db()`update app_users set account_status='active',approved_by=${admin.id},approved_at=now() where id=${id}`;
 }
 return ok({success:true,action});
 }catch(e){return handleError(e)}
}
