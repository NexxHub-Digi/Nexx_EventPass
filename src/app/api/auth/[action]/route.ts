import {NextRequest,NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {db} from '@/lib/db';
import {currentUser,issueSession,revokeCurrentSession} from '@/lib/security';
import {fail,handleError,ok,payload,str} from '@/lib/http';
export const runtime='nodejs';
type Ctx={params:Promise<{action:string}>};
export async function GET(_req:NextRequest,ctx:Ctx){
 const {action}=await ctx.params;if(action!=='me')return fail('Not found',404);
 const user=await currentUser();if(!user)return ok({user:null,portals:[]});
 const active=user.account_status==='active';
 const gates=active?await db()`select exists(
 select 1 from gate_assignments g join events e on e.id=g.event_id join app_users owner on owner.id=e.organiser_id
 where g.user_id=${user.id} and e.status='published' and owner.account_status='active' and owner.role='organiser')
 or exists(select 1 from events e where e.organiser_id=${user.id} and ${user.role==='organiser'}) as permitted`:[];
 const portals=active?['user',...(['organiser','platform_admin'].includes(user.role)?['organiser']:[]),
  ...(gates[0]?.permitted?['gate']:[]),...(user.role==='platform_admin'?['platform_admin']:[])]:[];
 return ok({user,portals});
}
export async function POST(req:NextRequest,ctx:Ctx){
 const {action}=await ctx.params;
 try {
  if(action==='logout'){await revokeCurrentSession();const r=ok({success:true});r.cookies.delete('eventpass_session');return r;}
  if(action==='register')return fail('Sign up using Google only',403);
  if(action==='login')return fail('Password sign-in retired. Continue with Google.',403);
  if(action!=='login')return fail('Not found',404);
  // Existing password accounts retain a migration-only sign-in, but the interface presents Google exclusively.
  const b=await payload(req),email=str(b.email,254).toLowerCase(),password=typeof b.password==='string'?b.password:'',portal=str(b.portal,40)||'user';
  if(!['user','organiser','gate','platform_admin'].includes(portal))return fail('Invalid portal');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<10||password.length>128)return fail('Invalid credentials',401);
  const users=await db()`select id,email,full_name,role,account_status,requested_role,password_hash from app_users where email=${email} limit 1`;
  const user=users[0];
  if(!user||!(await bcrypt.compare(password,user.password_hash)))return fail('Invalid credentials',401);
  if(user.account_status!=='active')return fail('Account inactive',403);
  if(portal==='organiser'&&user.role==='user'&&user.requested_role!=='organiser'){
   await db()`update app_users set requested_role='organiser' where id=${user.id} and role='user'`;user.requested_role='organiser';
  }
  if(portal==='platform_admin'&&user.role!=='platform_admin')return fail('Administrator access required',403);
  const token=await issueSession(user.id);
  const res=NextResponse.json({user:{id:user.id,email:user.email,full_name:user.full_name,role:user.role,account_status:user.account_status,requested_role:user.requested_role},token},{headers:{'Cache-Control':'no-store'}});
  res.cookies.set('eventpass_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});
  return res;
 }catch(e){return handleError(e)}
}
