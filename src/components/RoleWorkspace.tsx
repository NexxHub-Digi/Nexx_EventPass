'use client';
import React,{useEffect,useRef,useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {useParams} from 'next/navigation';
type Member={id:string;email:string;full_name:string;role:string;account_status:string;requested_role:string|null};
type Event={id:string;organiser_id:string;title:string;venue:string;starts_at:string;price_ngn:number;capacity:number;status:string;bank_name?:string;bank_account_name?:string;bank_account_number?:string};
type Order={id:string;event_id:string;event_title:string;buyer_name?:string;buyer_email?:string;status:string;quantity:number;amount_ngn:number;payment_reference:string;receipt_uploaded_at?:string|null};
type Ticket={id:string;title:string;venue:string;starts_at:string;status:string;qr:string|null;redeemed_at?:string|null};
type Gate={event_id:string;title:string;gate_label:string;organiser_name?:string};
type Organiser={id:string;email:string;full_name:string;role:string;account_status:string;requested_role:string|null;event_count:number};
type Invite={id:string;event_id:string;invitee_email:string;gate_label:string;status:string};
type Scan={id:string;outcome:string;operator?:string;gate_label:string;scanned_at:string};
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
 const [organisers,setOrganisers]=useState<Organiser[]>([]),[stats,setStats]=useState<Record<string,number>>({});
 const [bankName,setBankName]=useState(''),[accountName,setAccountName]=useState(''),[accountNumber,setAccountNumber]=useState('');
 const [eventId,setEventId]=useState(''),[eventTitle,setEventTitle]=useState(''),[venue,setVenue]=useState(''),[startsAt,setStartsAt]=useState(''),[capacity,setCapacity]=useState('100'),[ticketPrice,setTicketPrice]=useState('5000'),[keyword,setKeyword]=useState('');
 const [quantity,setQuantity]=useState('1'),[paymentRef,setPaymentRef]=useState(''),[selectedEvent,setSelectedEvent]=useState(''),[receipt,setReceipt]=useState<File|null>(null),[receiptUploads,setReceiptUploads]=useState<Record<string,File|null>>({});
 const [staffEmail,setStaffEmail]=useState(''),[gateLabel,setGateLabel]=useState('Main gate'),[newOrganiser,setNewOrganiser]=useState('');
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
  }
 }
 useEffect(()=>{setLoading(true);fetchAll().catch(e=>setMessage((e as Error).message)).finally(()=>setLoading(false));return ()=>{scanControls.current?.stop()}},[role]);
 useEffect(()=>{if(!eventId){setOrders([]);setScans([]);return}
 if(role==='organiser')api('orders?eventId='+encodeURIComponent(eventId)).then(v=>setOrders(v.orders||[])).catch(e=>setMessage((e as Error).message));
 if(role==='gate')api('gates/activity?eventId='+encodeURIComponent(eventId)).then(v=>setScans(v.scans||[])).catch(e=>setMessage((e as Error).message));
 },[eventId,role]);
 async function run(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 async function createEvent(){await run(async()=>{
  const date=new Date(startsAt);if(!Number.isFinite(date.getTime()))throw Error('Choose an event date');
  await api('events','POST',{title:eventTitle,venue,startsAt:date.toISOString(),capacity:Number(capacity),priceNgn:Number(ticketPrice),qrKeyword:keyword});
  setEventTitle('');setKeyword('');await fetchAll();setMessage('Event published');
 })}
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
  const r=await api('gates','POST',{eventId,email:staffEmail,gateLabel});setMessage(r.message);setStaffEmail('');
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
 const btn=(text:string,callback:()=>void,secondary=false)=><button className={secondary?'ghost':'primary'} disabled={busy} onClick={callback}>{text}</button>;
 if(!valid)return <main className="rw-shell"><h1>Unknown interface</h1><a href="/login/user">User login</a></main>;
 if(loading)return <main className="rw-shell"><p>Loading your EventPass account…</p></main>;
 if(!me)return <main className="rw-shell"><h1>{title}</h1><p>Sign in to continue.</p><a className="rw-primary-link" href={'/login/'+role}>Sign in to {title}</a></main>;
 if(role==='organiser'&&me.role==='user'&&me.requested_role==='organiser')return <main className="rw-shell"><h1>Organiser approval pending</h1><p>Your Google or email account is registered. The Platform Administrator must approve your organiser request before your management interface becomes active.</p><p>{me.email}</p><button onClick={()=>{void signout()}}>Sign out</button></main>;
 if(!allowed)return <main className="rw-shell"><h1>{title} access inactive</h1><p>Your account does not have permission to access this interface.</p><p>Organisers require administrator approval. Gate operators require an invitation from an organiser and a Google-verified email.</p><a href="/login/user">Open User interface</a></main>;
 return <main className="rw-shell"><div className="rw-top"><div><a href="/" className="rw-brand">◈ NEXX <span>EVENTPASS</span></a><div className="rw-label">{title}</div></div><div className="rw-tools"><span>{me.full_name}</span>{btn('Sign out',()=>{void signout()},true)}</div></div>
 {message&&<div className="rw-message" role="status">{message}<button onClick={()=>setMessage('')}>×</button></div>}
 {role==='platform-admin'&&<div className="rw-layout">
  <section className="rw-panel"><h2>Platform overview</h2><div className="rw-stats">{Object.entries(stats).map(([k,v])=><div className="rw-stat" key={k}><b>{Number(v).toLocaleString()}</b><small>{k}</small></div>)}</div>
  <h3>Create organiser from verified User</h3><p>Only a Google-verified existing account can be promoted. No default password is created.</p>
  {input('Verified User email',newOrganiser,setNewOrganiser,'email')}{btn('Create organiser',()=>{void adminAction('create')})}</section>
  <section className="rw-panel"><h2>Organiser approval and access control</h2>{organisers.map(o=><div className="rw-list-item" key={o.id}><div><b>{o.full_name}</b><p>{o.email}</p><small>{o.account_status} · {o.role} · {o.event_count} events</small></div><div className="rw-actions">
  {o.requested_role==='organiser'&&o.role==='user'&&<>{btn('Approve',()=>{void adminAction('approve',o.id)})}{btn('Reject',()=>{void adminAction('reject',o.id)},true)}</>}
  {o.role==='organiser'&&o.account_status==='active'&&btn('Suspend',()=>{void adminAction('suspend',o.id)},true)}
  {o.role==='organiser'&&o.account_status==='suspended'&&btn('Restore',()=>{void adminAction('restore',o.id)})}
  </div></div>)}{!organisers.length&&<p>No organiser applications yet.</p>}</section></div>}
 {role==='organiser'&&<div className="rw-layout">
  <section className="rw-panel"><h2>Bank transfer instructions</h2><p>Users see these account details on your published events. Only approve a ticket after confirming funds in your own bank records.</p>
    {input('Bank name',bankName,setBankName)}{input('Account name',accountName,setAccountName)}{input('Account number',accountNumber,setAccountNumber)}
    {btn('Save bank details',()=>{void saveBank()})}
  </section>
  <section className="rw-panel"><h2>Create event</h2>{input('Event name',eventTitle,setEventTitle)}{input('Venue',venue,setVenue)}
  {input('Date and time',startsAt,setStartsAt,'datetime-local')}{input('Price (NGN)',ticketPrice,setTicketPrice,'number')}{input('Capacity',capacity,setCapacity,'number')}{input('Private encrypted QR keyword',keyword,setKeyword,'password')}
  {btn('Publish event',()=>{void createEvent()})}</section>
  <section className="rw-panel rw-wide"><h2>Events and payment approvals</h2><label className="rw-field">Choose an event<select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">Select event</option>
  {events.filter(e=>e.organiser_id===me.id).map(e=><option value={e.id} key={e.id}>{e.title}</option>)}</select></label>
  {orders.map(o=><div className="rw-list-item" key={o.id}><div><b>{o.buyer_name||o.buyer_email||'User'}</b><p>{o.quantity} tickets · {money(o.amount_ngn)} · {o.status}</p><small>Bank reference: {o.payment_reference}</small><p>{o.receipt_uploaded_at?<a href={'/api/orders/receipt?orderId='+o.id} target="_blank" rel="noreferrer">View submitted receipt</a>:'Receipt not submitted'}</p></div><div className="rw-actions">
  {o.status==='pending'&&<>{btn('Approve',()=>{void review(o.id,'approved')})}{btn('Reject',()=>{void review(o.id,'rejected')},true)}</>}</div></div>)}
  {!eventId&&<p>Select an event to review payments and assign gate staff.</p>}</section>
  {eventId&&<section className="rw-panel rw-wide"><h2>Gate operators</h2><p>Invitations are scoped to this event. The operator must verify the invited email with Google.</p>
    {input('Operator email',staffEmail,setStaffEmail,'email')}{input('Gate label',gateLabel,setGateLabel)}{btn('Send gate invitation',()=>{void inviteGate()})}
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
