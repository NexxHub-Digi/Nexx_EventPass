'use client';
import React,{useEffect,useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {packZip} from '@/lib/zip-export';
type Event={id:string;title:string;organiser_id:string;visibility?:string};
type Batch={id:string;label:string;category:string;quantity:number;valid_count:number;active_count:number;admitted_count:number;created_at:string};
type Ticket={id:string;serial_number:number;batch_id:string;status:string;active:boolean;distribution:string;redeemed_at:string|null;qr:string|null;sale_amount_ngn:number|null};
type Activity={id:string;action:string;created_at:string;actor_name:string;ticket_id:string|null;batch_id:string|null;details:unknown};
type Team={id:string;user_id:string;full_name:string;email:string;permissions:string[];revoked_at:string|null};
async function api(route:string,method='GET',data?:unknown){
 const r=await fetch('/api/offline/'+route,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
 const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v;
}
async function makePng(id:string):Promise<Uint8Array>{
 // Generate a clean QR PNG from the SVG already displayed in the ticket row.
 const el=document.getElementById('offline-qr-'+id)?.querySelector('svg');
 if(!el)throw Error('QR preview is not rendered');
 const data=new XMLSerializer().serializeToString(el);
 const blob=new Blob([data],{type:'image/svg+xml;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 try{
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=780;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Cannot create ticket image');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,640,780);
  ctx.fillStyle='#17213b';ctx.font='bold 28px sans-serif';ctx.fillText('NEXX EVENTPASS',40,65);
  ctx.font='20px sans-serif';ctx.fillText('OFFLINE ADMISSION TICKET',40,105);
  ctx.drawImage(image,90,145,460,460);
  ctx.font='18px monospace';ctx.fillText(id,40,670);
  ctx.font='14px sans-serif';ctx.fillText('Validate using the official EventPass gate scanner',40,720);
  const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG export failed')),'image/png'));
  return new Uint8Array(await png.arrayBuffer());
 }finally{URL.revokeObjectURL(url)}
}
function saveBlob(blob:Blob,name:string){
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.download=name;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export default function OfflineTicketManager({events,organiserId}:{events:Event[];organiserId:string}){
 const mine=events.filter(e=>e.organiser_id===organiserId);
 const [eventId,setEventId]=useState(''),[tab,setTab]=useState('batches'),[batches,setBatches]=useState<Batch[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[history,setHistory]=useState<Activity[]>([]),[team,setTeam]=useState<Team[]>([]);
 const [qty,setQty]=useState('10'),[label,setLabel]=useState(''),[category,setCategory]=useState('General'),[active,setActive]=useState(false);
 const [selected,setSelected]=useState<string[]>([]),[distribution,setDistribution]=useState('sold'),[amount,setAmount]=useState(''),[recipient,setRecipient]=useState(''),[note,setNote]=useState('');
 const [staffEmail,setStaffEmail]=useState(''),[permissions,setPermissions]=useState<string[]>(['view','export','distribute']),[staffScope,setStaffScope]=useState('selected'),[staffExpiry,setStaffExpiry]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [key,setKey]=useState(()=>crypto.randomUUID());
 const assigned=mine.find(e=>e.id===eventId);
 async function refresh(id=eventId){if(!id)return;
  const [b,t]=await Promise.all([api('batches?eventId='+encodeURIComponent(id)),api('tickets?eventId='+encodeURIComponent(id))]);
  setBatches(b.batches||[]);setTickets(t.tickets||[]);
  try{const h=await api('activity?eventId='+encodeURIComponent(id));setHistory(h.history||[])}catch{setHistory([])}
  try{const s=await api('staff?eventId='+encodeURIComponent(id));setTeam(s.team||[])}catch{setTeam([])}
 }
 useEffect(()=>{if(!eventId&&mine.length)setEventId(mine[0].id)},[mine.length,organiserId]);
 useEffect(()=>{setSelected([]);setBatches([]);setTickets([]);if(eventId)void refresh(eventId).catch(e=>setMessage(String(e)))},[eventId]);
 async function run(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn();await refresh()}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 async function generate(){await run(async()=>{
  const n=Number(qty);if(!Number.isInteger(n)||n<1||n>500)throw Error('Choose 1 to 500 tickets');
  const r=await api('batches','POST',{eventId,quantity:n,label,category,active,idempotencyKey:key});
  setKey(crypto.randomUUID());setMessage(r.message||'Tickets created');setTab('inventory');
 })}
 async function bulk(action:string){await run(async()=>{
  if(!selected.length)throw Error('Select tickets');
  await api('tickets','PATCH',{eventId,ticketIds:selected,action,distribution,amountNgn:distribution==='sold'&&amount!==''?Number(amount):null,recipientName:recipient,note});
  setSelected([]);setMessage('Tickets updated and audited');
 })}
 async function exportTickets(ids:string[]){
  await run(async()=>{
   const chosen=tickets.filter(t=>ids.includes(t.id)&&t.qr&&t.status==='issued');
   if(!chosen.length||chosen.length!==ids.length)throw Error('Select available tickets with encrypted QR credentials');
   // Re-check server-side ownership and log the export request before creating files.
   await api('exports','POST',{eventId,ticketIds:ids,format:chosen.length===1?'png':'zip'});
   const files=[] as {name:string;data:Uint8Array}[];
   for(const t of chosen)files.push({name:'eventpass-'+t.id+'.png',data:await makePng(t.id)});
   if(files.length===1)saveBlob(new Blob([Uint8Array.from(files[0].data)],{type:'image/png'}),files[0].name);
   else saveBlob(packZip(files),'eventpass-offline-batch-'+eventId.slice(0,8)+'.zip');
   setMessage(files.length+' ticket image(s) exported');
  });
 }
 async function replace(id:string){const reason=window.prompt('Enter replacement reason (minimum five characters)');if(!reason)return;
  await run(async()=>{await api('reissue','POST',{eventId,ticketId:id,reason});setMessage('Old QR revoked and replacement issued')});
 }
 async function assignStaff(){await run(async()=>{
  await api('staff','POST',{eventId,email:staffEmail,permissions,scope:staffScope,eventIds:staffScope==='selected'?[eventId]:[],includeFuture:false,expiresAt:staffExpiry?new Date(staffExpiry).toISOString():null});
  setStaffEmail('');setMessage('Verified staff member assigned');
 })}
 const button=(text:string,fn:()=>void,disabled=false)=><button className="ghost" type="button" disabled={busy||disabled} onClick={fn}>{text}</button>;
 return <section className="rw-panel rw-wide" style={{display:'grid',gap:16}}>
  <div className="eyebrow">EXTERNAL EVENTS / OFFLINE TICKETING</div><h2>Offline Ticket Manager</h2>
  <p>Generate encrypted tickets for guests outside EventPass. No buyer account or payment checkout is required.</p>
  <label className="rw-field">Event<select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">Choose event</option>{mine.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
  <nav className="rw-actions" aria-label="Offline tickets navigation">{[['batches','Batch Generator'],['inventory','Inventory'],['staff','Ticket Staff'],['history','Audit History']].map(([id,name])=><button type="button" className={tab===id?'primary':'ghost'} onClick={()=>setTab(id)} key={id}>{name}</button>)}</nav>
  {message&&<p role="status">{message}</p>}
  {!assigned?<p>Create an event before issuing offline tickets.</p>:<>
   {tab==='batches'&&<div className="rw-profile"><h3>Generate encrypted ticket batch</h3>
    <label className="rw-field">Quantity (1–500)<input type="number" min="1" max="500" value={qty} onChange={e=>setQty(e.target.value)}/></label>
    <label className="rw-field">Batch label<input value={label} onChange={e=>setLabel(e.target.value)}/></label>
    <label className="rw-field">Admission category<input value={category} onChange={e=>setCategory(e.target.value)}/></label>
    <label className="rw-field"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Generate & Activate (otherwise inactive)</label>
    <p>Every ticket inherits one event design and receives a different encrypted QR code. Recipient details are optional.</p>
    {button('Generate batch',()=>{void generate()})}
    <h3>Existing batches</h3>{batches.map(b=><div className="rw-list-item" key={b.id}><div><b>{b.label||'Offline Batch'} · {b.category}</b><p>{b.quantity} created · {b.active_count} active · {b.admitted_count} admitted</p><small>{b.id}</small></div>{button('View',()=>setTab('inventory'))}</div>)}
   </div>}
   {tab==='inventory'&&<><h3>Individual ticket register</h3><p>{tickets.length} records shown (latest 500). Select tickets to activate or update distribution without involving payments.</p>
    <label className="rw-field"><input type="checkbox" checked={tickets.length>0&&selected.length===tickets.length} onChange={e=>setSelected(e.target.checked?tickets.map(t=>t.id):[])}/> Select all visible</label>
    <div className="rw-actions">{button('Activate selected',()=>{void bulk('activate')},!selected.length)}{button('Deactivate selected',()=>{void bulk('deactivate')},!selected.length)}</div>
    <label className="rw-field">Distribution label<select value={distribution} onChange={e=>setDistribution(e.target.value)}>{['unassigned','distributed','sold','complimentary'].map(x=><option value={x} key={x}>{x}</option>)}</select></label>
    {distribution==='sold'&&<label className="rw-field">Optional manual amount per ticket (₦)<input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
    <label className="rw-field">Recipient (optional)<input value={recipient} onChange={e=>setRecipient(e.target.value)}/></label>
    <label className="rw-field">Notes (optional)<input value={note} onChange={e=>setNote(e.target.value)}/></label>
    {button('Update selected distribution',()=>{void bulk('distribution')},!selected.length)}
    {button('Export selected PNGs as ZIP',()=>{void exportTickets(selected)},!selected.length)}
    {tickets.map(t=><article className="rw-list-item" key={t.id} style={{alignItems:'start'}}><div>
     <label><input type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,t.id]:prev.filter(id=>id!==t.id))}/> Ticket #{t.serial_number} · {t.id.slice(0,8)}</label>
     <p>{t.status} · {t.active?'Active':'Inactive'} · {t.distribution} · {t.redeemed_at?'Admitted':'Not admitted'}</p>
     {t.qr&&<div id={'offline-qr-'+t.id}><QRCodeSVG value={t.qr} size={152} includeMargin/></div>}
     </div><div className="rw-actions" style={{flexDirection:'column'}}>{t.qr&&button('Download PNG',()=>{void exportTickets([t.id])})}{t.status==='issued'&&!t.redeemed_at&&button('Revoke & Reissue',()=>{void replace(t.id)})}</div></article>)}
   </>}
   {tab==='history'&&<><h3>Issuance and activity audit</h3>{history.map(h=><div className="rw-list-item" key={h.id}><div><b>{h.action.replaceAll('_',' ')}</b><p>{h.actor_name} · {new Date(h.created_at).toLocaleString()}</p><small>{h.ticket_id||h.batch_id||''} · {JSON.stringify(h.details)}</small></div></div>)}</>}
   {tab==='staff'&&<><h3>Authorised Ticket Staff</h3><p>Staff must first register using their matching, Google-verified EventPass email.</p>
    <label className="rw-field">Staff email<input type="email" value={staffEmail} onChange={e=>setStaffEmail(e.target.value)}/></label>
    <label className="rw-field">Scope<select value={staffScope} onChange={e=>setStaffScope(e.target.value)}><option value="selected">This event only</option><option value="all">All current events</option></select></label>
    <label className="rw-field">Expiry (optional)<input type="datetime-local" value={staffExpiry} onChange={e=>setStaffExpiry(e.target.value)}/></label>
    <div className="rw-actions">{['view','generate','activate','export','distribute','sales','reports','reissue'].map(p=><label key={p}><input type="checkbox" checked={permissions.includes(p)} onChange={e=>setPermissions(v=>e.target.checked?[...v,p]:v.filter(x=>x!==p))}/>{p}</label>)}</div>
    {button('Assign verified staff',()=>{void assignStaff()},!staffEmail||!permissions.length)}
    {team.map(t=><div className="rw-list-item" key={t.id}><div><b>{t.full_name}</b><p>{t.email} · {t.revoked_at?'Revoked':t.permissions.join(', ')}</p></div>{!t.revoked_at&&button('Revoke',()=>{void run(async()=>{await api('staff','DELETE',{eventId,userId:t.user_id})})})}</div>)}
   </>}
  </>}
 </section>;
}
