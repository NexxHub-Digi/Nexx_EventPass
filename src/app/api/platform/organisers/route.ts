import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
 try{const u=await currentUser();if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform admin only',403);
  const accounts=await db()`select u.id,u.email,u.full_name,u.role,u.account_status,u.requested_role,u.created_at,u.approved_at,u.approved_by,
  coalesce(cap.can_create_events,true) as can_create_events,
  coalesce(cap.can_invite_gates,true) as can_invite_gates,
  coalesce(cap.can_verify_payments,true) as can_verify_payments,
  (select count(*)::int from events e where e.organiser_id=u.id) as event_count,
  (select count(*)::int from ticket_orders o join events e on e.id=o.event_id where e.organiser_id=u.id and o.status='pending') as pending_orders,
  (select count(*)::int from tickets t join events e on e.id=t.event_id where e.organiser_id=u.id) as tickets_issued,
  (select count(distinct g.user_id)::int from gate_assignments g join events e on e.id=g.event_id where e.organiser_id=u.id) as gate_operators
  from app_users u
  left join organiser_capabilities cap on cap.organiser_id=u.id
  where u.requested_role='organiser' or u.role='organiser'
  order by case when u.requested_role='organiser' then 0 else 1 end,u.created_at desc limit 300`;
  return ok({organisers:accounts});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{const admin=await currentUser();if(!admin||admin.role!=='platform_admin'||admin.account_status!=='active')return fail('Platform admin only',403);
 const b=await payload(req),action=str(b.action,30),id=str(b.userId,40),email=str(b.email,254).toLowerCase(),reason=str(b.reason,400);
 if(!['approve','reject','suspend','revoke','restore','create','configure','capabilities'].includes(action))return fail('Unknown approval action',400);
 if(action==='capabilities'){
  if(!/^[0-9a-f-]{36}$/i.test(id)||id===admin.id)return fail('Invalid organiser ID',400);
  const target=await db()`select id from app_users where id=${id} and role='organiser'`;
  if(!target[0])return fail('Organiser not found',404);
  const a=b.canCreateEvents,c=b.canInviteGates,v=b.canVerifyPayments;
  if([a,c,v].some(x=>typeof x!=='boolean'))return fail('All three permissions must be boolean',400);
  const canCreateEvents=a===true,canInviteGates=c===true,canVerifyPayments=v===true;
  await db().begin(async tx=>{
   await tx`insert into organiser_capabilities(organiser_id,can_create_events,can_invite_gates,can_verify_payments,updated_by)
    values(${id},${canCreateEvents},${canInviteGates},${canVerifyPayments},${admin.id})
    on conflict(organiser_id) do update set can_create_events=excluded.can_create_events,
    can_invite_gates=excluded.can_invite_gates,can_verify_payments=excluded.can_verify_payments,
    updated_by=excluded.updated_by,updated_at=now()`;
   await tx`insert into platform_admin_actions(admin_id,target_user_id,action,details) values
    (${admin.id},${id},'update_organiser_capabilities',${JSON.stringify({canCreateEvents:a,canInviteGates:c,canVerifyPayments:v})}::jsonb)`;
  });
  return ok({success:true,action});
 }
 if(action==='configure'){
  if(!/^[0-9a-f-]{36}$/i.test(id)||id===admin.id)return fail('Invalid organiser account',400);
  const target=await db()`select id from app_users where id=${id} and role='organiser' limit 1`;
  if(!target[0])return fail('Only existing organisers may be configured',409);
  const fullName=str(b.fullName,100);
  if(fullName.length<2)return fail('A valid organiser display name is required',400);
  await db().begin(async tx=>{
   await tx`update app_users set full_name=${fullName} where id=${id} and role='organiser'`;
   await tx`insert into platform_admin_actions(admin_id,target_user_id,action,details)
      values(${admin.id},${id},'configure_organiser',${JSON.stringify({fullName})}::jsonb)`;
  });
  return ok({success:true,action});
 }
 if(action==='create'){
  if(!email)return fail('Verified existing User email required');
  const found=await db()`select u.id,u.role from app_users u where lower(u.email)=${email} and u.role='user' and u.account_status='active' and exists(select 1 from oauth_identities i where i.user_id=u.id and i.provider='google' and lower(i.provider_email)=${email}) limit 1`;
  if(!found[0])return fail('An active Google-verified User account is required; existing Organisers must be managed separately',400);
  await db().begin(async tx=>{
   await tx`update app_users set role='organiser',requested_role=null,account_status='active',approved_by=${admin.id},approved_at=now() where id=${found[0].id} and role='user'`;
   await tx`insert into platform_admin_actions(admin_id,target_user_id,action) values(${admin.id},${found[0].id},'create_organiser')`;
  });
  return ok({success:true});
 }
 if(!/^[0-9a-f-]{36}$/i.test(id)||id===admin.id)return fail('Invalid organiser account');
 const record=await db()`select id,role,account_status,requested_role from app_users where id=${id} limit 1`;
 if(!record[0]||record[0].role==='platform_admin')return fail('Cannot modify this account',403);
 if(action==='reject'){
  if(reason.length<10)return fail('Explain why this organiser application was rejected (at least 10 characters)',400);
  const result=await db().begin(async tx=>{
   const [pending]=await tx`select id from app_users where id=${id} and role='user' and requested_role='organiser' and account_status='active' for update`;
   if(!pending)return {rejected:false};
   await tx`update app_users set requested_role=null where id=${id}`;
   await tx`insert into platform_admin_actions(admin_id,target_user_id,action,details)
     values(${admin.id},${id},'reject',${tx.json({reason})})`;
   return {rejected:true};
  });
  return result.rejected?ok({success:true,action}):fail('Organiser application is no longer pending',409);
 }
 if(action==='approve'){
  if(record[0].requested_role!=='organiser'||record[0].role!=='user'||record[0].account_status!=='active')return fail('Not a pending organiser request',409);
  await db()`update app_users set role='organiser',requested_role=null,account_status='active',approved_by=${admin.id},approved_at=now() where id=${id}`;
 }else if(action==='suspend'||action==='revoke'){
  if(record[0].role!=='organiser')return fail('Not an organiser',409);
  await db()`update app_users set account_status='suspended' where id=${id}`;
 }else{
  if(record[0].role!=='organiser'||record[0].account_status!=='suspended')return fail('Account is not a suspended organiser',409);
  await db()`update app_users set account_status='active',approved_by=${admin.id},approved_at=now() where id=${id}`;
 }
 await db()`insert into platform_admin_actions(admin_id,target_user_id,action) values(${admin.id},${id},${action})`;
 return ok({success:true,action});
 }catch(e){return handleError(e)}
}
