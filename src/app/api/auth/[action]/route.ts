import {NextRequest} from 'next/server';
import {currentUser,revokeCurrentSession} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError} from '@/lib/http';
export const runtime='nodejs';
type Ctx={params:Promise<{action:string}>};
export async function GET(_req:NextRequest,ctx:Ctx){
 try{
 const {action}=await ctx.params;if(action!=='me')return fail('Not found',404);
 const user=await currentUser();if(!user)return ok({user:null,portals:[]});
 const active=user.account_status==='active';
 const gates=active?await db()`select exists(
 select 1 from gate_assignments g join events e on e.id=g.event_id join app_users owner on owner.id=e.organiser_id
 where g.user_id=${user.id} and e.status='published' and e.verification_status='verified' and owner.account_status='active' and owner.role='organiser')
 or exists(select 1 from events e where e.organiser_id=${user.id} and ${user.role==='organiser'} and e.status='published' and e.verification_status='verified') as permitted`:[];
 const portals=active?['user',...(user.role==='organiser'?['organiser']:[]),
  ...(gates[0]?.permitted?['gate']:[]),...(user.role==='platform_admin'?['platform_admin']:[])]:[];
 return ok({user,portals});
 }catch(e){return handleError(e)}
}
export async function POST(_req:NextRequest,ctx:Ctx){
 try{
 const {action}=await ctx.params;
 if(action==='login'||action==='register')return fail('Password authentication retired. Sign in using Google.',403);
 if(action!=='logout')return fail('Not found',404);
 await revokeCurrentSession();const r=ok({success:true});r.cookies.delete('eventpass_session');return r;
 }catch(e){return handleError(e)}
}
