'use client';
import React,{useEffect,useRef,useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {packZip} from '@/lib/zip-export';
type Event={id:string;title:string;organiser_id:string;visibility?:string;permissions?:string[];expires_at?:string|null};
type Batch={id:string;label:string;category:string;quantity:number;valid_count:number;active_count:number;admitted_count:number;created_at:string};
type Ticket={id:string;serial_number:number;batch_id:string;status:string;active:boolean;distribution:string;redeemed_at:string|null;replaced_by:string|null;qr:string|null;admission_code?:string|null;sale_amount_ngn:number|null};
type Activity={id:string;action:string;created_at:string;actor_name:string;ticket_id:string|null;batch_id:string|null;details:unknown};
type Team={id:string;user_id:string;full_name:string;email:string;permissions:string[];revoked_at:string|null};
async function api(route:string,method='GET',data?:unknown){
 const r=await fetch('/api/offline/'+route,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
 const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v;
}
async function renderTicket(id:string,title:string,serial:number,format:'png'|'jpeg',admissionCode?:string|null):Promise<Blob>{
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
  ctx.font='24px sans-serif';ctx.fillText(title,40,105,560);
  ctx.drawImage(image,90,145,460,460);
  ctx.font='bold 20px sans-serif';ctx.fillText('Ticket #'+serial,40,640);
  ctx.font='bold 25px monospace';ctx.fillText(admissionCode?'BACKUP CODE: '+admissionCode.replace(/(.{4})(.{4})(.{4})/,'$1-$2-$3'):'Ticket ID: '+id,40,672);
  ctx.font='12px monospace';ctx.fillText('Ticket ID: '+id,40,700);
  ctx.font='14px sans-serif';ctx.fillText('Scan QR or enter backup code in the official EventPass gate',40,748);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Ticket export failed')),'image/'+format,0.95));
 }finally{URL.revokeObjectURL(url)}
}
function saveBlob(blob:Blob,name:string){
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.download=name;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export default function OfflineTicketManager({events,organiserId}:{events:Event[];organiserId?:string}){
 const [assignments,setAssignments]=useState<Event[]>([]);
 const mine=organiserId?events.filter(e=>e.organiser_id===organiserId):assignments;
 const [eventId,setEventId]=useState(''),[tab,setTab]=useState('batches'),[batches,setBatches]=useState<Batch[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[history,setHistory]=useState<Activity[]>([]),[team,setTeam]=useState<Team[]>([]);
 const [qty,setQty]=useState('10'),[label,setLabel]=useState(''),[category,setCategory]=useState('General'),[active,setActive]=useState(false);
 const [batchFilter,setBatchFilter]=useState(''),[search,setSearch]=useState(''),[appliedSearch,setAppliedSearch]=useState('');
 const [selected,setSelected]=useState<string[]>([]),[distribution,setDistribution]=useState('unassigned'),[amount,setAmount]=useState(''),[recipient,setRecipient]=useState(''),[note,setNote]=useState('');
 const [staffEmail,setStaffEmail]=useState(''),[permissions,setPermissions]=useState<string[]>(['view','export','distribute']),[staffScope,setStaffScope]=useState('selected'),[staffExpiry,setStaffExpiry]=useState(''),[includeFuture,setIncludeFuture]=useState(false);
 const [allocations,setAllocations]=useState<{id:string;name:string;capacity:number;price_ngn:number}[]>([]);
 const [generalCapacity,setGeneralCapacity]=useState<number|null>(null);
 const [editingPrice,setEditingPrice]=useState(''),[nextPrice,setNextPrice]=useState('');
 async function updateCategoryPrice(categoryId:string){
  await run(async()=>{
   const response=await fetch('/api/events/ticket-categories',{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({eventId,categoryId,priceNgn:nextPrice.trim()?Number(nextPrice):null})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Could not update category price');
   setEditingPrice('');setMessage('Category price updated for future reservations');
  });
 }
 const [allocationId,setAllocationId]=useState(''),[allocationName,setAllocationName]=useState(''),[allocationSize,setAllocationSize]=useState(''),[allocationPrice,setAllocationPrice]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [key,setKey]=useState(()=>crypto.randomUUID());
 const assigned=mine.find(e=>e.id===eventId);
 const visibleTickets=tickets;
 const currentEvent=useRef(eventId);
 currentEvent.current=eventId;
 const can=(permission:string)=>Boolean(organiserId||assigned?.permissions?.includes(permission));
 useEffect(()=>{
  if(organiserId)return;
  let current=true;
  void api('assignments').then(r=>{if(current)setAssignments(r.events||[])}).catch(e=>{if(current)setMessage(String(e))});
  return ()=>{current=false};
 },[organiserId]);
 async function refresh(id=eventId,batch=batchFilter,query=appliedSearch){if(!id)return;
  const suffix='?eventId='+encodeURIComponent(id);
  const [b,t,h,s,c]=await Promise.all([
   can('view')?api('batches'+suffix):{batches:[]},
   can('view')?api('tickets'+suffix+'&'+new URLSearchParams({batchId:batch,search:query})):{tickets:[]},
   can('reports')?api('activity'+suffix):{history:[]},
   organiserId?api('staff'+suffix):{team:[]},
   can('view')||can('generate')?fetch('/api/events/ticket-categories'+suffix,{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw Error('Ticket categories are unavailable');
    return response.json();
   }):{categories:[],generalCapacity:null}
  ]);
  if(currentEvent.current!==id)return;
  setAllocations(c.categories);setGeneralCapacity(c.generalCapacity);
  if(c.generalCapacity===0)setAllocationId(current=>current||c.categories[0]?.id||'');
  setBatches(b.batches||[]);setTickets(t.tickets||[]);setHistory(h.history||[]);setTeam(s.team||[]);
 }
 useEffect(()=>{if(!eventId&&mine.length)setEventId(mine[0].id)},[eventId,mine]);
 useEffect(()=>{
  setAllocations([]);setGeneralCapacity(null);setAllocationId('');
  setSelected([]);setBatchFilter('');setSearch('');setAppliedSearch('');setBatches([]);setTickets([]);setHistory([]);setTeam([]);setKey(crypto.randomUUID());
  setTab(can('generate')||can('view')?'batches':'history');
  if(eventId)void refresh(eventId,'','').catch(e=>{if(currentEvent.current===eventId)setMessage(String(e))});
 },[eventId]);
 async function run(fn:()=>Promise<void>, updatedView?:{batch:string;query:string}){setBusy(true);setMessage('');try{await fn();await refresh(eventId,updatedView?.batch,updatedView?.query)}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 function applyInventoryFilter(batch:string,query:string){
  setSelected([]);setBatchFilter(batch);setAppliedSearch(query);
  void run(async()=>{}, {batch,query});
 }
 async function generate(){await run(async()=>{
  const n=Number(qty);if(!Number.isInteger(n)||n<1||n>500)throw Error('Choose 1 to 500 tickets');
  const r=await api('batches','POST',{eventId,quantity:n,label,category,ticketCategoryId:allocationId,active:active&&can('activate'),idempotencyKey:key});
  setKey(crypto.randomUUID());setMessage(r.message||'Tickets created');if(can('view'))setTab('inventory');
 })}
 async function addAllocation(){await run(async()=>{
  const response=await fetch('/api/events/ticket-categories',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({eventId,name:allocationName,capacity:Number(allocationSize),priceNgn:allocationPrice.trim()?Number(allocationPrice):null})});
  const body=await response.json();
  if(!response.ok)throw Error(body.error||'Could not allocate category');
  setAllocationName('');setAllocationSize('');setAllocationPrice('');setMessage('Ticket category added');
 })}
 async function bulk(action:string){
  const reason=action==='revoke'?window.prompt(`Revoke ${selected.length} selected ticket(s)? Enter a reason (minimum five characters).`):null;
  if(action==='revoke'&&!reason)return;
  await run(async()=>{
  if(!selected.length)throw Error('Select tickets');
  await api('tickets','PATCH',{eventId,ticketIds:selected,action,reason,distribution,amountNgn:distribution==='sold'&&amount!==''?Number(amount):null,recipientName:recipient,note});
  setSelected([]);setMessage('Tickets updated and audited');
 })}
 async function exportTickets(ids:string[],format:'png'|'jpeg'|'print'='png'){
  const printWindow=format==='print'?window.open('','_blank'):null;
  if(format==='print'&&!printWindow){setMessage('Allow pop-ups to open the print sheet.');return}
  let printReady=false;
  await run(async()=>{
   const chosen=tickets.filter(t=>ids.includes(t.id)&&t.qr&&t.status==='issued');
   if(!chosen.length||chosen.length!==ids.length)throw Error('Select available tickets with encrypted QR credentials');
   if(format==='print'&&chosen.length>50)throw Error('Choose up to 50 tickets per print sheet');
   await api('exports','POST',{eventId,ticketIds:ids,format:format==='png'&&chosen.length>1?'zip':format});
   const images: {name:string;blob:Blob}[]=[];
   const encoding=format==='jpeg'?'jpeg':'png';
   for(const t of chosen){
    const blob=await renderTicket(t.id,assigned?.title||'EventPass',t.serial_number,encoding,t.admission_code);
    images.push({name:'eventpass-'+t.id+'.'+encoding,blob});
   }
   if(printWindow){
    const doc=printWindow.document;
    doc.title='EventPass tickets';
    const style=doc.createElement('style');
    style.textContent='body{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8mm} img{width:100%;border:1px solid #ccc;break-inside:avoid} @page{margin:10mm}';
    doc.head.append(style);
    const urls=await Promise.all(images.map(async asset=>{
     const img=doc.createElement('img');
     const url=URL.createObjectURL(asset.blob);
     img.src=url;img.alt=asset.name;doc.body.append(img);
     await img.decode();
     return url;
    }));
    printWindow.addEventListener('afterprint',()=>urls.forEach(url=>URL.revokeObjectURL(url)),{once:true});
    printReady=true;
    printWindow.focus();
    printWindow.print();
   }else if(images.length===1){
    saveBlob(images[0].blob,images[0].name);
   }else{
    const files=await Promise.all(images.map(async asset=>({name:asset.name,data:new Uint8Array(await asset.blob.arrayBuffer())})));
    saveBlob(packZip(files),'eventpass-offline-batch-'+eventId.slice(0,8)+'.zip');
   }
   setMessage(format==='print'?'Print sheet opened. Choose Save as PDF to save a copy.':images.length+' ticket image(s) exported');
  });
  if(printWindow&&!printReady)printWindow.close();
 }
 async function replace(id:string){const reason=window.prompt('Enter replacement reason (minimum five characters)');if(!reason)return;
  await run(async()=>{await api('reissue','POST',{eventId,ticketId:id,reason});setMessage('Replacement issued with a new QR code')});
 }
 async function assignStaff(){await run(async()=>{
  await api('staff','POST',{eventId,email:staffEmail,permissions,scope:staffScope,eventIds:staffScope==='selected'?[eventId]:[],includeFuture,expiresAt:staffExpiry?new Date(staffExpiry).toISOString():null});
  setStaffEmail('');setMessage('Verified staff member assigned');
 })}
 const button=(text:string,fn:()=>void,disabled=false)=><button className="ghost" type="button" disabled={busy||disabled} onClick={fn}>{text}</button>;
 return <section className="rw-panel rw-wide" style={{display:'grid',gap:16}}>
  <div className="eyebrow">EXTERNAL EVENTS / OFFLINE TICKETING</div><h2>Offline Ticket Manager</h2>
  <p>Generate encrypted tickets for guests outside EventPass. No buyer account or payment checkout is required.</p>
  <label className="rw-field">Event<select value={eventId} disabled={busy} onChange={e=>setEventId(e.target.value)}><option value="">Choose event</option>{mine.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
  <nav className="rw-actions" aria-label="Offline tickets navigation">{[['batches','Batches',can('generate')||can('view')],['inventory','Inventory',can('view')],['staff','Ticket Staff',Boolean(organiserId)],['history','Audit History',can('reports')]].filter(([, , visible])=>visible).map(([id,name])=><button type="button" className={tab===id?'primary':'ghost'} disabled={busy} onClick={()=>setTab(String(id))} key={String(id)}>{name}</button>)}</nav>
  {message&&<p role="status">{message}</p>}
  {!assigned?<p>{organiserId?'Create an event before issuing offline tickets.':'You have no assigned events.'}</p>:<>
   {!organiserId&&<p>Permissions for this event: {assigned.permissions?.join(', ')}{assigned.expires_at&&' · Expires '+new Date(assigned.expires_at).toLocaleString()}</p>}
   {tab==='batches'&&<div className="rw-profile">
    {organiserId&&<form onSubmit={e=>{e.preventDefault();void addAllocation()}}>
     <h3>Ticket categories</h3>
     <p>General allocation: {generalCapacity??'Loading…'}. Named categories share their limits across online and external tickets.</p>
     {allocations.length>0&&<ul>{allocations.map(item=><li key={item.id}>{item.name} · {item.capacity} tickets · ₦{item.price_ngn.toLocaleString()}
      {editingPrice===item.id?<>
       <label className="rw-field">New price for {item.name}<input type="number" min={0} max={214748364} step={1} value={nextPrice} onChange={e=>setNextPrice(e.target.value)} placeholder="Use event price"/></label>
       {button('Save price',()=>void updateCategoryPrice(item.id))}
       {button('Cancel',()=>setEditingPrice(''))}
      </>:button('Edit price',()=>{setEditingPrice(item.id);setNextPrice(String(item.price_ngn))})}
     </li>)}</ul>}
     <label className="rw-field">New category name<input required maxLength={60} value={allocationName} onChange={e=>setAllocationName(e.target.value)}/></label>
     <label className="rw-field">Category capacity<input required type="number" min={1} value={allocationSize} onChange={e=>setAllocationSize(e.target.value)}/></label>
     <label className="rw-field">Category price (₦)<input type="number" min={0} step={1} max={214748364} value={allocationPrice} onChange={e=>setAllocationPrice(e.target.value)} placeholder="Use event price" /></label>
     <button type="submit" className="ghost" disabled={busy}>Allocate category</button>
    </form>}
    {can('generate')&&<><h3>Generate encrypted ticket batch</h3>
    <label className="rw-field">Quantity (1–500)<input type="number" min="1" max="500" value={qty} onChange={e=>setQty(e.target.value)}/></label>
    <label className="rw-field">Batch label<input value={label} onChange={e=>setLabel(e.target.value)}/></label>
    <label className="rw-field">Inventory category<select value={allocationId} onChange={e=>setAllocationId(e.target.value)}>
     {generalCapacity!==0&&<option value="">General</option>}{allocations.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
    </select></label>
    {!allocationId&&generalCapacity!==0&&<label className="rw-field">Admission label<input value={category} onChange={e=>setCategory(e.target.value)}/></label>}
    <label className="rw-field"><input type="checkbox" checked={active&&can('activate')} disabled={!can('activate')} onChange={e=>setActive(e.target.checked)}/> Generate & Activate (otherwise inactive)</label>
    <p>Every ticket inherits one event design and receives a different encrypted QR code. Recipient details are optional.</p>
    {button('Generate batch',()=>{void generate()})}</>}
    <h3>Existing batches</h3>{batches.map(b=><div className="rw-list-item" key={b.id}><div><b>{b.label||'Offline Batch'} · {b.category}</b><p>{b.quantity} created · {b.active_count} active · {b.admitted_count} admitted</p><small>{b.id}</small></div>{button('View tickets',()=>{setSearch('');applyInventoryFilter(b.id,'');setTab('inventory')})}</div>)}
   </div>}
   {tab==='inventory'&&can('view')&&<><h3>Individual ticket register</h3>
    <label className="rw-field">Batch<select value={batchFilter} disabled={busy} onChange={e=>applyInventoryFilter(e.target.value,appliedSearch)}>
     <option value="">All batches</option>{batches.map(b=><option key={b.id} value={b.id}>{b.label||b.id.slice(0,8)} · {b.category}</option>)}
    </select></label>
    <form className="rw-actions" onSubmit={e=>{e.preventDefault();applyInventoryFilter(batchFilter,search.trim())}}>
     <label className="rw-field">Find a ticket<input value={search} maxLength={80} onChange={e=>setSearch(e.target.value)} placeholder="Ticket ID or serial number"/></label>
     <button type="submit" className="ghost" disabled={busy}>Search inventory</button>
    </form>
    <p>{visibleTickets.length} {appliedSearch?'matching':'recent'} records shown (up to 500).</p>
    <label className="rw-field"><input type="checkbox" checked={visibleTickets.length>0&&selected.length===visibleTickets.length} onChange={e=>setSelected(e.target.checked?visibleTickets.map(t=>t.id):[])}/> Select all visible</label>
    {can('activate')&&<div className="rw-actions">{button('Activate selected',()=>{void bulk('activate')},!selected.length)}{button('Deactivate selected',()=>{void bulk('deactivate')},!selected.length)}</div>}
    {can('revoke')&&button('Revoke selected',()=>{void bulk('revoke')},!selected.length)}
    {can('distribute')&&<><label className="rw-field">Distribution label<select value={distribution} onChange={e=>setDistribution(e.target.value)}>{['unassigned','distributed','sold','complimentary'].filter(x=>x!=='sold'||can('sales')).map(x=><option value={x} key={x}>{x}</option>)}</select></label>
    {distribution==='sold'&&can('sales')&&<label className="rw-field">Optional manual amount per ticket (₦)<input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}
    <label className="rw-field">Recipient (optional)<input value={recipient} onChange={e=>setRecipient(e.target.value)}/></label>
    <label className="rw-field">Notes (optional)<input value={note} onChange={e=>setNote(e.target.value)}/></label>
    {button('Update selected distribution',()=>{void bulk('distribution')},!selected.length)}</>}
    {can('export')&&<div className="rw-actions">
     {button('Export PNG',()=>{void exportTickets(selected)},!selected.length)}
     {button('Export JPEG',()=>{void exportTickets(selected,'jpeg')},!selected.length)}
     {button('Print / Save PDF',()=>{void exportTickets(selected,'print')},!selected.length)}
    </div>}
    {visibleTickets.map(t=><article className="rw-list-item" key={t.id} style={{alignItems:'start'}}><div>
     <label><input type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,t.id]:prev.filter(id=>id!==t.id))}/> Ticket #{t.serial_number} · {t.id.slice(0,8)}</label>
     <p>{t.status} · {t.active?'Active':'Inactive'} · {t.distribution} · {t.redeemed_at?'Admitted':'Not admitted'}</p>
     {t.qr&&<div id={'offline-qr-'+t.id}><QRCodeSVG value={t.qr} size={184} level="M" includeMargin/></div>}
     {t.admission_code&&<p><strong>Backup entry code: {t.admission_code.replace(/(.{4})(.{4})(.{4})/,'$1-$2-$3')}</strong></p>}
     </div><div className="rw-actions" style={{flexDirection:'column'}}>{t.qr&&button('Download PNG',()=>{void exportTickets([t.id])})}{can('reissue')&&!t.redeemed_at&&!t.replaced_by&&button(t.status==='revoked'?'Issue replacement':'Revoke & Reissue',()=>{void replace(t.id)})}</div></article>)}
   </>}
   {tab==='history'&&can('reports')&&<><h3>Issuance and activity audit</h3>{history.map(h=><div className="rw-list-item" key={h.id}><div><b>{h.action.replaceAll('_',' ')}</b><p>{h.actor_name} · {new Date(h.created_at).toLocaleString()}</p><small>{h.ticket_id||h.batch_id||''} · {JSON.stringify(h.details)}</small></div></div>)}</>}
   {tab==='staff'&&organiserId&&<><h3>Authorised Ticket Staff</h3><p>Staff must first register using their matching, Google-verified EventPass email.</p>
    <label className="rw-field">Staff email<input type="email" value={staffEmail} onChange={e=>setStaffEmail(e.target.value)}/></label>
    <label className="rw-field">Scope<select value={staffScope} onChange={e=>setStaffScope(e.target.value)}><option value="selected">This event only</option><option value="all">All current events</option></select></label>
    {staffScope==='all'&&<label className="rw-field"><input type="checkbox" checked={includeFuture} onChange={e=>setIncludeFuture(e.target.checked)}/> Include future events</label>}
    <label className="rw-field">Expiry (optional)<input type="datetime-local" value={staffExpiry} onChange={e=>setStaffExpiry(e.target.value)}/></label>
    <div className="rw-actions">{['view','generate','activate','export','distribute','sales','reports','revoke','reissue'].map(p=><label key={p}><input type="checkbox" checked={permissions.includes(p)} onChange={e=>setPermissions(v=>e.target.checked?[...v,p]:v.filter(x=>x!==p))}/>{p}</label>)}</div>
    {button('Assign verified staff',()=>{void assignStaff()},!staffEmail||!permissions.length)}
    {team.map(t=><div className="rw-list-item" key={t.id}><div><b>{t.full_name}</b><p>{t.email} · {t.revoked_at?'Revoked':t.permissions.join(', ')}</p></div>{!t.revoked_at&&button('Revoke',()=>{void run(async()=>{await api('staff','DELETE',{eventId,userId:t.user_id})})})}</div>)}
   </>}
  </>}
 </section>;
}
