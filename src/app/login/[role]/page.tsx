'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
const portals={user:['User','Discover events, explore media and keep your ticket wallet'],organiser:['Event Organiser','Create events, request verification and design tickets'],gate:['Gate Operator','Access only the events your organiser assigned'],'platform-admin':['Platform Admin','Review organisers, approve event listings and manage access']} as const;
export default function RoleLogin(){
 const params=useParams<{role:string}>(),role=params.role as keyof typeof portals,details=portals[role];
 const [error,setError]=useState('');
 useEffect(()=>{const code=new URLSearchParams(window.location.search).get('oauth_error');
  if(!code)return;
  const messages:Record<string,string>={
   google_cancelled:'Google sign-in was cancelled.',
   state_missing:'The sign-in session expired. Try again.',
   invalid_oauth_state:'Security verification failed. Start again.',
   google_exchange_failed:'Google could not complete sign-in. Check the authorised redirect URI.',
   oauth_not_configured:'Google sign-in is not configured for this role.',
   link_existing_account_first:'An older account has this email. Contact the platform administrator for account linking.',
   privileged_account_required:'This Google identity is not an approved administrator.',
   admin_access_required:'You do not have administrator privileges.',
   gate_invitation_required:'Your email is not on an active gate invitation. Ask an organiser to invite you first.',
   account_inactive:'This account is inactive. Contact platform administration.',
   google_sign_in_failed:'Google sign-in could not be completed. Please try again.'
  };
  setError(messages[code]||'Sign-in failed. Please try again.');
  window.history.replaceState(null,'',window.location.pathname);
 },[]);
 if(!details)return <main className="role-login-shell"><div className="role-login-card"><h1>Interface not found</h1><Link href="/login/user">Open User sign-in</Link></div></main>;
 const oauthRole=role==='platform-admin'?'platform_admin':role;
 return <main className="role-login-shell"><div className="role-login-card">
  <Link href="/" className="role-login-brand">◈ NEXX <strong>EVENTPASS</strong></Link>
  <div className="eyebrow">SECURE GOOGLE ACCESS</div><h1>{details[0]}</h1><p>{details[1]}</p>
  <div className="role-login-switch">{Object.entries(portals).map(([key,info])=><Link href={'/login/'+key} key={key} className={key===role?'selected':''}>{info[0]}</Link>)}</div>
  {error&&<p role="alert" className="role-login-error">{error}</p>}
  <a className="google-auth-button" href={'/api/auth/google?portal='+encodeURIComponent(oauthRole)}>
   <span className="google-g" aria-hidden="true">G</span> Continue with Google</a>
  <p className="hint">{role==='organiser'?'New organiser applications stay inactive until Platform Admin approval.':role==='gate'?'No separate registration required. Your organiser must first invite your Google email.':role==='platform-admin'?'Only pre-authorised Platform Administrators may enter.':'Your Google account is your secure registration and sign-in.'}</p>
  <Link href="/" className="role-login-back">← Back to EventPass</Link>
 </div></main>;
}
