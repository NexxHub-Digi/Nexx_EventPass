'use client';
import React,{useEffect,useState} from 'react';
import Link from 'next/link';
export default function GateInvitation(){
 const [token,setToken]=useState(''),[me,setMe]=useState<{email:string}|null>(null),[busy,setBusy]=useState(false),
 [email,setEmail]=useState(''),[password,setPassword]=useState(''),[fullName,setFullName]=useState(''),[register,setRegister]=useState(false),
 [message,setMessage]=useState(''),[accepted,setAccepted]=useState(false);
 useEffect(()=>{setToken(new URLSearchParams(window.location.search).get('token')||'');
  fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json()).then(r=>setMe(r.user||null)).catch(()=>{})},[]);
 async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');
  try{const resp=await fetch('/api/auth/'+(register?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({portal:'user',email,password,fullName})});
  const data=await resp.json();if(!resp.ok)throw Error(data.error||'Sign in failed');setMe(data.user);setPassword('');
  }catch(e){setMessage(e instanceof Error?e.message:'Sign-in failed')}finally{setBusy(false)}
 }
 async function accept(){setBusy(true);setMessage('');
  try{const res=await fetch('/api/gates/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Invitation could not be accepted');
   setAccepted(true);window.history.replaceState(null,'','/invite/gate');setMessage('Invitation accepted. Your gate operator access is active.');
  }catch(e){setMessage(e instanceof Error?e.message:'Invitation failed')}finally{setBusy(false)}
 }
 return <main className="role-login-shell"><div className="role-login-card">
  <Link href="/" className="role-login-brand">◈ NEXX <strong>EVENTPASS</strong></Link>
  <div className="eyebrow">EVENT STAFF INVITATION</div><h1>Join an event gate</h1>
  <p>Your organiser invited you to verify tickets. This assignment gives access to the specified event only—not organiser or administrator privileges.</p>
  {message&&<p role="status">{message}</p>}
  {!token&&!accepted&&<p role="alert">Invitation link is missing. Ask the organiser for a new private link.</p>}
  {me?<><p>Signed in as <strong>{me.email}</strong></p><button className="ghost" onClick={()=>{void fetch('/api/auth/logout',{method:'POST'}).then(()=>setMe(null))}}>Not your invited email? Switch account</button>
   {token&&!accepted&&<button className="primary wide" disabled={busy} onClick={()=>{void accept()}}>Accept event invitation</button>}
   {accepted&&<Link className="rw-primary-link" href="/dashboard/gate">Open Gate Operator dashboard</Link>}
   </>:<>
   <p>Register a User account or sign in using the email your organiser invited.</p>
   <form className="role-login-form" onSubmit={login}>
    {register&&<label>Name<input required minLength={2} value={fullName} onChange={e=>setFullName(e.target.value)}/></label>}
    <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Password<input type="password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <button className="primary wide" disabled={busy}>{register?'Register and continue':'Sign in and continue'}</button>
   </form>
   <button className="ghost" onClick={()=>setRegister(!register)}>{register?'Already registered? Sign in':'New? Create an account'}</button>
   {token&&<a className="google-auth-button" href={'/api/auth/google?portal=user&returnTo='+encodeURIComponent('/invite/gate?token='+token)}>
    <span className="google-g" aria-hidden="true">G</span> Continue with Google</a>}
   </>}
 </div></main>
}
