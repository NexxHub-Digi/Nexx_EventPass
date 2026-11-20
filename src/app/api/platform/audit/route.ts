import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,str} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const u=await currentUser();if(!u||u.role!=='platform_admin'||u.account_status!=='active')
   return fail('Platform Administrator only',403);
  const url=new URL(req.url);
  const q=str(url.searchParams.get('q'),100).trim().toLowerCase();
  const action=str(url.searchParams.get('action'),80).trim().toLowerCase();
  const rawPage=Number(url.searchParams.get('page')||1);
  if(!Number.isSafeInteger(rawPage)||rawPage<1||rawPage>100000)return fail('Invalid audit page',400);
  const pageSize=30,offset=(rawPage-1)*pageSize;
  const search='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
  const actionMatch='%'+action.replace(/[\\%_]/g,'\\$&')+'%';
  const [summary]=await db()`select count(*)::int as count from platform_admin_actions a
   join app_users admin on admin.id=a.admin_id
   left join app_users target on target.id=a.target_user_id
   where (${q}='' or a.action ilike ${search} escape '\\' or admin.full_name ilike ${search} escape '\\'
      or admin.email ilike ${search} escape '\\' or coalesce(target.email,'') ilike ${search} escape '\\')
     and (${action}='' or a.action ilike ${actionMatch} escape '\\')`;
  const history=await db()`select a.id,a.action,a.details,a.created_at,admin.full_name as performed_by,
   target.email as target_email from platform_admin_actions a
   join app_users admin on admin.id=a.admin_id
   left join app_users target on target.id=a.target_user_id
   where (${q}='' or a.action ilike ${search} escape '\\' or admin.full_name ilike ${search} escape '\\'
      or admin.email ilike ${search} escape '\\' or coalesce(target.email,'') ilike ${search} escape '\\')
     and (${action}='' or a.action ilike ${actionMatch} escape '\\')
   order by a.created_at desc,a.id desc limit ${pageSize} offset ${offset}`;
  return ok({history,page:rawPage,pageSize,count:Number(summary?.count||0)});
 }catch(e){return handleError(e)}
}
