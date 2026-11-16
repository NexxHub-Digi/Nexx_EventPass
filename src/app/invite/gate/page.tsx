'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
export default function GateInvitation(){
 const [token,setToken]=useState(''),[email,setEmail]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [accepted,setAccepted]=useState(false);
 useEffect(()=>{setToken(new URLSearchParams(location.search).get('token')||'');
  fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json()).then(d=>setEmail(d.user?.email||'')).catch(()=>{})},[]);
 async function accept(){setBusy(true);setNotice('');
  try{const r=await fetch('/api/gates/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
   const d=await r.json();if(!r.ok)throw Error(d.error||'Invitation cannot be accepted');
   setAccepted(true);window.history.replaceState(null,'','/invite/gate');setNotice('Gate access activated for the assigned event.');
  }catch(e){setNotice(e instanceof Error?e.message:'Invitation failed')}finally{setBusy(false)}
 }
 const returnTo='/invite/gate?token='+token;
 return <main className="role-login-shell"><section className="role-login-card">
  <Link href="/" className="role-login-brand">◈ NEXX <strong>EVENTPASS</strong></Link><div className="eyebrow">PRIVATE EVENT INVITATION</div>
  <h1>Join your assigned gate</h1>
  <p>No separate gate account or password registration is required. Sign in with the Google email your organiser invited, then confirm the event assignment.</p>
  {notice&&<p role="status" className="rw-message">{notice}</p>}
  {accepted?<Link className="rw-primary-link" href="/dashboard/gate">Open Gate Scanner</Link>:email?<>
   <p>Signed in: <strong>{email}</strong></p>
   {token&&<button className="primary wide" disabled={busy} onClick={()=>{void accept()}}>Accept invitation and continue</button>}
   <button className="ghost" onClick={()=>{void fetch('/api/auth/logout',{method:'POST'}).then(()=>setEmail(''))}}>Switch Google account</button>
  </>:token?<a className="google-auth-button" href={'/api/auth/google?portal=user&returnTo='+encodeURIComponent(returnTo)}>
   <span className="google-g" aria-hidden="true">G</span> Continue with Google</a>:<p>Invitation link missing. Ask the organiser to share a new private link.</p>}
  <p className="hint">Only the invited email can accept this one-time, expiring invitation. Access is limited to the organiser's assigned event.</p>
 </section></main>;
}
