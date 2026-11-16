import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
const keys=['support_email','organiser_approval_policy','event_verification_policy','help_text'] as const;
export async function GET(){
 try{
  const u=await currentUser();if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform Administrator only',403);
  const rows=await db()`select setting_key,setting_value,updated_at from platform_settings order by setting_key`;
  return ok({settings:Object.fromEntries(rows.map(r=>[r.setting_key,r.setting_value]))});
 }catch(e){return handleError(e)}
}
export async function PATCH(req:Request){
 try{
  const u=await currentUser();if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform Administrator only',403);
  const b=await payload(req),key=str(b.key,60),value=str(b.value,750);
  if(!(keys as readonly string[]).includes(key)||value.length>750)return fail('Unsupported or oversized setting',400);
  await db().begin(async tx=>{
   await tx`insert into platform_settings(setting_key,setting_value,updated_by) values(${key},${JSON.stringify(value)}::jsonb,${u.id})
    on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=now()`;
   await tx`insert into platform_admin_actions(admin_id,action,details) values(${u.id},'platform_setting',${JSON.stringify({key})}::jsonb)`;
  });
  return ok({success:true,key});
 }catch(e){return handleError(e)}
}
