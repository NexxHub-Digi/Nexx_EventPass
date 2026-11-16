'use client';
import React,{useEffect,useRef,useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {useParams} from 'next/navigation';
import {ticketThemes,findTicketTheme} from '@/lib/ticket-themes';
type Member={id:string;email:string;full_name:string;role:string;account_status:string;requested_role:string|null};
type Event={id:string;organiser_id:string;title:string;venue:string;starts_at:string;price_ngn:number;capacity:number;status:string;verification_status?:string;organiser?:string;description?:string;category?:string;ticket_theme?:string;cover_media_id?:string|null;video_media_id?:string|null;ticket_art_id?:string|null;bank_name?:string;bank_account_name?:string;bank_account_number?:string};
type Order={id:string;event_id:string;event_title:string;buyer_name?:string;buyer_email?:string;status:string;quantity:number;amount_ngn:number;payment_reference:string;receipt_uploaded_at?:string|null};
type Ticket={id:string;title:string;venue:string;starts_at:string;status:string;qr:string|null;redeemed_at?:string|null;ticket_theme?:string;ticket_art_id?:string|null};
type Gate={event_id:string;title:string;gate_label:string;organiser_name?:string};
type Organiser={id:string;email:string;full_name:string;role:string;account_status:string;requested_role:string|null;event_count:number;pending_orders:number;tickets_issued:number;gate_operators:number;created_at:string;approved_at?:string|null;bank_name?:string|null;account_name?:string|null;account_number?:string|null};
type Invite={id:string;event_id:string;invitee_email:string;gate_label:string;status:string};
type Scan={id:string;outcome:string;operator?:string;gate_label:string;scanned_at:string};
type EventMedia={id:string;event_id?:string;media_type:string;file_name:string;approved?:boolean;url:string};
type ModerationEvent={id:string;title:string;venue:string;starts_at:string;organiser_name:string;organiser_email:string;status:string;verification_status:string;pending_media:number};
const roles={user:'User',organiser:'Event Organiser',gate:'Gate Operator','platform-admin':'Platform Administrator'} as const;
type Role=keyof typeof roles;
const money=(v:number)=>'₦'+Number(v).toLocaleString('en-NG');
const nice=(v:string)=>new Date(v).toLocaleString('en-NG');
async function api(route:string,method='GET',body?:unknown){
 const res=await fetch('/api/'+route,{method,credentials:'same-origin',
 headers:body instanceof FormData?undefined:{'Content-Type':'application/json'},body:body instanceof FormData?body:body?JSON.stringify(body):undefined,cache:'no-store'});
 let result;try{result=await res.json()}catch{throw Error('Service unavailable')}
 if(!res.ok)throw Error(result.error||'Request failed');return result;
}
export default function RoleWorkspace(){
 const p=useParams<{role:string}>(),role=p.role as Role,title=roles[role],scanControls=useRef<{stop:()=>void}|null>(null);
 const [me,setMe]=useState<Member|null>(null),[portals,setPortals]=useState<string[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[orders,setOrders]=useState<Order[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[gates,setGates]=useState<Gate[]>([]),[invites,setInvites]=useState<Invite[]>([]);
 const [search,setSearch]=useState(''),[filterCategory,setFilterCategory]=useState('All'),[sortBy,setSortBy]=useState('soonest');
 const [eventDescription,setEventDescription]=useState(''),[eventCategory,setEventCategory]=useState('Music'),[ticketTheme,setTicketTheme]=useState('aurora');
 const [eventMedia,setEventMedia]=useState<EventMedia[]>([]),[moderationEvents,setModerationEvents]=useState<ModerationEvent[]>([]),[moderationMedia,setModerationMedia]=useState<EventMedia[]>([]);
 const [organisers,setOrganisers]=useState<Organiser[]>([]),[stats,setStats]=useState<Record<string,number>>({});
 const [selectedOrganiser,setSelectedOrganiser]=useState(''),[editName,setEditName]=useState(''),[editBank,setEditBank]=useState(''),[editAccount,setEditAccount]=useState(''),[editNumber,setEditNumber]=useState('');
 const [bankName,setBankName]=useState(''),[accountName,setAccountName]=useState(''),[accountNumber,setAccountNumber]=useState('');
 const [eventId,setEventId]=useState(''),[eventTitle,setEventTitle]=useState(''),[venue,setVenue]=useState(''),[startsAt,setStartsAt]=useState(''),[capacity,setCapacity]=useState('100'),[ticketPrice,setTicketPrice]=useState('5000'),[keyword,setKeyword]=useState('');
 const [quantity,setQuantity]=useState('1'),[paymentRef,setPaymentRef]=useState(''),[selectedEvent,setSelectedEvent]=useState(''),[receipt,setReceipt]=useState<File|null>(null),[receiptUploads,setReceiptUploads]=useState<Record<string,File|null>>({});
 const [staffEmail,setStaffEmail]=useState(''),[gateLabel,setGateLabel]=useState('Main gate'),[newOrganiser,setNewOrganiser]=useState(''),[latestInvite,setLatestInvite]=useState('');
 const [scanCode,setScanCode]=useState(''),[scanning,setScanning]=useState(false),[scanOutcome,setScanOutcome]=useState(''),[scans,setScans]=useState<Scan[]>([]);
 const valid=role==='user'||role==='organiser'||role==='gate'||role==='platform-admin';
 const allowed=me&&portals.includes(role==='platform-admin'?'platform_admin':role);
 async function fetchAll(){
  const m=await api('auth/me');setMe(m.user);setPortals(m.portals||[]);
  if(!m.user)return;
  const e=await api('events');setEvents(e.events||[]);
  if(m.user.account_status==='pending'||(role==='organiser'&&m.user.role==='user'&&m.user.requested_role==='organiser'))return;
  const rr=role==='platform-admin'?'platform_admin':role;
  if(!(m.portals||[]).includes(rr))return;
  if(role==='user'){
   const [t,o]=await Promise.all([api('tickets'),api('orders')]);setTickets(t.tickets||[]);setOrders(o.orders||[]);
  }else if(role==='organiser'){
   const [b,g]=await Promise.all([api('organiser/payment-account'),api('gates')]);
   setBankName(b.account?.bank_name||'');setAccountName(b.account?.account_name||'');setAccountNumber(b.account?.account_number||'');
   setGates(g.gates||[]);setInvites(g.invitations||[]);
  }else if(role==='gate'){const g=await api('gates');setGates(g.gates||[]);}
  else if(role==='platform-admin'){
   const [a,overview]=await Promise.all([api('platform/organisers'),api('platform/overview')]);
   setOrganisers(a.organisers||[]);setStats(overview.stats||{});
   const reviews=await api('platform/events');setModerationEvents(reviews.events||[]);setModerationMedia(reviews.media||[]);
  }
 }
 useEffect(()=>{setLoading(true);fetchAll().catch(e=>setMessage((e as Error).message)).finally(()=>setLoading(false));return ()=>{scanControls.current?.stop()}},[role]);
 useEffect(()=>{if(!eventId){setOrders([]);setScans([]);return}
 if(role==='organiser')api('orders?eventId='+encodeURIComponent(eventId)).then(v=>setOrders(v.orders||[])).catch(e=>setMessage((e as Error).message));
 if(role==='gate')api('gates/activity?eventId='+encodeURIComponent(eventId)).then(v=>setScans(v.scans||[])).catch(e=>setMessage((e as Error).message));
 if(role==='organiser')api('events/media?eventId='+encodeURIComponent(eventId)).then(v=>setEventMedia(v.media||[])).catch(e=>setMessage((e as Error).message));
 },[eventId,role]);
 async function run(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 async function createEvent(){await run(async()=>{
  const date=new Date(startsAt);if(!Number.isFinite(date.getTime()))throw Error('Choose an event date');
  const result=await api('events','POST',{title:eventTitle,venue,description:eventDescription,category:eventCategory,ticketTheme,startsAt:date.toISOString(),capacity:Number(capacity),priceNgn:Number(ticketPrice),qrKeyword:keyword});
  setEventTitle('');setKeyword('');await fetchAll();setEventId(result.event.id);setMessage('Event created! Add promotional media and send your listing for Platform Admin verification.');
 })}
 async function saveEventDesign(){await run(async()=>{
  if(!eventId)throw Error('Select your event first');
  await api('events','PATCH',{eventId,description:eventDescription,category:eventCategory,ticketTheme});
  await fetchAll();setMessage('Event design saved. Updated event content awaits platform review.');
 })}
 async function uploadMedia(file:File|null,purpose=''){
  if(!eventId||!file)return;
  await run(async()=>{
   const form=new FormData();form.append('eventId',eventId);form.append('file',file);
   if(purpose)form.append('purpose',purpose);
   await api('events/media','POST',form);
   const v=await api('events/media?eventId='+encodeURIComponent(eventId));setEventMedia(v.media||[]);
   setMessage('Media uploaded for administrator review.');
  });
 }
 async function deleteMedia(id:string){await run(async()=>{
  await api('events/media','DELETE',{id});const v=await api('events/media?eventId='+encodeURIComponent(eventId));setEventMedia(v.media||[]);
  setMessage('Media removed');
 })}
 async function moderateEvent(eventId:string,action:string,mediaId?:string){await run(async()=>{
  await api('platform/events','POST',{eventId,action,mediaId});
  const result=await api('platform/events');setModerationEvents(result.events||[]);setModerationMedia(result.media||[]);
  setMessage('Event review completed');
 })}
 async function loadUserMedia(id:string){setSelectedEvent(id);if(!id){setEventMedia([]);return}
  try{const v=await api('events/media?eventId='+encodeURIComponent(id));setEventMedia(v.media||[])}
  catch(e){setMessage(e instanceof Error?e.message:'Media unavailable')}
 }
 async function saveBank(){await run(async()=>{await api('organiser/payment-account','POST',{bankName,accountName,accountNumber});setMessage('Bank instructions saved. They are displayed on your published events.');await fetchAll()})}
 async function book(e:Event){await run(async()=>{
  if(!receipt&&e.price_ngn>0)throw Error('Upload payment receipt before submitting a paid order');
  const o=await api('orders','POST',{eventId:e.id,quantity:Number(quantity),paymentReference:paymentRef});
  if(receipt){const form=new FormData();form.set('orderId',o.order.id);form.set('receipt',receipt);await api('orders/receipt','POST',form);}
  setSelectedEvent('');setPaymentRef('');setReceipt(null);setMessage('Order received. Organiser will verify funds and receipt before ticket issuance.');
  await fetchAll();
 })}
 async function upload(orderId:string){await run(async()=>{
  const file=receiptUploads[orderId];if(!file)throw Error('Select a receipt first');
  const form=new FormData();form.set('orderId',orderId);form.set('receipt',file);
  await api('orders/receipt','POST',form);setMessage('Receipt delivered for organiser review.');await fetchAll();
 })}
 async function review(id:string,decision:'approved'|'rejected'){await run(async()=>{
  await api('review','POST',{orderId:id,decision});setMessage('Payment review saved');
  const r=await api('orders?eventId='+encodeURIComponent(eventId));setOrders(r.orders||[]);
 })}
 async function inviteGate(){await run(async()=>{
  if(!eventId)throw Error('Select an event first');
  const r=await api('gates','POST',{eventId,email:staffEmail,gateLabel});setMessage(r.message);setLatestInvite(r.invitationLink||'');setStaffEmail('');
  const g=await api('gates');setGates(g.gates||[]);setInvites(g.invitations||[]);
 })}
 async function addExistingOperator(){await run(async()=>{
  if(!eventId)throw Error('Select an event');
  const r=await api('gates','POST',{eventId,email:staffEmail,gateLabel,mode:'add'});
  setLatestInvite('');setStaffEmail('');setMessage(r.message);
  const g=await api('gates');setGates(g.gates||[]);setInvites(g.invitations||[]);
 })}
 async function revokeGate(i:Invite){await run(async()=>{
  await api('gates','DELETE',{eventId:i.event_id,email:i.invitee_email});setMessage('Gate invitation and access revoked');
  const g=await api('gates');setGates(g.gates||[]);setInvites(g.invitations||[]);
 })}
 async function adminAction(action:string,id?:string){await run(async()=>{
  await api('platform/organisers','POST',{action,userId:id,email:newOrganiser});setMessage('Organiser action completed');setNewOrganiser('');
  const a=await api('platform/organisers');setOrganisers(a.organisers||[]);
 })}
 function chooseOrganiser(id:string){
  setSelectedOrganiser(id);const org=organisers.find(x=>x.id===id);
  setEditName(org?.full_name||'');setEditBank(org?.bank_name||'');
  setEditAccount(org?.account_name||'');setEditNumber(org?.account_number||'');
 }
 async function configureOrganiser(){await run(async()=>{
  if(!selectedOrganiser)throw Error('Select an organiser');
  await api('platform/organisers','POST',{action:'configure',userId:selectedOrganiser,fullName:editName,bankName:editBank,accountName:editAccount,accountNumber:editNumber});
  const res=await api('platform/organisers');setOrganisers(res.organisers||[]);setMessage('Organiser profile updated');
 })}
 async function scan(value=scanCode){await run(async()=>{
  if(!eventId||!value.trim())throw Error('Select your event and scan a QR');
  const r=await api('scan','POST',{eventId,code:value.trim()});setScanOutcome(r.outcome);setMessage(r.message);setScanCode('');
  const a=await api('gates/activity?eventId='+encodeURIComponent(eventId));setScans(a.scans||[]);
 })}
 async function startScan(){if(!eventId){setMessage('Choose an assigned event first');return}
  try{const {BrowserQRCodeReader}=await import('@zxing/browser');setScanning(true);
    await new Promise(r=>setTimeout(r,100));const preview=document.getElementById('gate-video') as HTMLVideoElement|null;
    if(!preview)throw Error('Camera preview unavailable');const reader=new BrowserQRCodeReader();
    const controller=await reader.decodeFromVideoDevice(undefined,preview,(result,_,control)=>{
      if(result){control.stop();scanControls.current=null;setScanning(false);void scan(result.getText())}
    });scanControls.current=controller;
  }catch{setScanning(false);setMessage('Camera unavailable. Allow camera in browser settings or use a USB/Bluetooth QR scanner.')}
 }
 async function signout(){await api('auth/logout','POST');window.location.assign('/login/'+role)}
 const input=(label:string,value:string,onChange:(v:string)=>void,type='text')=><label className="rw-field">{label}<input value={value} onChange={e=>onChange(e.target.value)} type={type}/></label>;
 const categories=['All',...new Set(events.filter(e=>e.status==='published').map(e=>e.category||'Other'))];
 const visibleEvents=events.filter(e=>e.status==='published'&&e.verification_status!=='pending')
  .filter(e=>filterCategory==='All'||(e.category||'Other')===filterCategory)
  .filter(e=>[e.title,e.venue,e.organiser||'',e.description||''].join(' ').toLowerCase().includes(search.toLowerCase()))
  .sort((a,b)=>sortBy==='price'?a.price_ngn-b.price_ngn:sortBy==='latest'?new Date(b.starts_at).getTime()-new Date(a.starts_at).getTime():new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());
 const btn=(text:string,callback:()=>void,secondary=false)=><button className={secondary?'ghost':'primary'} disabled={busy} onClick={callback}>{text}</button>;
 if(!valid)return <main className="rw-shell"><h1>Unknown interface</h1><a href="/login/user">User login</a></main>;
 if(loading)return <main className="rw-shell"><p>Loading your EventPass account…</p></main>;
 if(!me)return <main className="rw-shell"><h1>{title}</h1><p>Sign in to continue.</p><a className="rw-primary-link" href={'/login/'+role}>Sign in to {title}</a></main>;
 if(role==='organiser'&&me.role==='user'&&me.requested_role==='organiser')return <main className="rw-shell"><h1>Organiser approval pending</h1><p>Your Google or email account is registered. The Platform Administrator must approve your organiser request before your management interface becomes active.</p><p>{me.email}</p><a className="google-auth-button" href="/api/auth/google?portal=organiser&intent=link"><span className="google-g" aria-hidden="true">G</span> Link Google account</a><button onClick={()=>{void signout()}}>Sign out</button></main>;
 if(!allowed)return <main className="rw-shell"><h1>{title} access inactive</h1><p>Your account does not have permission to access this interface.</p><p>Organisers require administrator approval. Gate operators require an invitation from an organiser and a Google-verified email.</p><a href="/login/user">Open User interface</a></main>;
 return <main className="rw-shell"><div className="rw-top"><div><a href="/" className="rw-brand">◈ NEXX <span>EVENTPASS</span></a><div className="rw-label">{title}</div></div><div className="rw-tools"><span>{me.full_name}</span><a className="rw-google-link" href={'/api/auth/google?portal='+encodeURIComponent(role==='platform-admin'?'platform_admin':role)+'&intent=link'}>Link Google account</a>{btn('Sign out',()=>{void signout()},true)}</div></div>
 {message&&<div className="rw-message" role="status">{message}<button onClick={()=>setMessage('')}>×</button></div>}
 {role==='platform-admin'&&<div className="rw-layout">
  <section className="rw-panel"><h2>Platform overview</h2><div className="rw-stats">{Object.entries(stats).map(([k,v])=><div className="rw-stat" key={k}><b>{Number(v).toLocaleString()}</b><small>{k}</small></div>)}</div>
  <h3>Create organiser from verified User</h3><p>Only a Google-verified existing account can be promoted. No default password is created.</p>
  {input('Verified User email',newOrganiser,setNewOrganiser,'email')}{btn('Create organiser',()=>{void adminAction('create')})}</section>
  <section className="rw-panel"><h2>Organiser directory and access control</h2>
   <p>Review all organiser applications and existing profiles. Revoke access without deleting tickets or historical events.</p>
   {organisers.map(o=><div className="rw-list-item" key={o.id}>
    <div><b>{o.full_name}</b><p>{o.email}</p><small>{o.role==='user'&&o.requested_role==='organiser'?'PENDING APPROVAL':o.account_status.toUpperCase()} · {o.event_count} events · {o.tickets_issued} tickets · {o.gate_operators} operators</small></div>
    <div className="rw-actions">
    {btn('Profile',()=>chooseOrganiser(o.id),true)}
    {o.role==='user'&&o.requested_role==='organiser'&&<>{btn('Approve',()=>{void adminAction('approve',o.id)})}{btn('Reject',()=>{void adminAction('reject',o.id)},true)}</>}
    {o.role==='organiser'&&o.account_status==='active'&&btn('Revoke access',()=>{void adminAction('revoke',o.id)},true)}
    {o.role==='organiser'&&o.account_status==='suspended'&&btn('Restore access',()=>{void adminAction('restore',o.id)})}
    </div></div>)}
   {!organisers.length&&<p>No organiser applicants or approved accounts yet.</p>}
   {selectedOrganiser&&organisers.filter(o=>o.id===selectedOrganiser).map(o=><div className="rw-profile" key={o.id}>
    <h3>Organiser profile: {o.full_name}</h3>
    <p>{o.email} · {o.role} · {o.account_status}</p>
    <p>Joined: {nice(o.created_at)} {o.approved_at?' · Approved: '+nice(o.approved_at):''}</p>
    <div className="rw-stats">
     <div className="rw-stat"><b>{o.event_count}</b><small>Events</small></div>
     <div className="rw-stat"><b>{o.pending_orders}</b><small>Pending payments</small></div>
     <div className="rw-stat"><b>{o.tickets_issued}</b><small>Tickets issued</small></div>
     <div className="rw-stat"><b>{o.gate_operators}</b><small>Gate operators</small></div>
    </div>
    {o.role==='organiser'?<>
      <h3>Configure organiser profile</h3>
      {input('Display name',editName,setEditName)}
      {input('Bank name',editBank,setEditBank)}
      {input('Bank account holder',editAccount,setEditAccount)}
      {input('Bank account number',editNumber,setEditNumber)}
      <p>Changes to bank instructions are audited. Verify new bank details independently before saving.</p>
      {btn('Save organiser configuration',()=>{void configureOrganiser()})}
    </>:<p>This applicant is not approved. Approve before configuring the organiser profile.</p>}
   </div>)}
  </section>  <section className="rw-panel rw-wide"><div className="eyebrow">EVENT AUTHENTICITY</div><h2>Review organiser listings and media</h2>
   <p>Verify the identity, location, date, marketing materials and ticket promises before publishing an event to the public marketplace.</p>
   {moderationEvents.map(ev=><div className="rw-review-card" key={ev.id}>
     <div><strong>{ev.title}</strong><p>{ev.venue} · {nice(ev.starts_at)}</p><small>Submitted by {ev.organiser_name} ({ev.organiser_email})</small><p>Listing: {ev.verification_status} · {ev.pending_media} unreviewed assets</p></div>
     <div className="rw-actions">{ev.verification_status!=='verified'&&<>{btn('Verify & publish',()=>{void moderateEvent(ev.id,'verify')})}{btn('Reject listing',()=>{void moderateEvent(ev.id,'reject')},true)}</>}</div>
     <div className="rw-gallery">{moderationMedia.filter(m=>m.event_id===ev.id).map(m=><div className="rw-media-card" key={m.id}>
       {m.media_type==='video'?<video src={m.url} playsInline controls preload="metadata"/>:<img src={m.url} alt={m.file_name}/>}
       <small>{m.file_name}</small><div className="rw-actions">{btn('Approve',()=>{void moderateEvent(ev.id,'approve_media',m.id)})}{btn('Reject',()=>{void moderateEvent(ev.id,'reject_media',m.id)},true)}</div>
     </div>)}</div>
   </div>)}
   {!moderationEvents.length&&<p>No pending event or media submissions.</p>}
  </section></div>}
 {role==='organiser'&&<div className="rw-layout">
  <section className="rw-panel"><h2>Bank transfer instructions</h2><p>Users see these account details on your published events. Only approve a ticket after confirming funds in your own bank records.</p>
    {input('Bank name',bankName,setBankName)}{input('Account name',accountName,setAccountName)}{input('Account number',accountNumber,setAccountNumber)}
    {btn('Save bank details',()=>{void saveBank()})}
  </section>
  <section className="rw-panel"><div className="eyebrow">EVENT STUDIO</div><h2>Create and design an event</h2><p>Create as many events as you need. Your listing is reviewed before it appears publicly.</p>
  {input('Event name',eventTitle,setEventTitle)}{input('Venue',venue,setVenue)}
  <label className="rw-field">Event description<textarea rows={4} maxLength={2500} value={eventDescription} onChange={e=>setEventDescription(e.target.value)} placeholder="Describe the experience, performers, attractions and ticket benefits"/></label>
  <label className="rw-field">Event category<select value={eventCategory} onChange={e=>setEventCategory(e.target.value)}>{['Music','Nightlife','Festival','Business','Food','Sports','Arts','Education','Community','Other'].map(c=><option key={c}>{c}</option>)}</select></label>
  {input('Date and time',startsAt,setStartsAt,'datetime-local')}{input('Price (NGN)',ticketPrice,setTicketPrice,'number')}{input('Capacity',capacity,setCapacity,'number')}{input('Private encrypted QR keyword (8+ characters)',keyword,setKeyword,'password')}
  <h3>Ticket design collection</h3>
  <div className="rw-theme-grid">{ticketThemes.map(t=><button key={t.id} type="button" className={'rw-theme-option '+(ticketTheme===t.id?'selected':'')} onClick={()=>setTicketTheme(t.id)} style={{background:t.gradient}}>
  <span>{t.label}</span><strong>{t.name}</strong><small>{ticketTheme===t.id?'✓ Selected':'Preview theme'}</small></button>)}</div>
  {btn('Create event for verification',()=>{void createEvent()})}
  </section>
  <section className="rw-panel rw-wide"><h2>Events and payment approvals</h2><label className="rw-field">Choose an event<select value={eventId} onChange={e=>{const id=e.target.value;setEventId(id);const selected=events.find(ev=>ev.id===id);if(selected){setEventDescription(selected.description||'');setEventCategory(selected.category||'Other');setTicketTheme(selected.ticket_theme||'aurora')}setLatestInvite('')}}><option value="">Select event</option>
  {events.filter(e=>e.organiser_id===me.id).map(e=><option value={e.id} key={e.id}>{e.title}</option>)}</select></label>
  {orders.map(o=><div className="rw-list-item" key={o.id}><div><b>{o.buyer_name||o.buyer_email||'User'}</b><p>{o.quantity} tickets · {money(o.amount_ngn)} · {o.status}</p><small>Bank reference: {o.payment_reference}</small><p>{o.receipt_uploaded_at?<a href={'/api/orders/receipt?orderId='+o.id} target="_blank" rel="noreferrer">View submitted receipt</a>:'Receipt not submitted'}</p></div><div className="rw-actions">
  {o.status==='pending'&&<>{btn('Approve',()=>{void review(o.id,'approved')})}{btn('Reject',()=>{void review(o.id,'rejected')},true)}</>}</div></div>)}
  {!eventId&&<p>Select an event to review payments and assign gate staff.</p>}</section>
  {eventId&&<section className="rw-panel rw-wide"><div className="eyebrow">CREATIVE MANAGER</div><h2>Event media & ticket designs</h2>
    <p>Upload real event posters, image galleries, short videos, or your own ticket artwork. Media appears to Users only after platform review. Image limit 2 MB; video clips up to 8 MB.</p>
    <div className="rw-media-inputs">
      <label className="rw-file-label">Upload posters & photos<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{void uploadMedia(e.target.files?.[0]||null);e.currentTarget.value=''}}/></label>
      <label className="rw-file-label">Upload short video<input type="file" accept="video/mp4,video/webm" onChange={e=>{void uploadMedia(e.target.files?.[0]||null);e.currentTarget.value=''}}/></label>
      <label className="rw-file-label">Import custom ticket design<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{void uploadMedia(e.target.files?.[0]||null,'ticket_art');e.currentTarget.value=''}}/></label>
    </div>
    <div className="rw-gallery">{eventMedia.map(m=><div className="rw-media-card" key={m.id}>
      {m.media_type==='video'?<video controls playsInline preload="metadata" src={m.url}/>:<img loading="lazy" src={m.url} alt={m.file_name}/>}
      <small>{m.file_name} · {m.approved?'Approved':'Awaiting review'}</small>
      {btn('Remove',()=>{void deleteMedia(m.id)},true)}
    </div>)}</div>
    <h3>Ticket theme</h3><div className="rw-theme-grid">{ticketThemes.map(t=><button type="button" key={t.id} className={'rw-theme-option '+(ticketTheme===t.id?'selected':'')} onClick={()=>setTicketTheme(t.id)} style={{background:t.gradient}}><strong>{t.name}</strong><small>{t.label}</small></button>)}</div>
    <label className="rw-field">Event category<select value={eventCategory} onChange={e=>setEventCategory(e.target.value)}>{['Music','Nightlife','Festival','Business','Food','Sports','Arts','Education','Community','Other'].map(c=><option key={c}>{c}</option>)}</select></label>
    <label className="rw-field">Public event description<textarea rows={3} maxLength={2500} value={eventDescription} onChange={e=>setEventDescription(e.target.value)}/></label>
    {btn('Save design for review',()=>{void saveEventDesign()})}
  </section>}
  {eventId&&<section className="rw-panel rw-wide"><h2>Gate operators</h2><p>Invite anyone by email, including people without EventPass accounts. Copy and share the private link; they register or sign in and accept it. Links expire in 72 hours and grant access only to this event.</p>
    {input('Operator email',staffEmail,setStaffEmail,'email')}{input('Gate label',gateLabel,setGateLabel)}{btn('Create private invitation link',()=>{void inviteGate()})}{btn('Add existing verified operator',()=>{void addExistingOperator()},true)}{latestInvite&&<div className="rw-invite"><p>Private invitation link (visible only now; share it with the invited person):</p><input readOnly aria-label="New gate invitation URL" value={latestInvite} onFocus={e=>e.currentTarget.select()}/>{btn('Copy invitation link',()=>{void navigator.clipboard.writeText(latestInvite).then(()=>setMessage('Invitation link copied')).catch(()=>setMessage('Select and copy the link manually'))},true)}<p>Do not publish this link publicly. Creating a new invitation invalidates the old one.</p></div>}
    {invites.filter(i=>i.event_id===eventId).map(i=><div className="rw-list-item" key={i.id}><div><b>{i.invitee_email}</b><p>{i.gate_label} · {i.status}</p></div>{i.status!=='revoked'&&btn('Revoke',()=>{void revokeGate(i)},true)}</div>)}</section>}
 </div>}
 {role==='user'&&<div className="rw-layout">
  <section className="rw-panel rw-wide"><h2>Explore published events</h2>{events.filter(e=>e.status==='published').map(e=><div key={e.id} className="rw-event"><div><h3>{e.title}</h3><p>{e.venue} · {nice(e.starts_at)}</p><b>{money(e.price_ngn)}</b></div>{btn(selectedEvent===e.id?'Close':'Get ticket',()=>setSelectedEvent(selectedEvent===e.id?'':e.id),true)}
    {selectedEvent===e.id&&<div className="rw-booking"><h4>Organiser bank transfer</h4>
    {e.bank_name?<><p>{e.bank_name} — {e.bank_account_name}</p><strong>{e.bank_account_number}</strong></>:<p>Organiser has not published payment instructions. Contact organiser before transferring.</p>}
    {input('Number of tickets',quantity,setQuantity,'number')}{input('Payment reference',paymentRef,setPaymentRef)}
    <label className="rw-field">Payment receipt (PNG, JPG, WebP, PDF, max 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={v=>setReceipt(v.target.files?.[0]||null)}/></label>
    <p>Payment verification is manual. QR tickets are not issued until approved.</p>{btn('Submit order & receipt',()=>{void book(e)})}</div>}</div>)}
  </section><section className="rw-panel"><h2>My orders</h2>{orders.map(o=><div className="rw-list-item" key={o.id}><div><b>{o.event_title}</b><p>{o.status} · {money(o.amount_ngn)}</p><small>{o.payment_reference}</small>{!o.receipt_uploaded_at&&o.status==='pending'&&<label className="rw-field">Upload missing receipt<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e=>setReceiptUploads({...receiptUploads,[o.id]:e.target.files?.[0]||null})}/>{btn('Send receipt',()=>{void upload(o.id)})}</label>}</div></div>)}</section>
  <section className="rw-panel"><h2>My QR wallet</h2>{tickets.map(t=><div className="rw-ticket" key={t.id}><h3>{t.title}</h3><p>{t.venue} · {nice(t.starts_at)}</p>{t.qr&&<div className="rw-qr"><QRCodeSVG value={t.qr} size={182} level="H" includeMargin/></div>}<b>{t.redeemed_at?'ALREADY CHECKED IN':t.status.toUpperCase()}</b></div>)}{!tickets.length&&<p>No approved tickets yet.</p>}</section></div>}
 {role==='gate'&&<div className="rw-layout"><section className="rw-panel"><h2>Your assigned gates</h2><label className="rw-field">Choose event<select value={eventId} onChange={e=>{setEventId(e.target.value);setScanOutcome('')}}><option value="">Choose assigned event</option>{gates.map(g=><option value={g.event_id} key={g.event_id}>{g.title} · {g.gate_label}</option>)}</select></label>
 <p>Only organiser-assigned events are accessible to your scanner.</p></section><section className="rw-panel"><h2>Scan entry QR</h2>
 {btn('Start camera',()=>{void startScan()})}{scanning&&<><div className="rw-camera"><video id="gate-video" autoPlay muted playsInline/></div>{btn('Stop camera',()=>{scanControls.current?.stop();setScanning(false)},true)}</>}
 {input('USB/Bluetooth scanner token',scanCode,setScanCode)}{btn('Verify entry',()=>{void scan()})}
 {!!scanOutcome&&<div className={'rw-result '+scanOutcome}><b>{scanOutcome==='approved'?'✓ ADMIT ONE':scanOutcome==='duplicate'?'ALREADY USED':'ENTRY DENIED'}</b><p>{scanOutcome.toUpperCase()}</p></div>}</section>
 <section className="rw-panel rw-wide"><h2>Gate activity log</h2>{scans.map(s=><div className="rw-list-item" key={s.id}><div><b>{s.outcome}</b><p>{s.operator||'Gate staff'} · {s.gate_label}</p><small>{nice(s.scanned_at)}</small></div></div>)}{!scans.length&&<p>There are no scans for this event yet.</p>}</section></div>}
 </main>;
}
