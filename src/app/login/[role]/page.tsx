'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {portalHome} from '@/lib/portal-home';
import EventPassLoading from '@/components/EventPassLoading';
import {androidPreviewBuilds,isDownloadRole} from '@/lib/mobile-downloads';

const portals={
 user:{label:'User',title:'Your Next',accent:'Event Awaits',description:'Discover events, book tickets and get your secure QR pass.'},
 organiser:{label:'Organiser',title:'Bring Your',accent:'Events to Life',description:'Create unforgettable experiences and manage your events.'},
 gate:{label:'Gate Operator',title:'Every Entry.',accent:'Effortless.',description:'Scan tickets and welcome guests to your assigned events.'},
 'platform-admin':{label:'Platform Admin',title:'Your Platform.',accent:'Your Control.',description:'Manage the EventPass experience securely.'}
} as const;
type Role=keyof typeof portals;
const errors:Record<string,string>={
 google_cancelled:'Google sign-in was cancelled. You can try again.',
 state_missing:'Your sign-in session expired. Please try again.',
 invalid_oauth_state:'Sign-in verification failed. Please start again.',
 google_exchange_failed:'Google could not complete sign-in. Please try again.',
 oauth_not_configured:'Google sign-in is not configured for this portal.',
 link_existing_account_first:'This email belongs to an existing account. Contact support to link it.',
 privileged_account_required:'This Google account is not an approved administrator.',
 admin_access_required:'This account does not have administrator access.',
 gate_invitation_required:'You need an accepted gate invitation. Ask your organiser for access.',
 account_inactive:'This account is inactive. Contact support.',
 google_sign_in_failed:'Google sign-in could not be completed. Please try again.'
};
export default function RoleLogin(){
 const params=useParams<{role:string}>();
 const role=params.role as Role;
 const [switchOpen,setSwitchOpen]=useState(false);
 const [signingIn,setSigningIn]=useState(false);
 const [androidStatus,setAndroidStatus]=useState<'checking'|'available'|'expired'>('checking');
 useEffect(()=>{
  if(!isDownloadRole(role)){setAndroidStatus('expired');return;}
  setAndroidStatus(Date.now()<Date.parse(androidPreviewBuilds[role].expiresAt)?'available':'expired');
 },[role]);
 useEffect(()=>{const reset=()=>setSigningIn(false);window.addEventListener('pageshow',reset);return()=>window.removeEventListener('pageshow',reset)},[]);
 const [error,setError]=useState('');
 useEffect(()=>{
  const code=new URLSearchParams(window.location.search).get('oauth_error');
  if(!code)return;
  setError(errors[code]||'Sign-in failed. Please try again.');
  window.history.replaceState(null,'',window.location.pathname);
 },[]);
 if(!Object.prototype.hasOwnProperty.call(portals,role))return <main className="ep-login"><Link href="/login/user">Open EventPass sign-in</Link></main>;
 const current=portals[role],oauthRole=role==='platform-admin'?'platform_admin':role;
 const androidBuild=androidPreviewBuilds[role];
 if(signingIn)return <EventPassLoading label="Connecting to Google"/>;
 return <main className="ep-login">
  <div className="ep-ambient ep-ambient-one"/><div className="ep-ambient ep-ambient-two"/>
  <div className="ep-login-layout">
   <header className="ep-login-header">
    <Link href={portalHome[role]} className="ep-logo" aria-label={current.label+' home'}><span className="ep-logo-icon">✓</span><span>Nexx <b>EventPass</b></span></Link>
    <div className="ep-switch-wrap">
     <button type="button" className="ep-switch-button" aria-label="Switch portal" title="Switch portal" aria-expanded={switchOpen} onClick={()=>setSwitchOpen(!switchOpen)}><svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h16m-4-4 4 4-4 4M21 17H5m4-4-4 4 4 4"/></svg></button>
     {switchOpen&&<><button type="button" className="ep-switch-dismiss" aria-label="Close portal menu" onClick={()=>setSwitchOpen(false)}/><nav className="ep-switch-menu" aria-label="Choose portal">{(Object.keys(portals) as Role[]).map(key=><Link key={key} href={'/login/'+key} aria-current={key===role?'page':undefined} onClick={()=>setSwitchOpen(false)}>{portals[key].label}{key===role&&<span>✓</span>}</Link>)}</nav></>}
    </div>
   </header>
   <section className="ep-login-content">
    <div className="ep-event-art" aria-hidden="true">
     <div className="ep-art-orbit ep-orbit-one"/><div className="ep-art-orbit ep-orbit-two"/>
     <div className="ep-art-ticket"><div className="ep-art-ticket-top">NEXX <b>EVENTPASS</b></div><div className="ep-art-ticket-mark">✦</div><div className="ep-art-ticket-bottom">YOUR PASS TO WHAT'S NEXT <span>▦</span></div></div>
     <div className="ep-art-caption"><span>DISCOVER · BOOK · ATTEND</span><h2>Make every moment <em>unforgettable.</em></h2></div>
    </div>
    <section className="ep-login-panel" aria-label={current.label+' sign-in'}>
     <div className="ep-panel-glow"/>
     <div className="ep-panel-inner">
      <div className="ep-panel-kicker">DISCOVER · BOOK · ATTEND</div>
      <div className="ep-mobile-ticket" aria-hidden="true">✦</div>
      <h1>{current.title}<br/><span>{current.accent}</span></h1>
      <p className="ep-login-description">{current.description}</p>
      {error&&<div role="alert" className="ep-login-error">{error}</div>}
      <a className="ep-google-button" onClick={event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)setSigningIn(true)}} href={'/api/auth/google?portal='+encodeURIComponent(oauthRole)}><svg aria-hidden="true" width="24" height="24" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.9 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.86 23.86 0 0 0 0 24c0 3.87.93 7.51 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Continue with Google</a>
      <p className="ep-login-note">{role==='user'?'One tap to discover your next experience.':role==='organiser'?'New organiser accounts require platform approval.':role==='gate'?'An accepted invitation is required to enter.':'Authorised administrators only.'}</p>
      <section className="ep-app-download" aria-label={current.label+' app downloads'}>
       <div className="ep-app-download-heading">
        <strong>Get the {current.label} app</strong>
        <span>Dedicated mobile access for this portal</span>
       </div>
       <div className="ep-app-download-actions">
        {androidStatus==='available'
         ? <a className="ep-app-download-button ep-app-download-android" href={'/api/download/android/'+role} target="_blank" rel="noopener noreferrer" aria-label={'Download '+current.label+' Android preview APK'}>
           <svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8 3 5m16 3 2-3M6.5 4.5 9 2m8.5 2.5L15 2"/><rect x="5" y="8" width="14" height="11" rx="3"/><path d="M8 19v3m8-3v3M3 10v7m18-7v7M8 12h.01M16 12h.01"/></svg>
           <span><strong>Android</strong><small>Download preview APK</small></span>
           <span aria-hidden="true" className="ep-app-download-arrow">↗</span>
          </a>
         : <button type="button" className="ep-app-download-button ep-app-download-unavailable" disabled aria-label={current.label+' Android preview '+(androidStatus==='expired'?'expired':'being checked')}>
           <svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="8" width="14" height="11" rx="3"/><path d="M6 6 3 3m15 3 3-3M8 19v3m8-3v3"/></svg>
           <span><strong>Android</strong><small>{androidStatus==='expired'?'Preview expired':'Checking build…'}</small></span>
          </button>}
        <button type="button" className="ep-app-download-button ep-app-download-ios" disabled aria-disabled="true" title="The iOS app is not available yet" aria-label={current.label+' iOS app coming soon'}>
         <svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M16.37 12.37c.02 2.19 1.94 2.92 1.96 2.93-.02.06-.31 1.05-1.02 2.08-.61.88-1.25 1.76-2.25 1.78-.98.02-1.3-.58-2.43-.58-1.12 0-1.48.56-2.42.6-1 .04-1.75-.96-2.35-1.83-1.29-1.86-2.27-5.26-.95-7.54a3.65 3.65 0 0 1 3.1-1.89c.97-.02 1.88.67 2.47.67.59 0 1.7-.83 2.87-.71.49.02 1.87.19 2.75 1.48-.07.04-1.67.97-1.65 3.01ZM14.73 6.64c.51-.62.85-1.47.76-2.32-.73.03-1.61.49-2.14 1.1-.47.54-.89 1.4-.78 2.23.82.06 1.65-.42 2.16-1.01Z"/></svg>
         <span><strong>iOS</strong><small>Coming soon</small></span>
         <span className="ep-app-download-pending" aria-hidden="true">Soon</span>
        </button>
       </div>
       <p className="ep-app-download-notice">Android v{androidBuild.version} is a staging preview, not a production-store release. Build link valid until 3 Dec 2026.</p>
      </section>
      <div className="ep-benefits"><div><span>▦</span><small>Discover<br/>Events</small></div><div><span>◇</span><small>Book<br/>Tickets</small></div><div><span>▣</span><small>Get QR<br/>Pass</small></div></div>
     </div>
    </section>
   </section>
   <footer className="ep-login-footer"><span>© Nexx EventPass</span><span>Secure Google sign-in</span></footer>
  </div>
  <style jsx global>{`
   .ep-login{min-height:100dvh;position:relative;isolation:isolate;overflow:hidden;background:#050b22;color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}
   .ep-login *{box-sizing:border-box}.ep-login a{text-decoration:none}.ep-login-layout{position:relative;z-index:1;max-width:1440px;min-height:100dvh;margin:auto;display:flex;flex-direction:column;padding:28px clamp(20px,5vw,72px) 18px}
   .ep-ambient{position:absolute;pointer-events:none;filter:blur(60px);border-radius:50%;opacity:.5}.ep-ambient-one{width:600px;height:600px;background:#4b13a0;top:-250px;left:-220px}.ep-ambient-two{width:620px;height:620px;background:#0058d5;right:-260px;bottom:-300px}
   .ep-login-header{display:flex;justify-content:space-between;align-items:center;gap:16px}.ep-logo{display:flex;align-items:center;gap:12px;color:white;font-size:clamp(18px,2.2vw,28px);font-weight:800;letter-spacing:-.04em}.ep-logo b{color:#8fe7ff}.ep-logo-icon{display:grid;place-items:center;width:46px;height:39px;transform:rotate(-13deg);border-radius:8px;background:linear-gradient(135deg,#28d8ff,#2365ff 65%,#9c43ff);box-shadow:0 0 24px #21cfff77;color:white;font-size:26px}
   .ep-switch-wrap{position:relative;z-index:5}.ep-switch-button{display:flex;align-items:center;gap:10px;border:1px solid #a852ff;background:#130f33a8;color:white;border-radius:999px;padding:11px 20px;font:700 14px inherit;cursor:pointer;box-shadow:0 0 20px #912eff30}.ep-switch-button:hover,.ep-switch-button:focus-visible{border-color:#4ceaff;outline:2px solid #4ceaff55}.ep-switch-button span:first-child{font-size:22px;color:#df77ff}
   .ep-switch-dismiss{position:fixed;inset:0;background:transparent;border:0;z-index:-1;cursor:default}.ep-switch-menu{position:absolute;right:0;top:calc(100% + 10px);width:215px;padding:8px;background:#101a39;border:1px solid #57639a;border-radius:16px;box-shadow:0 20px 60px #0009;display:grid;gap:3px}.ep-switch-menu a{padding:12px 13px;color:#e8efff;border-radius:10px;font-size:14px;display:flex;justify-content:space-between}.ep-switch-menu a:hover,.ep-switch-menu a[aria-current=page]{background:#27376b;color:white}
   .ep-login-content{flex:1;display:grid;grid-template-columns:1.05fr 1fr;align-items:center;gap:clamp(24px,5vw,80px);padding:28px 0}.ep-event-art{height:560px;position:relative;display:flex;align-items:center;justify-content:center;perspective:800px}.ep-event-art:before{content:'';position:absolute;inset:5%;background:radial-gradient(ellipse at 50% 55%,#9338e8a1,transparent 50%),radial-gradient(ellipse at 65% 50%,#04dfff80,transparent 55%);filter:blur(40px)}.ep-art-orbit{position:absolute;width:90%;height:70%;border:2px solid #a94bff6b;border-radius:50%;transform:rotate(-24deg);box-shadow:0 0 30px #b22aff44}.ep-orbit-two{transform:rotate(33deg);border-color:#12d6ff77;width:78%;height:83%}
   .ep-art-ticket{width:min(82%,430px);aspect-ratio:1.65;transform:rotate(-13deg) rotateY(-12deg);border-radius:22px;border:2px solid #74e7ff;background:linear-gradient(135deg,#6215b9,#131d6b 45%,#0b8cc2);box-shadow:0 0 45px #09d7ff99,0 25px 90px #000a,inset 0 0 55px #e44aff55;display:flex;flex-direction:column;justify-content:space-between;padding:26px;position:relative}.ep-art-ticket:after{content:'';position:absolute;top:15%;bottom:15%;right:24%;border-left:2px dashed #a9dcff88}.ep-art-ticket-top{font-size:18px;font-weight:800;letter-spacing:.06em}.ep-art-ticket-top b{color:#83edff}.ep-art-ticket-mark{font-size:70px;color:#e7a3ff;text-shadow:0 0 24px #d94bff}.ep-art-ticket-bottom{font-size:10px;letter-spacing:.15em}.ep-art-ticket-bottom span{float:right;font-size:34px}.ep-art-caption{position:absolute;bottom:0;left:0}.ep-art-caption span{font-size:12px;letter-spacing:.24em;color:#7de8ff;font-weight:700}.ep-art-caption h2{font-size:clamp(28px,3.3vw,48px);max-width:480px;line-height:1.1;margin:10px 0;font-weight:850;letter-spacing:-.04em}.ep-art-caption em{font-style:normal;color:#ca7aff}
   .ep-login-panel{position:relative;overflow:hidden;border:1px solid #539cff;border-radius:34px;background:linear-gradient(145deg,#122351f0,#0b1232f5 55%,#250b58ee);box-shadow:0 0 38px #138fff35,0 25px 80px #0008;min-height:530px;display:flex;align-items:center}.ep-panel-glow{position:absolute;inset:auto -20% -50% -20%;height:70%;background:radial-gradient(ellipse,#7d19f977,transparent 65%);pointer-events:none}.ep-panel-inner{position:relative;width:100%;padding:clamp(26px,4vw,56px);text-align:center}.ep-panel-kicker{color:#8de8ff;letter-spacing:.22em;font-size:11px;font-weight:800;margin-bottom:30px}.ep-panel-inner h1{font-size:clamp(38px,4vw,64px);line-height:1.05;letter-spacing:-.055em;font-weight:850;margin:0 0 24px;color:white}.ep-panel-inner h1 span{background:linear-gradient(95deg,#09dfff,#6c8dff,#ef52ed);background-clip:text;-webkit-background-clip:text;color:transparent}.ep-login-description{color:#d3dafa;font-size:clamp(15px,1.5vw,18px);line-height:1.55;max-width:420px;margin:0 auto 32px}.ep-google-button{display:flex;align-items:center;justify-content:center;gap:14px;width:100%;min-height:64px;border-radius:999px;background:#fff;color:#10162e;font-size:17px;font-weight:800;box-shadow:0 12px 28px #0004;transition:transform .18s,box-shadow .18s}.ep-google-button:hover{transform:translateY(-2px);box-shadow:0 12px 35px #23c9ff55}.ep-google-button:focus-visible{outline:3px solid #7de8ff;outline-offset:4px}.ep-login-note{font-size:12px;color:#b6c4e5;margin:17px 0 30px}.ep-login-error{background:#5e1c39;color:#ffe4ee;border:1px solid #ff9ab9;padding:12px;border-radius:12px;margin-bottom:20px;font-size:14px}.ep-benefits{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding-top:10px}.ep-benefits>div{display:grid;justify-items:center;gap:8px;border-right:1px solid #6374b655}.ep-benefits>div:last-child{border:0}.ep-benefits span{font-size:28px;color:#7be8ff}.ep-benefits small{color:#e3e8ff;font-size:12px;line-height:1.4}.ep-mobile-ticket{display:none}.ep-login-footer{display:flex;justify-content:space-between;gap:10px;color:#8291b8;font-size:12px}
   .ep-app-download{margin:0 auto 26px;padding:16px;border:1px solid #566fa46b;border-radius:19px;background:linear-gradient(135deg,#0a1733b9,#17103db9);max-width:480px;text-align:left}.ep-app-download-heading{display:flex;flex-direction:column;gap:4px;margin-bottom:13px}.ep-app-download-heading strong{font-size:14px;font-weight:800;color:#f7f9ff}.ep-app-download-heading span{font-size:12px;color:#bdc9e4}.ep-app-download-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ep-app-download-button{display:flex;align-items:center;gap:9px;min-height:68px;padding:11px;border:1px solid #5279a9;border-radius:14px;text-align:left;color:#f7faff;background:#102d47;font:inherit;min-width:0}.ep-app-download-button>span:not(.ep-app-download-arrow):not(.ep-app-download-pending){display:flex;flex-direction:column;gap:3px;min-width:0}.ep-app-download-button strong{font-size:13px;font-weight:800}.ep-app-download-button small{font-size:10px;line-height:1.35;color:#b8d1e3}.ep-app-download-android{background:linear-gradient(110deg,#145048,#15344d);border-color:#36cbb2;transition:transform .2s,border-color .2s}.ep-app-download-android:hover{transform:translateY(-2px);border-color:#9ef6e5}.ep-app-download-android:focus-visible{outline:2px solid #6ce8ed;outline-offset:3px}.ep-app-download-android svg{flex-shrink:0;color:#92f1da}.ep-app-download-arrow{margin-left:auto;color:#9ef6e5;font-size:15px}.ep-app-download-ios,.ep-app-download-unavailable{background:#151b34;color:#b5bfd9;border-color:#414c70;cursor:not-allowed;opacity:.85}.ep-app-download-ios svg,.ep-app-download-unavailable svg{flex-shrink:0;color:#9ba9cd}.ep-app-download-pending{margin-left:auto;border-radius:8px;padding:3px 5px;background:#273053;color:#c0c9e9;font-size:9px}.ep-app-download-notice{font-size:10px;line-height:1.55;color:#acb9d8;margin:12px 0 0}.ep-login .ep-app-download-button:disabled{opacity:.85;cursor:not-allowed}
   @media(max-width:380px){.ep-app-download{padding:12px}.ep-app-download-button{gap:6px;padding:8px}.ep-app-download-button svg{width:21px;height:21px}.ep-app-download-button strong{font-size:12px}.ep-app-download-button small{font-size:9px}}
   @media(max-width:800px){.ep-login-layout{padding:22px 20px 20px}.ep-login-content{grid-template-columns:1fr;gap:0;padding:20px 0}.ep-event-art{display:none}.ep-login-panel{width:min(100%,520px);margin:auto;min-height:unset}.ep-panel-inner{padding:36px 24px}.ep-panel-kicker{margin-bottom:20px}.ep-mobile-ticket{display:grid;place-items:center;width:78px;height:78px;margin:0 auto 24px;border-radius:22px;background:linear-gradient(135deg,#1fceff,#543aff,#c637ed);font-size:48px;box-shadow:0 0 38px #7d38ff99}.ep-login-footer{padding-top:15px}}
   @media(max-width:480px){.ep-login{background:radial-gradient(circle at 50% 25%,#38136e,#07122e 65%,#050a20)}.ep-logo{font-size:18px;gap:8px}.ep-logo-icon{width:35px;height:32px;font-size:21px}.ep-switch-button{padding:9px 13px;font-size:13px;gap:7px}.ep-login-layout{padding:20px 15px 16px}.ep-login-content{padding:32px 0 18px}.ep-login-panel{border-radius:28px}.ep-panel-inner{padding:35px 20px 32px}.ep-panel-inner h1{font-size:clamp(36px,10vw,49px)}.ep-google-button{min-height:60px;font-size:15px}.ep-login-description{font-size:15px}.ep-benefits small{font-size:11px}.ep-login-footer{font-size:10px}}
   @media(prefers-reduced-motion:reduce){.ep-google-button{transition:none}.ep-google-button:hover{transform:none}}
  `}</style>
 </main>;
}
