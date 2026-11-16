import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { currentUser, issueSession } from '@/lib/security';
import { fail, handleError, ok, payload, str } from '@/lib/http';
export const runtime='nodejs';
type Ctx={params:Promise<{action:string}>};
export async function GET(_req:NextRequest,ctx:Ctx){
 const {action}=await ctx.params;if(action!=='me')return fail('Not found',404);
 const user=await currentUser();if(!user)return ok({user:null,portals:['user']});
 const gates=await db()`select exists(select 1 from gate_assignments g where g.user_id=${user.id}) or exists(select 1 from events e where e.organiser_id=${user.id}) as permitted`;
 const active=user.account_status==='active';
 const portals=['user',...(active&&['organiser','platform_admin'].includes(user.role)?['organiser']:[]),...(active&&gates[0]?.permitted?['gate']:[]),...(active&&user.role==='platform_admin'?['platform_admin']:[])];
 return ok({user,portals});
}
export async function POST(req:NextRequest,ctx:Ctx){
 const {action}=await ctx.params;
 if(action==='logout'){const r=ok({success:true});r.cookies.delete('eventpass_session');return r;}
 if(!['login','register'].includes(action))return fail('Not found',404);
 try{
 const b=await payload(req),email=str(b.email,254).toLowerCase(),password=typeof b.password==='string'?b.password:'',portal=str(b.portal,40)||'user';
 if(!['user','organiser','gate','platform_admin'].includes(portal))return fail('Invalid portal');
 if(action==='register'&&!['user','organiser'].includes(portal))return fail('Only Users and organiser applicants can register',403);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<10||password.length>128)return fail('Valid email and password (10–128 characters) required');
 let u;
 if(action==='register'){
   const fullName=str(b.fullName,100);if(fullName.length<2)return fail('Full name required');
   const hash=await bcrypt.hash(password,12);
   const pending=portal==='organiser';
   const created=await db()`insert into app_users(email,password_hash,full_name,role,account_status,requested_role)
   values(${email},${hash},${fullName},'user',${pending?'pending':'active'},${pending?'organiser':null})
   on conflict(email) do nothing returning id,email,full_name,role,account_status,requested_role`;
   if(!created[0])return fail('Account already exists. Sign in to request organiser access.',409);
   u=created[0];
 }else{
   const list=await db()`select id,email,full_name,role,account_status,requested_role,password_hash from app_users where email=${email} limit 1`;
   if(!list[0]||!(await bcrypt.compare(password,list[0].password_hash)))return fail('Invalid credentials',401);
   u=list[0];
 }
 if(portal==='organiser'&&u.role!=='organiser'&&u.role!=='platform_admin'){
  if(!(u.account_status==='pending'&&u.requested_role==='organiser'))return fail('Apply for organiser approval first',403);
 }
 if(portal==='platform_admin'&&u.role!=='platform_admin')return fail('Administrator access required',403);
 if(portal==='gate'){
  const assigned=await db()`select exists(select 1 from gate_assignments where user_id=${u.id}) or exists(select 1 from events where organiser_id=${u.id}) as allowed`;
  if(!assigned[0]?.allowed)return fail('Your gate interface is inactive until invited and assigned by an organiser',403);
 }
 if(u.account_status!=='active' && !(portal==='organiser'&&u.account_status==='pending'))return fail('Account inactive',403);
 const token=await issueSession(u.id);
 const res=NextResponse.json({user:{id:u.id,email:u.email,full_name:u.full_name,role:u.role,account_status:u.account_status,requested_role:u.requested_role},token,pending:u.account_status!=='active'},{headers:{'Cache-Control':'no-store'}});
 res.cookies.set('eventpass_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:604800});
 return res;
 }catch(e){return handleError(e)}
}
