'use client';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
type Portal = 'user'|'organiser'|'gate'|'platform_admin';
const portals: Record<Portal,{title:string;about:string;view:string;canRegister:boolean}> = {
 user:{title:'User',about:'Find events, request tickets and manage your personal QR wallet.',view:'explore',canRegister:true},
 organiser:{title:'Event Organiser',about:'Create events, confirm manual payments and manage gate access.',view:'manage',canRegister:true},
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
  {mode==='register'&&role==='organiser'&&<label>Organiser invitation code<input required type="password" value={invite} onChange={e=>setInvite(e.target.value)}/></label>}
  {error&&<p role="alert" className="role-login-error">{error}</p>}
  <button type="submit" className="primary wide" disabled={busy}>{busy?'Verifying…':mode==='login'?'Sign in':'Create account'}</button></form>
  <div className="oauth-divider">or continue with</div>
  <a className="google-auth-button" href={'/api/auth/google?portal='+encodeURIComponent(role)}><span className="google-g" aria-hidden="true">G</span> Continue with Google</a>
  <p className="hint">{role==='user'?'New Google accounts can register as Users.':'Existing authorised accounts must link their Google identity before privileged login.'}</p>
  <Link href="/" className="role-login-back">← Back to EventPass</Link>
 </div></main>;
}
