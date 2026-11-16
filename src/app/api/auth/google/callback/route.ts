import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { currentUser, issueSession } from '@/lib/security';
import { callbackUrl, oauthCredentials, portalDestination, readState, verifyGoogleIdToken, type OAuthPortal } from '@/lib/google-oauth';
export const runtime='nodejs';
const compare=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y)};
function back(origin:string,portal:OAuthPortal,code:string){
 const u=new URL('/',origin);u.searchParams.set('portal',portal);u.searchParams.set('oauth_error',code);return NextResponse.redirect(u);
}
export async function GET(req:NextRequest){
 let portal:OAuthPortal='user';
 const origin=process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
 const stateCookie=req.cookies.get('eventpass_google_state')?.value;
 let response:NextResponse;
 try {
  if(!stateCookie) throw new Error('state_missing');
  const st=await readState(stateCookie);portal=st.portal;
  const code=req.nextUrl.searchParams.get('code'),state=req.nextUrl.searchParams.get('state');
  if(req.nextUrl.searchParams.has('error')) throw new Error('google_cancelled');
  if(!code||!state||!compare(state,st.state)) throw new Error('invalid_oauth_state');
  const creds=oauthCredentials(portal);if(!creds) throw new Error('oauth_not_configured');
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({client_id:creds.clientId,client_secret:creds.clientSecret,
    code,code_verifier:st.verifier,redirect_uri:callbackUrl(req.nextUrl.origin),grant_type:'authorization_code'}),
   cache:'no-store'
  });
  if(!tokenResponse.ok) throw new Error('google_exchange_failed');
  const token=await tokenResponse.json();
  if(typeof token.id_token!=='string') throw new Error('google_id_token_missing');
  const profile=await verifyGoogleIdToken(token.id_token,creds.clientId,st.nonce);
  let identity=await db()`select u.id,u.role,u.email from oauth_identities i join app_users u on u.id=i.user_id
   where i.provider='google' and i.provider_sub=${profile.subject} limit 1`;
  let user=identity[0];
  if(st.intent==='link'){
   const existing=await currentUser();
   if(!existing || existing.id!==st.subject) throw new Error('link_session_expired');
   if(existing.email.toLowerCase()!==profile.email) throw new Error('link_email_mismatch');
   if(user && user.id!==existing.id) throw new Error('google_account_already_linked');
   if(!user){
    await db()`insert into oauth_identities(provider,provider_sub,user_id,provider_email)
     values('google',${profile.subject},${existing.id},${profile.email})
     on conflict(provider,provider_sub) do nothing`;
    identity=await db()`select u.id,u.role,u.email from oauth_identities i join app_users u on u.id=i.user_id
     where i.provider='google' and i.provider_sub=${profile.subject}`;
    if(identity[0]?.id!==existing.id) throw new Error('google_account_already_linked');
    user=identity[0];
   }
  }else if(!user){
   // Never promote Google users merely because an email address matches a privileged account.
   const sameEmail=await db()`select id from app_users where email=${profile.email} limit 1`;
   if(sameEmail.length) throw new Error('link_existing_account_first');
   if(portal!=='user') throw new Error('privileged_account_required');
   const passwordHash=await bcrypt.hash(randomBytes(48).toString('base64url'),12);
   const created=await db().begin(async tx=>{
     const rows=await tx`insert into app_users(email,password_hash,full_name,role)
     values(${profile.email},${passwordHash},${profile.name},'user')
     on conflict(email) do nothing returning id,role,email`;
     if(!rows[0]) return null;
     await tx`insert into oauth_identities(provider,provider_sub,user_id,provider_email)
       values('google',${profile.subject},${rows[0].id},${profile.email})`;
     return rows[0];
   });
   if(!created) throw new Error('link_existing_account_first');
   user=created;
  }
  if(!user) throw new Error('account_not_found');
  if(portal==='organiser'&&!['organiser','platform_admin'].includes(user.role)) throw new Error('organiser_access_required');
  if(portal==='platform_admin'&&user.role!=='platform_admin') throw new Error('admin_access_required');
  if(portal==='gate'){
   const p=await db()`select exists(select 1 from gate_assignments where user_id=${user.id})
    or exists(select 1 from events where organiser_id=${user.id}) as permitted`;
   if(!p[0]?.permitted) throw new Error('gate_assignment_required');
  }
  const session=await issueSession(user.id);
  const destination=new URL('/',origin);
  destination.searchParams.set('oauth','success');
  destination.searchParams.set('portal',portal);
  destination.searchParams.set('view',portalDestination(portal));
  response=NextResponse.redirect(destination);
  response.cookies.set('eventpass_session',session,{httpOnly:true,secure:process.env.NODE_ENV==='production',
   sameSite:'lax',path:'/',maxAge:604800});
 }catch(e){
  const reason=e instanceof Error?e.message:'google_sign_in_failed';
  const allowed=['state_missing','google_cancelled','invalid_oauth_state','oauth_not_configured',
  'google_exchange_failed','google_id_token_missing','link_session_expired','link_email_mismatch',
  'google_account_already_linked','link_existing_account_first','privileged_account_required',
  'account_not_found','organiser_access_required','admin_access_required','gate_assignment_required'];
  response=back(origin,portal,allowed.includes(reason)?reason:'google_sign_in_failed');
 }
 response.cookies.delete('eventpass_google_state');
 return response;
}
