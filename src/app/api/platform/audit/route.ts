import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError} from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
 try{
  const u=await currentUser();if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform Administrator only',403);
  const history=await db()`select a.id,a.action,a.details,a.created_at,admin.full_name as performed_by,
   target.email as target_email from platform_admin_actions a
   join app_users admin on admin.id=a.admin_id
   left join app_users target on target.id=a.target_user_id
   order by a.created_at desc limit 100`;
  return ok({history});
 }catch(e){return handleError(e)}
}
