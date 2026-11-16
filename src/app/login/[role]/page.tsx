'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
type Portal = 'user'|'organiser'|'gate'|'platform_admin';
const portals: Record<Portal,{title:string;about:string;view:string;canRegister:boolean}> = {
 user:{title:'User',about:'Find events, request tickets and manage your personal QR wallet.',view:'explore',canRegister:true},
 organiser:{title:'Event Organiser',about:'Apply with Google or email; manage events after platform approval.',view:'manage',canRegister:true},
 gate:{title:'Gate Operator',about:'Scan tickets only for events your organiser has assigned.',view:'scan',canRegister:false},
 platform_admin:{title:'Platform Administrator',about:'Restricted platform health and oversight.',view:'platform',canRegister:false}
};
export default function RoleLogin(){
 const params=useParams<{role:string}>();
 const role=(params.role==='platform-admin'?'platform_admin':params.role) as Portal;
 const choice=portals[role];
 const [mode,setMode]=useState<'login'|'register'>('login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[invite,setInvite]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const code=new URLSearchParams(window.location.search).get('oauth_error');
  if(!code)return;
  const errors:Record<string,string>={
   google_cancelled:'Google sign-in was cancelled. You can try again.',
   state_missing:'Google authentication expired. Start a fresh sign-in from this page.',
   invalid_oauth_state:'Google security verification failed. Please restart sign-in.',
   google_exchange_failed:'Google rejected the authentication exchange. Check the configured OAuth redirect URI.',
   oauth_not_configured:'Google OAuth is not configured for this role.',
   link_existing_account_first:'This email already has an EventPass account. Sign in with your existing password, then link Google from your dashboard.',
   privileged_account_required:'Sign in to an approved account and link Google to it first.',
   organiser_access_required:'Your organiser application is not approved yet.',
   admin_access_required:'This Google identity is not authorised as a Platform Administrator.',
   account_inactive:'Your account is inactive. Contact Platform Administration.',
   google_sign_in_failed:'Google sign-in failed. Confirm this OAuth client uses the EventPass callback URL and try again.'
  };
  setError(errors[code]||'Google sign-in failed. Please retry.');
  window.history.replaceState(null,'',window.location.pathname);
 },[]);
 if(!choice)return <main className="role-login-shell"><div className="role-login-card"><h1>Interface not found</h1><Link href="/login/user">User login</Link></div></main>;
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');
  try{
   const result=await fetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({portal:role,email,password,fullName:name,organiserCode:role==='organiser'?invite:''})});
   const value=await result.json();if(!result.ok)throw Error(value.error||'Sign-in failed');
   window.location.assign('/dashboard/'+(role==='platform_admin'?'platform-admin':role));
  }catch(err){setError(err instanceof Error?err.message:'Sign-in failed');setBusy(false)}
 }
 return <main className="role-login-shell"><div className="role-login-card">
  <Link href="/" className="role-login-brand">◈ NEXX <strong>EVENTPASS</strong></Link>
  <div className="eyebrow">ROLE-BASED ACCESS</div><h1>{choice.title}</h1><p>{choice.about}</p>
  <nav className="role-login-switch" aria-label="Choose interface">{Object.entries(portals).map(([k,v])=><Link key={k} aria-current={role===k?'page':undefined} className={role===k?'selected':''} href={'/login/'+k.replace('_','-')}>{v.title}</Link>)}</nav>
  <div className="role-login-tabs"><button type="button" className={mode==='login'?'selected':''} onClick={()=>setMode('login')}>Sign in</button>{choice.canRegister&&<button type="button" className={mode==='register'?'selected':''} onClick={()=>setMode('register')}>Create account</button>}</div>
  <form className="role-login-form" onSubmit={submit}>
  {mode==='register'&&<label>Full name<input required minLength={2} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>}
  <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
  <label>Password<input required type="password" minLength={10} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
  
  {error&&<p role="alert" className="role-login-error">{error}</p>}
  <button type="submit" className="primary wide" disabled={busy}>{busy?'Verifying…':mode==='login'?'Sign in':'Create account'}</button></form>
  <div className="oauth-divider">or continue with</div>
  <a className="google-auth-button" href={'/api/auth/google?portal='+encodeURIComponent(role)}><span className="google-g" aria-hidden="true">G</span> Continue with Google</a>
  <p className="hint">{role==='user'?'New Google accounts can register as Users.':'Existing accounts can sign in with their password, then link Google from their role dashboard. New organisers may apply using Google.'}</p>
  <Link href="/" className="role-login-back">← Back to EventPass</Link>
 </div></main>;
}
