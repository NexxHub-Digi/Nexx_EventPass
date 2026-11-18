import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { currentUser, issueSession } from '@/lib/security';
import { callbackUrl, oauthCredentials, portalDestination, readState, verifyGoogleIdToken, type OAuthPortal } from '@/lib/google-oauth';
export const runtime='nodejs';
const compare=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y)};
function back(origin:string,portal:OAuthPortal,code:string){
 const path=portal==='platform_admin'?'platform-admin':portal;
 const u=new URL('/login/'+path,origin);u.searchParams.set('oauth_error',code);return NextResponse.redirect(u);
}
export async function GET(req:NextRequest){
 let portal:OAuthPortal='user';
 const origin=req.nextUrl.origin.includes('.netlify.app') ? req.nextUrl.origin : (process.env.AUTH_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin);
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
  if(portal==='gate'){
   // Gate login requires an explicit accepted invitation or direct authorised
   // assignment. Merely knowing the invitee email does not confer gate rights.
   const eligible=await db()`select exists(
    select 1 from gate_assignments g join app_users operator on operator.id=g.user_id
    join events e on e.id=g.event_id join app_users owner on owner.id=e.organiser_id
    where lower(operator.email)=${profile.email} and owner.role='organiser' and owner.account_status='active'
   ) as permitted`;
   if(!eligible[0]?.permitted)throw new Error('gate_invitation_required');
  }
  let identity=await db()`select u.id,u.role,u.email,u.account_status,u.requested_role from oauth_identities i join app_users u on u.id=i.user_id
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
    identity=await db()`select u.id,u.role,u.email,u.account_status,u.requested_role from oauth_identities i join app_users u on u.id=i.user_id
     where i.provider='google' and i.provider_sub=${profile.subject}`;
    if(identity[0]?.id!==existing.id) throw new Error('google_account_already_linked');
    user=identity[0];
   }
  }else if(!user){
   // Never promote Google users merely because an email address matches a privileged account.
   const sameEmail=await db()`select id,role,account_status from app_users where lower(email)=${profile.email} limit 1`;
   if(sameEmail.length){
    // Google has verified ownership of this email. Migrate ONLY an active,
    // unprivileged legacy User; an Organiser or Platform Admin requires
    // explicit privileged-account linkage, never an email-only promotion.
    if(sameEmail[0].role!=='user'||sameEmail[0].account_status!=='active')throw new Error('link_existing_account_first');
    const linked=await db().begin(async tx=>{
      const rows=await tx`select id,role,email,account_status,requested_role from app_users
        where id=${sameEmail[0].id} and role='user' and account_status='active' for update`;
      if(!rows[0])return null;
      const claimed=await tx`select 1 from oauth_identities where user_id=${rows[0].id} limit 1`;
      if(claimed[0])return null;
      const saved=await tx`insert into oauth_identities(provider,provider_sub,user_id,provider_email)
        values('google',${profile.subject},${rows[0].id},${profile.email})
        on conflict(provider,provider_sub) do nothing returning user_id`;
      if(!saved[0])return null;
      return rows[0];
    });
    if(!linked)throw new Error('link_existing_account_first');
    user=linked;
   }else{
   if(portal==='platform_admin') throw new Error('privileged_account_required');
   const passwordHash=await bcrypt.hash(randomBytes(48).toString('base64url'),12);
   const created=await db().begin(async tx=>{
     const rows=await tx`insert into app_users(email,password_hash,full_name,role,account_status,requested_role)
     values(${profile.email},${passwordHash},${profile.name},'user','active',${portal==='organiser'?'organiser':null})
     on conflict(email) do nothing returning id,role,email,account_status,requested_role`;
     if(!rows[0]) return null;
     await tx`insert into oauth_identities(provider,provider_sub,user_id,provider_email)
       values('google',${profile.subject},${rows[0].id},${profile.email})`;
     return rows[0];
   });
   if(!created) throw new Error('link_existing_account_first');
   user=created;
   }
  }
  if(!user) throw new Error('account_not_found');
  if(portal==='organiser'&&user.role==='user'&&user.account_status==='active'&&user.requested_role!=='organiser'){
    await db()`update app_users set requested_role='organiser' where id=${user.id} and role='user' and account_status='active'`;
    user.requested_role='organiser';
  }
  if(portal==='platform_admin'&&user.role!=='platform_admin') throw new Error('admin_access_required');
  if(user.account_status!=='active'&&!(portal==='organiser'&&user.account_status==='pending')) throw new Error('account_inactive');

  const session=await issueSession(user.id);
  if(st.native===true){
   const schemes:Record<OAuthPortal,string>={user:'eventpassuser',organiser:'eventpassorganiser',gate:'eventpassgate',platform_admin:'eventpassplatformadmin'};
   const nativeChallenge=st.nativeChallenge;
   if(!nativeChallenge||!/^[a-f0-9]{64}$/.test(nativeChallenge))throw new Error('invalid_native_challenge');
   const exchangeCode=randomBytes(32).toString('base64url');
   const hashed=createHash('sha256').update(exchangeCode).digest('hex');
   await db()`insert into mobile_auth_codes(code_hash,user_id,client,expires_at,code_challenge)
     values(${hashed},${user.id},${portal},now()+interval '2 minutes',${nativeChallenge})`;
   const deeplink=new URL(schemes[portal]+'://oauth');
   deeplink.searchParams.set('code',exchangeCode);
   response=NextResponse.redirect(deeplink);
   response.cookies.delete('eventpass_google_state');
   return response;
  }
  const safeInvite=portal==='user'&&typeof st.returnTo==='string'&&/^\/invite\/gate\?token=[A-Za-z0-9_-]{43}$/.test(st.returnTo);
  const destination=new URL(safeInvite?st.returnTo!:'/dashboard/'+(portal==='platform_admin'?'platform-admin':portal),origin);
  destination.searchParams.set('oauth','success');
  destination.searchParams.set('portal',portal);
  destination.searchParams.set('view',(portal==='organiser'&&user.requested_role==='organiser')?'pending':portalDestination(portal));
  response=NextResponse.redirect(destination);
  response.cookies.set('eventpass_session',session,{httpOnly:true,secure:process.env.NODE_ENV==='production',
   sameSite:'lax',path:'/',maxAge:604800});
 }catch(e){
  const reason=e instanceof Error?e.message:'google_sign_in_failed';
  const allowed=['state_missing','google_cancelled','invalid_oauth_state','oauth_not_configured',
  'google_exchange_failed','google_id_token_missing','link_session_expired','link_email_mismatch',
  'google_account_already_linked','link_existing_account_first','privileged_account_required',
  'account_not_found','organiser_access_required','admin_access_required','gate_assignment_required','gate_invitation_required'];
  response=back(origin,portal,allowed.includes(reason)?reason:'google_sign_in_failed');
 }
 response.cookies.delete('eventpass_google_state');
 return response;
}
