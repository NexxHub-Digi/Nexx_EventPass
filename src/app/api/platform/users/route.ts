import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(s);
export async function GET(req:Request){
 try{
  const admin=await currentUser();
  if(!admin||admin.role!=='platform_admin'||admin.account_status!=='active')return fail('Platform Administrator only',403);
  const url=new URL(req.url),query=str(url.searchParams.get('q'),120).toLowerCase(),role=str(url.searchParams.get('role'),25);
  const rawPage=Number(url.searchParams.get('page')||'1');
  const page=Number.isSafeInteger(rawPage)?Math.min(500,Math.max(1,rawPage)):1,offset=(page-1)*40;
  const accounts=await db()`select u.id,u.full_name,u.email,u.role,u.account_status,u.requested_role,u.created_at,u.approved_at,
   exists(select 1 from oauth_identities oi where oi.user_id=u.id and oi.provider='google') as google_verified,
   (select count(*)::int from ticket_orders o where o.buyer_id=u.id) as order_count,
   (select count(*)::int from tickets t where t.owner_id=u.id) as ticket_count,
   (select count(*)::int from events e where e.organiser_id=u.id) as event_count,
   (select count(*)::int from gate_assignments g where g.user_id=u.id) as gate_event_count
   from app_users u
   where (${query}='' or lower(u.email) like ${'%'+query+'%'} or lower(u.full_name) like ${'%'+query+'%'})
    and (${role}='' or u.role=${role})
   order by u.created_at desc,u.id desc limit 40 offset ${offset}`;
  const totals=await db()`select count(*)::int as count from app_users u where
   (${query}='' or lower(u.email) like ${'%'+query+'%'} or lower(u.full_name) like ${'%'+query+'%'})
   and (${role}='' or u.role=${role})`;
  return ok({accounts,count:totals[0].count,page,pageSize:40});
 }catch(e){return handleError(e)}
}
export async function PATCH(req:Request){
 try{
  const admin=await currentUser();if(!admin||admin.role!=='platform_admin'||admin.account_status!=='active')return fail('Platform Administrator only',403);
  const b=await payload(req),userId=str(b.userId,40),action=str(b.action,30),fullName=str(b.fullName,100),reason=str(b.reason,400);
  if(!uuid(userId)||userId===admin.id)return fail('Invalid target or cannot modify self',400);
  if(!['configure','suspend','restore','deactivate'].includes(action))return fail('Unsupported action',400);
  const target=await db()`select id,role,account_status,full_name from app_users where id=${userId}`;
  if(!target[0]||target[0].role==='platform_admin')return fail('Cannot change a Platform Administrator from this screen',403);
  if(action==='configure'&&fullName.length<2)return fail('Full name must be at least two characters',400);
  if(action==='deactivate'&&!reason)return fail('Provide a reason to deactivate an account',400);
  // A legal and financial audit trail requires soft deactivation rather than deleting ticket/order history.
  await db().begin(async tx=>{
    if(action==='configure')await tx`update app_users set full_name=${fullName} where id=${userId}`;
    if(action==='suspend'||action==='deactivate')await tx`update app_users set account_status='suspended' where id=${userId}`;
    if(action==='restore')await tx`update app_users set account_status='active' where id=${userId} and account_status='suspended'`;
    await tx`insert into platform_admin_actions(admin_id,target_user_id,action,details)
     values(${admin.id},${userId},${action==='deactivate'?'soft_deactivate_user':action+'_user'},${JSON.stringify({reason,fullName:action==='configure'?fullName:undefined})}::jsonb)`;
  });
  return ok({success:true,action,policy:action==='deactivate'?'Account disabled; associated order and admission records retained for audit':undefined});
 }catch(e){return handleError(e)}
}
