'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import EventPassLoading from '@/components/EventPassLoading';
import {QRCodeSVG} from 'qrcode.react';
type TicketItem={id:string;title:string;venue:string;status:string;redeemed_at?:string|null;qr?:string|null;entry_code?:string|null};
type OrderItem={payment_method?:'manual'|'onsite'|'free'|'paystack';id:string;event_title:string;status:string;quantity:number;amount_ngn:number;reservation_expires_at?:string|null;receipt_uploaded_at?:string|null;refund_status?:string|null};
type AccountItem={full_name:string;email:string};
type EventItem={onsite_payments_enabled?:boolean;id:string;title:string;category:string;venue:string;date:string;price:number;gradient:string;icon:string;bank_name?:string;bank_account_name?:string;bank_account_number?:string;cover_media_id?:string|null;video_media_id?:string|null};
const eventStyles=[{gradient:'linear-gradient(135deg,#7c2cff,#251043 65%,#0b6475)',icon:'♫'},{gradient:'linear-gradient(135deg,#0b8795,#1a1b52 55%,#9b2f8e)',icon:'✦'},{gradient:'linear-gradient(135deg,#dd4d85,#52278b 55%,#15345b)',icon:'◈'}];
const money=(n:number)=>'₦'+n.toLocaleString('en-NG');
export default function UserPortal(){
 const [liveEvents,setLiveEvents]=useState<EventItem[]>([]),[liveError,setLiveError]=useState(''),[loadingEvents,setLoadingEvents]=useState(true);
 useEffect(()=>{let active=true;fetch('/api/events',{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('Event listings are unavailable');return response.json()}).then(data=>{if(!active)return;setLiveEvents((data.events||[]).filter((e:{status:string;verification_status:string;visibility:string})=>e.status==='published'&&e.verification_status==='verified'&&e.visibility==='public').map((e:{onsite_payments_enabled?:boolean;id:string;title:string;category?:string;venue:string;starts_at:string;price_ngn:number;bank_name?:string;bank_account_name?:string;bank_account_number?:string;cover_media_id?:string|null;video_media_id?:string|null},i:number)=>({id:e.id,onsite_payments_enabled:e.onsite_payments_enabled,title:e.title,category:e.category||'Other',venue:e.venue,date:new Date(e.starts_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}),price:Number(e.price_ngn),bank_name:e.bank_name,bank_account_name:e.bank_account_name,bank_account_number:e.bank_account_number,cover_media_id:e.cover_media_id,video_media_id:e.video_media_id,gradient:eventStyles[i%eventStyles.length].gradient,icon:eventStyles[i%eventStyles.length].icon}))) }).catch(e=>{if(active)setLiveError(e.message)}).finally(()=>{if(active)setLoadingEvents(false)});return()=>{active=false}},[]);
 const [tickets,setTickets]=useState<TicketItem[]>([]),[orders,setOrders]=useState<OrderItem[]>([]),[account,setAccount]=useState<AccountItem|null>(null),[accountLoading,setAccountLoading]=useState(false),[accountError,setAccountError]=useState('');
 useEffect(()=>{let active=true;setAccountLoading(true);Promise.all([fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'}),fetch('/api/tickets',{credentials:'same-origin',cache:'no-store'}),fetch('/api/orders',{credentials:'same-origin',cache:'no-store'})]).then(async ([me,t,o])=>{if(!active)return;const identity=me.ok?await me.json():null;if(!active)return;setAccount(identity?.user||null);if(!identity?.user)return;if(!t.ok||!o.ok)throw Error('Ticket or order service unavailable');const [tt,oo]=await Promise.all([t.json(),o.json()]);if(active){setTickets(tt.tickets||[]);setOrders(oo.orders||[])}}).catch(e=>{if(active)setAccountError(e instanceof Error?e.message:'Unable to load account')}).finally(()=>{if(active)setAccountLoading(false)});return()=>{active=false}},[]);
 const [heroPlaying,setHeroPlaying]=useState(false);
 const [featuredIndex,setFeaturedIndex]=useState(0),[sortBy,setSortBy]=useState('name');
 const [tab,setTab]=useState('Discover'),[search,setSearch]=useState(''),[category,setCategory]=useState('All'),[saved,setSaved]=useState<string[]>([]),[ticketFilter,setTicketFilter]=useState('All');
 const filtered=useMemo(()=>liveEvents.filter(e=>(category==='All'||e.category===category)&&[e.title,e.venue,e.category].join(' ').toLowerCase().includes(search.toLowerCase())).sort((a,b)=>sortBy==='price'?a.price-b.price:a.title.localeCompare(b.title)),[category,search,liveEvents,sortBy]);
 useEffect(()=>{const target=new URLSearchParams(window.location.search).get('tab');if(target&&['Home','Explore','Discover','Tickets','Saved','Profile'].includes(target))setTab(target==='Home'||target==='Explore'?'Discover':target)},[]);
 const [selected,setSelected]=useState<EventItem|null>(null),[quantity,setQuantity]=useState(1),[reference,setReference]=useState(''),[receipt,setReceipt]=useState<File|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{
  if(!heroPlaying||liveEvents.length<2||tab!=='Discover'||selected)return;
  const timer=window.setInterval(()=>setFeaturedIndex(i=>(i+1)%Math.min(liveEvents.length,6)),8000);
  return()=>window.clearInterval(timer);
 },[heroPlaying,liveEvents.length,tab,selected]);
 const reservationKey=useRef('');
 const checkoutDialog=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!selected||!checkoutDialog.current)return;
  const dialog=checkoutDialog.current;
  const opener=document.activeElement;
  dialog.querySelector<HTMLElement>('button')?.focus();
  function handleKey(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();setSelected(null);return}
   if(event.key!=='Tab')return;
   const focusable=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]'));
   const first=focusable[0],last=focusable.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
  dialog.addEventListener('keydown',handleKey);
  return ()=>{dialog.removeEventListener('keydown',handleKey);if(opener instanceof HTMLElement&&opener.isConnected)opener.focus()};
 },[selected]);
 const [ticketCategoryId,setTicketCategoryId]=useState(''),[ticketCategories,setTicketCategories]=useState<{id:string;name:string;price_ngn:number}[]>([]);
 const [generalCapacity,setGeneralCapacity]=useState<number|null>(null),[categoryError,setCategoryError]=useState('');
 useEffect(()=>{
  if(!selected)return;
  const controller=new AbortController();
  fetch('/api/events/ticket-categories?eventId='+encodeURIComponent(selected.id),{signal:controller.signal,cache:'no-store'})
   .then(async res=>{if(!res.ok)throw Error('Ticket categories could not be loaded. Reopen the event to retry.');return res.json()})
   .then(data=>{if(controller.signal.aborted)return;setTicketCategories(data.categories);setGeneralCapacity(data.generalCapacity);if(data.generalCapacity===0)setTicketCategoryId(data.categories[0]?.id||'')})
   .catch(error=>{if(!controller.signal.aborted)setCategoryError(error.message)});
  return ()=>controller.abort();
 },[selected]);
 const refreshAccount=async()=>{const [t,o]=await Promise.all([fetch('/api/tickets',{cache:'no-store'}),fetch('/api/orders',{cache:'no-store'})]);if(!t.ok||!o.ok)throw Error('Unable to refresh reservations');setTickets((await t.json()).tickets||[]);setOrders((await o.json()).orders||[])};
 const [supportCases,setSupportCases]=useState<{payment_order_id:string;status:string;resolution:string}[]>([]);
 const [supportOrder,setSupportOrder]=useState(''),[supportDescription,setSupportDescription]=useState('');
 async function refreshSupport(){
  const response=await fetch('/api/support/cases?scope=payment',{cache:'no-store'});
  if(!response.ok)throw Error('Could not load payment support');
  setSupportCases((await response.json()).cases||[]);
 }
 useEffect(()=>{
  if(!account||tab!=='Tickets')return;
  const refresh=()=>{if(document.visibilityState==='visible')void Promise.all([refreshAccount(),refreshSupport()]).catch(()=>{})};
  refresh();
  const timer=window.setInterval(refresh,15000);
  return ()=>window.clearInterval(timer);
 },[account,tab]);
 async function requestPaymentSupport(orderId:string){
  setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/support/cases',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({orderId,description:supportDescription})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error);
   await refreshSupport();setSupportOrder('');setSupportDescription('');
   setNotice('Support request sent. Follow its status here.');
  }catch(error){setNotice(error instanceof Error?error.message:'Support request failed')}
  finally{setBusy(false)}
 }
 const sendReceipt=async(orderId:string,file:File)=>{const form=new FormData();form.set('orderId',orderId);form.set('receipt',file);const res=await fetch('/api/orders/receipt',{method:'POST',body:form});const data=await res.json();if(!res.ok)throw Error(data.error||'Receipt upload failed')};
 const [paymentDetails,setPaymentDetails]=useState<{payment_account_id:string|null;bank_name:string;bank_account_name:string;bank_account_number:string;onsite_payments_enabled:boolean}|null>(null);
 const [paymentError,setPaymentError]=useState('');
 const [paystackEnabled,setPaystackEnabled]=useState(false);
 const [copyStatus,setCopyStatus]=useState('');
 useEffect(()=>{
  if(!selected)return;
  const controller=new AbortController();
  void fetch('/api/payments/paystack/config?eventId='+encodeURIComponent(selected.id),{signal:controller.signal,cache:'no-store'})
   .then(async response=>{if(!response.ok)throw Error('Paystack unavailable');return response.json()})
   .then(data=>{if(!controller.signal.aborted)setPaystackEnabled(data.enabled===true)})
   .catch(()=>{if(!controller.signal.aborted)setPaystackEnabled(false)});
  return ()=>controller.abort();
 },[selected]);
 useEffect(()=>{
  if(!selected)return;
  const controller=new AbortController();
  void fetch('/api/events/payment-instructions?eventId='+encodeURIComponent(selected.id),{cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const result=await response.json();
    if(!response.ok)throw Error(result.error);
    if(!controller.signal.aborted)setPaymentDetails(result.payment);
   }).catch(error=>{if(!controller.signal.aborted)setPaymentError(error instanceof Error?error.message:'Could not load bank details')});
  return ()=>controller.abort();
 },[selected]);
 async function copyAccountNumber(){
  if(!paymentDetails?.bank_account_number)return;
  try{await navigator.clipboard.writeText(paymentDetails.bank_account_number);setCopyStatus('Account number copied')}
  catch{setCopyStatus('Select the account number to copy it manually')}
 }
 const [paymentMethod,setPaymentMethod]=useState<'manual'|'onsite'|'paystack'>('manual');
 const unitPrice=ticketCategories.find(category=>category.id===ticketCategoryId)?.price_ngn??selected?.price??0;
 const reserve=async()=>{if(!selected||busy)return;if(!account){window.location.assign('/login/user');return}setBusy(true);setNotice('');try{
 if(unitPrice>0&&paymentMethod==='manual'&&!reference.trim())throw Error('Enter your payment reference');
 if(unitPrice>0&&paymentMethod==='manual'&&!paymentDetails)throw Error(paymentError||'Verified bank unavailable');
 if(unitPrice>0&&paymentMethod==='onsite'&&!paymentDetails?.onsite_payments_enabled)throw Error('Onsite payment unavailable');
 if(unitPrice>0&&paymentMethod==='paystack'&&!paystackEnabled)throw Error('Paystack test checkout unavailable');
 reservationKey.current ||= crypto.randomUUID();
 const res=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:selected.id,quantity,ticketCategoryId,unitPriceNgn:unitPrice,reservationKey:reservationKey.current,paymentMethod,paymentAccountId:paymentDetails?.payment_account_id||null,paymentReference:paymentMethod==='paystack'?'PAYSTACK-TEST':unitPrice>0?reference.trim():'FREE-TICKET'})});
 const data=await res.json();if(!res.ok)throw Error(data.error||'Reservation failed');
 if(unitPrice>0&&paymentMethod==='paystack'){
  await refreshAccount();
  const initiated=await fetch('/api/payments/paystack/initialize',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:data.order.id})});
  const gateway=await initiated.json();
  if(!initiated.ok)throw Error(gateway.error||'Payment setup failed; resume from My Tickets');
  if(typeof gateway.authorization_url!=='string'||!gateway.authorization_url.startsWith('https://checkout.paystack.com/'))
   throw Error('Unexpected checkout destination');
  window.location.assign(gateway.authorization_url);return;
 }
 let evidenceUploaded=false;
 if(unitPrice>0&&receipt&&paymentMethod==='manual'){try{await sendReceipt(data.order.id,receipt);evidenceUploaded=true}catch(e){setNotice('Reservation created, but receipt upload failed: '+(e instanceof Error?e.message:'Upload error')+'. Upload evidence from My Tickets before expiry.')}}
 setSelected(null);setReceipt(null);setReference('');setTab('Tickets');if(unitPrice===0||!receipt||paymentMethod==='onsite'||evidenceUploaded)setNotice(evidenceUploaded?'Reservation and payment evidence submitted for organiser review.':data.message);await refreshAccount();
 }catch(e){setNotice(e instanceof Error?e.message:'Unable to reserve tickets')}finally{setBusy(false)}};
 async function resumePaystack(orderId:string){
  setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/payments/paystack/initialize',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Unable to resume gateway payment');
   if(typeof data.authorization_url!=='string'||!data.authorization_url.startsWith('https://checkout.paystack.com/'))throw Error('Invalid checkout URL');
   window.location.assign(data.authorization_url);
  }catch(error){setNotice(error instanceof Error?error.message:'Paystack checkout unavailable');setBusy(false)}
 }
 useEffect(()=>{
  if(!account)return;
  const url=new URL(window.location.href),reference=url.searchParams.get('paystack_reference');
  if(!reference)return;
  url.searchParams.delete('paystack_reference');
  window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  setTab('Tickets');setNotice('Verifying your Paystack test transaction…');
  void fetch('/api/payments/paystack/verify?reference='+encodeURIComponent(reference),{cache:'no-store'})
   .then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error||'Verification unavailable');return result})
   .then(async result=>{await refreshAccount();setNotice(result.status==='issued'||result.status==='already_issued'?
     'Paystack test payment verified. Your QR tickets are available.':result.status==='reconciliation_required'?
     'Payment requires reconciliation; contact support.':'Payment is not confirmed yet. Check your tickets later.')})
   .catch(error=>setNotice(error instanceof Error?error.message:'Gateway verification pending'));
 },[account?.email]);
 async function cancelReservation(orderId:string){
  if(!window.confirm('Cancel this unpaid reservation? If you have already paid, contact the organiser instead.'))return;
  setBusy(true);setNotice('');
  try{
   const response=await fetch('/api/orders',{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'cancel',orderId})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error);
   await refreshAccount();setNotice('Reservation cancelled');
  }catch(error){setNotice(error instanceof Error?error.message:'Cancellation failed')}
  finally{setBusy(false)}
 }
 const uploadReceipt=async(orderId:string,file:File)=>{setBusy(true);setNotice('');try{await sendReceipt(orderId,file);await refreshAccount();setNotice('Payment evidence submitted for organiser review.')}catch(e){setNotice(e instanceof Error?e.message:'Upload failed')}finally{setBusy(false)}};
 const open=(e:EventItem)=>{reservationKey.current='';setPaystackEnabled(false);setPaymentDetails(null);setPaymentError('');setCopyStatus('');setPaymentMethod('manual');setTicketCategoryId('');setTicketCategories([]);setGeneralCapacity(null);setCategoryError('');setNotice('');setQuantity(1);setReference('');setReceipt(null);setSelected(e)};
 const toggle=(id:string)=>setSaved(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
 const tabs=[['Discover','◎'],['Tickets','▣'],['Saved','♡'],['Profile','◯']];
 const events=tab==='Saved'?filtered.filter(e=>saved.includes(e.id)):filtered;
 return <div className="nxp">
 <style>{`
 .nxp{--ink:#f7f8ff;--muted:#a6b3d5;--stroke:#303b62;--accent:#9b63ff;min-height:100vh;background:radial-gradient(ellipse at 85% 0%,#26205b 0,transparent 40%),#090e20;color:var(--ink);font-family:Inter,system-ui,sans-serif;display:flex}.nxp *{box-sizing:border-box}.nxp button,.nxp input,.nxp select{font:inherit}.nxp button{cursor:pointer}.nxp aside{width:230px;flex-shrink:0;border-right:1px solid var(--stroke);padding:32px 16px;display:flex;flex-direction:column;gap:10px}.nxp .logo{font-weight:900;font-size:19px;letter-spacing:-.7px;margin:0 6px 40px}.nxp .logo span{color:#aa80ff}.nxp .nav{background:transparent;border:0;color:var(--muted);padding:15px;border-radius:12px;text-align:left;display:flex;gap:14px;align-items:center}.nxp .nav.active{background:#49308c;color:white}.nxp .nav i{font-size:22px;font-style:normal}.nxp main{width:100%;max-width:1500px;margin:auto;padding:30px clamp(18px,4vw,55px) 110px}.nxp .topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:30px}.nxp .eyebrow{color:#62e4ed;font-size:12px;font-weight:750;letter-spacing:1.5px}.nxp h1{font-size:clamp(29px,4vw,48px);letter-spacing:-1.5px;margin:7px 0 12px}.nxp h2{font-size:23px;margin:0}.nxp p{color:var(--muted);line-height:1.55}.nxp .avatar{border:1px solid #7560bd;background:#2c2552;border-radius:50%;height:42px;width:42px;color:white}.nxp .hero{min-height:310px;border-radius:25px;padding:clamp(25px,5vw,54px);display:flex;flex-direction:column;justify-content:center;align-items:flex-start;background:radial-gradient(circle at 85% 35%,#a139ff 0,transparent 27%),linear-gradient(110deg,#20144b 20%,#5025a3 60%,#0e7187);position:relative;overflow:hidden;margin:25px 0 30px}.nxp .hero:after{content:'✦';position:absolute;right:9%;top:10%;font-size:220px;color:#ffffff18;transform:rotate(-18deg)}.nxp .hero h2{font-size:clamp(34px,5vw,60px);max-width:560px;line-height:1.08;margin:13px 0}.nxp .hero p{max-width:440px;color:#e4dff8}.nxp .cta{border:0;border-radius:11px;padding:13px 20px;background:linear-gradient(120deg,#aa59ff,#7135e8);color:white;font-weight:750}.nxp .outline{border:1px solid #59688e;background:#202b48;color:white;border-radius:10px;padding:11px 15px}.nxp .search{width:100%;border:1px solid #46537b;border-radius:13px;background:#1b2543;color:white;padding:15px 18px;outline:0}.nxp .search:focus{border-color:#aa80ff}.nxp .filters{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 27px}.nxp .chip{border:1px solid #3d4b70;background:#19233f;color:#c2cee9;border-radius:30px;padding:9px 17px}.nxp .chip.active{background:#6934b4;border-color:#ae6aff;color:white}.nxp .sectionhead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:28px 0 17px}.nxp .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.nxp .card{background:#151e37;border:1px solid #344064;border-radius:20px;overflow:hidden;min-width:0}.nxp .art{height:195px;display:flex;flex-direction:column;justify-content:space-between;padding:19px;position:relative}.nxp .art .symbol{font-size:86px;text-align:center;opacity:.8;text-shadow:0 0 45px #fff7}.nxp .pill{font-size:11px;font-weight:800;background:#10152da8;border:1px solid #ffffff35;padding:6px 11px;border-radius:30px;align-self:flex-start}.nxp .heart{position:absolute;right:14px;top:13px;background:#0a1025a8;border:1px solid #ffffff65;border-radius:50%;height:35px;width:35px;color:white;font-size:21px}.nxp .cardbody{padding:19px}.nxp .cardbody h3{margin:0 0 9px;font-size:19px}.nxp .meta{font-size:12px;color:#aab9dc}.nxp .cardfoot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:20px}.nxp .price{color:#48e5e9;font-weight:800}.nxp .bottom{display:none}.nxp .empty{padding:45px;border:1px dashed #526080;border-radius:17px;text-align:center;color:#b5c3df}.nxp .modalbg{position:fixed;inset:0;background:#030715dc;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px}.nxp .modal{background:#141d36;border:1px solid #52608d;border-radius:22px;padding:25px;width:min(100%,530px);max-height:92vh;overflow:auto}.nxp .modalhead{display:flex;justify-content:space-between;align-items:center;gap:10px}.nxp .modalhead button{border:0;background:#303b5b;color:white;border-radius:9px;padding:8px 12px}.nxp .step{background:#232e4c;border:1px solid #4d5b83;border-radius:13px;padding:16px;margin:15px 0}.nxp .step strong{display:block;margin-bottom:8px}.nxp .line{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #3c4666}.nxp .qty{display:flex;align-items:center;gap:16px}.nxp .qty button{background:#3c426a;color:white;border:0;border-radius:8px;width:35px;height:35px}.nxp .file{display:block;margin:18px 0;padding:16px;border:1px dashed #64749d;border-radius:12px}.nxp .file input{width:100%;margin-top:10px;color:#d9e5ff}.nxp .notice{font-size:12px;color:#b7c8e5}.nxp .wallet{background:linear-gradient(135deg,#42248a,#142a55 70%,#06767e);border-radius:20px;padding:25px;max-width:460px}.nxp .qrplaceholder{background:white;color:#17213a;width:170px;height:170px;margin:20px auto;border-radius:12px;display:grid;place-items:center;text-align:center;font-size:13px;padding:12px}.nxp button:focus-visible{outline:3px solid #5ee5ef;outline-offset:3px}
 @media(max-width:1100px){.nxp .cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:740px){.nxp aside{display:none}.nxp main{padding:20px 16px 105px}.nxp .cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.nxp .art{height:145px;padding:12px}.nxp .art .symbol{font-size:55px}.nxp .cardbody{padding:12px}.nxp .cardbody h3{font-size:15px}.nxp .cardfoot{flex-wrap:wrap}.nxp .cardfoot button{width:100%}.nxp .bottom{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:20;justify-content:space-around;background:#111a30f2;backdrop-filter:blur(12px);border-top:1px solid #374268;padding:9px 4px max(12px,env(safe-area-inset-bottom))}.nxp .bottom button{background:transparent;color:#a8b5d3;border:0;display:grid;gap:3px;justify-items:center;font-size:10px}.nxp .bottom button i{font-size:22px;font-style:normal}.nxp .bottom button.active{color:#bc91ff}.nxp .hero{min-height:270px}.nxp .hero:after{font-size:130px}.nxp .hero h2{font-size:35px}}@media(max-width:370px){.nxp .cards{grid-template-columns:1fr}.nxp .art{height:180px}}
 @media(prefers-reduced-motion:reduce){.nxp *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
 `}</style>
 <aside><button type="button" className="logo nxp-home-button" aria-label="User home" onClick={()=>{setTab('Discover');window.scrollTo({top:0,behavior:'instant'})}}>◈ NEXX <span>EVENTPASS</span></button>{tabs.map(([name,icon])=><button key={name} className={'nav '+(tab===name?'active':'')} aria-current={tab===name?'page':undefined} onClick={()=>{setTab(name);window.scrollTo(0,0)}}><i aria-hidden="true">{icon}</i>{name}</button>)}<p style={{marginTop:'auto',fontSize:12}}>Verified event discovery<br/>Orders and QR handled by existing services</p><button className="nav" onClick={()=>{setTab('Tickets');window.scrollTo(0,0)}}>Open my tickets</button></aside>
 <main><div className="topbar"><div><div className="eyebrow">NEXX FUTURE · USER PORTAL</div><strong>Discover. Book. Experience.</strong></div><button className="avatar" aria-label="Open profile" onClick={()=>setTab('Profile')}>◯</button></div>
 <div key={tab} className="nxp-view">
 {tab==='Discover'&&<section className="nxp-feature" aria-label="Featured events" style={{position:'relative',borderRadius:24,overflow:'hidden',minHeight:340,background:liveEvents.length?liveEvents[featuredIndex%liveEvents.length].gradient:'#272057',display:'flex',alignItems:'end',padding:'clamp(24px,5vw,52px)',marginBottom:32}}>
 {liveEvents.length?(()=>{const e=liveEvents[featuredIndex%Math.min(liveEvents.length,6)];return <div key={e.id} className="nxp-feature-slide"><div className="nxp-feature-media" data-fallback={!e.cover_media_id&&!(e.video_media_id&&heroPlaying&&!selected)?'true':undefined} style={{position:'absolute',inset:0}}>{e.video_media_id&&heroPlaying&&!selected?<video key={e.id} src={'/api/events/media?id='+encodeURIComponent(e.video_media_id)} autoPlay muted playsInline preload="metadata"  style={{width:'100%',height:'100%',objectFit:'cover',opacity:.5}}/>:e.cover_media_id?<img src={'/api/events/media?id='+encodeURIComponent(e.cover_media_id)} alt="" style={{width:'100%',height:'100%',objectFit:'cover',opacity:.5}}/>:null}</div><div style={{position:'absolute',inset:0,background:'linear-gradient(0deg,#090e20 0%,#090e2055 75%,transparent)'}}/><div className="nxp-feature-copy" style={{position:'relative',zIndex:1,maxWidth:640}}><span className="pill">FEATURED · {e.category}</span><h1 style={{fontSize:'clamp(32px,5vw,58px)',margin:'16px 0'}}>{e.title}</h1><p style={{color:'#fff'}}>{e.date} · {e.venue}</p><button className="cta" onClick={()=>open(e)}>Explore tickets →</button></div></div>})():<div><h1>Discover your next experience</h1><p>Verified upcoming events will appear here.</p></div>}
 {liveEvents.length>0&&<div className="nxp-slide-controls">
  {liveEvents.length>1&&<>
   <button type="button" className="outline" aria-label="Previous event" onClick={()=>setFeaturedIndex(i=>(i+Math.min(liveEvents.length,6)-1)%Math.min(liveEvents.length,6))}>‹</button>
   <span aria-live={heroPlaying?'off':'polite'}>{(featuredIndex%Math.min(liveEvents.length,6))+1} / {Math.min(liveEvents.length,6)}</span>
   <button type="button" className="outline" aria-label="Next event" onClick={()=>setFeaturedIndex(i=>(i+1)%Math.min(liveEvents.length,6))}>›</button>
  </>}
  {(liveEvents.length>1||liveEvents[0].video_media_id)&&<button type="button" className="outline" onClick={()=>setHeroPlaying(playing=>!playing)}>{heroPlaying?'Pause':'Play'}</button>}
 </div>}
 </section>}
 {(tab==='Discover'||tab==='Saved')&&<><div className="sectionhead"><h2>{tab==='Saved'?'Saved events':'Discover events'}</h2><span className="meta">{events.length} events</span></div><input className="search" aria-label="Search events" placeholder="Search events, venues or cities..." value={search} onChange={e=>setSearch(e.target.value)}/><div className="filters">{['All',...new Set(liveEvents.map(e=>e.category))].map(c=><button key={c} className={'chip '+(category===c?'active':'')} onClick={()=>setCategory(c)}>{c}</button>)}<select className="chip" aria-label="Sort events" value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="name">Event name</option><option value="price">Lowest price</option></select></div>{loadingEvents?<EventPassLoading label="Loading events" compact/>:liveError?<div role="alert" className="empty">{liveError}</div>:events.length?<div className="cards">{events.map(e=><article className="card" key={e.id}><div className="art" style={{background:e.gradient}}>{e.cover_media_id?<img src={'/api/events/media?id='+encodeURIComponent(e.cover_media_id)} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>:null}<span className="pill" style={{position:'relative'}}>{e.category}</span><span className="symbol" style={{position:'relative'}}>{e.cover_media_id?'':e.icon}</span><button className="heart" aria-label={saved.includes(e.id)?'Remove from saved':'Save event'} onClick={()=>toggle(e.id)}>{saved.includes(e.id)?'♥':'♡'}</button></div><div className="cardbody"><div className="meta">{e.date} · {e.venue}</div><h3>{e.title}</h3><div className="cardfoot"><span className="price">From {money(e.price)}</span><button className="cta" onClick={()=>open(e)}>View event →</button></div></div></article>)}</div>:<div className="empty">No events match your filters.</div>}</>}
 {tab==='Tickets'&&<><h1>My Tickets</h1><p>Live reservations, payment reviews and secure event entry passes.</p>{accountLoading?<EventPassLoading label="Loading your tickets" compact/>:!account?<div className="empty"><p>Sign in with Google to see your tickets.</p><Link href="/login/user" className="cta">Google sign-in</Link></div>:<><div className="filters">{['All','Pending','Confirmed','Used'].map(t=><button className={'chip '+(ticketFilter===t?'active':'')} key={t} onClick={()=>setTicketFilter(t)}>{t}</button>)}</div>{accountError&&<p role="alert">{accountError}</p>}{notice&&<p role="status">{notice}</p>}{orders.filter(o=>ticketFilter==='All'||(ticketFilter==='Pending'&&['pending','reserved'].includes(o.status))).map(o=><div className="step" key={o.id}><strong>{o.event_title}</strong><p>{o.quantity} ticket(s) · {money(o.amount_ngn)} · {o.status}</p>{o.reservation_expires_at&&<p>Reservation expiry: {new Date(o.reservation_expires_at).toLocaleString('en-NG')}</p>}{o.status==='pending'&&o.payment_method==='onsite'&&<p>Pay onsite before expiry. Show the organiser this order: {o.id}</p>}{o.status==='pending'&&o.amount_ngn>0&&o.payment_method==='manual'&&!o.receipt_uploaded_at&&<label className="file">Upload payment evidence (PNG, JPG, WebP or PDF, max 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void uploadReceipt(o.id,file)}}/></label>}{o.receipt_uploaded_at&&<p>Payment evidence submitted</p>}
 {o.status==='pending'&&o.payment_method==='paystack'&&<button type="button" className="outline" disabled={busy}
  onClick={()=>void resumePaystack(o.id)}>Resume Paystack test checkout</button>}{o.refund_status&&o.refund_status!=='not_required'&&<p>Refund status: {o.refund_status}</p>}
  {o.status==='pending'&&o.payment_method!=='paystack'&&!o.receipt_uploaded_at&&o.reservation_expires_at&&new Date(o.reservation_expires_at).getTime()>Date.now()&&
 <button type="button" className="outline" disabled={busy} onClick={()=>void cancelReservation(o.id)}>Cancel unpaid reservation</button>}
{o.status==='rejected'&&o.receipt_uploaded_at&&(()=>{
  const request=supportCases.find(item=>item.payment_order_id===o.id);
  if(request)return <p>Support: {request.status.replaceAll('_',' ')}{request.resolution&&' · '+request.resolution}</p>;
  if(supportOrder!==o.id)return <button className="outline" onClick={()=>{setSupportOrder(o.id);setSupportDescription('')}}>Request payment support</button>;
  return <form onSubmit={event=>{event.preventDefault();void requestPaymentSupport(o.id)}}>
    <label>Tell support what happened<textarea className="search" required minLength={10} maxLength={1500} value={supportDescription} onChange={event=>setSupportDescription(event.target.value)}/></label>
    <p>Your existing receipt is included with the case.</p>
    <button className="cta" type="submit" disabled={busy}>Send to support</button> <button className="outline" type="button" onClick={()=>setSupportOrder('')}>Cancel</button>
  </form>;
 })()}</div>)}{tickets.filter(t=>ticketFilter==='All'||(ticketFilter==='Used'?!!t.redeemed_at:ticketFilter==='Confirmed'?!t.redeemed_at: false)).map(t=><div className="step" key={t.id}><strong>{t.title}</strong><p>{t.venue} · {t.redeemed_at?'Used':'Issued'}</p>{t.qr&&!t.redeemed_at&&<div style={{background:'white',padding:12,display:'inline-block',borderRadius:12}}><QRCodeSVG value={t.qr} size={238} level="M" includeMargin/></div>}{t.entry_code&&!t.redeemed_at&&<p><strong>Backup entry code: </strong><code style={{fontSize:17,letterSpacing:1,fontWeight:800}}>{t.entry_code}</code></p>}</div>)}{!orders.length&&!tickets.length&&<div className="empty">No reservations or tickets yet. Discover an event to begin.</div>}</>}</>}
 {tab==='Profile'&&<><h1>Your account</h1><p>Personal details, preferences, notifications and security.</p><div className="step"><strong>◯ User Profile</strong><p>{account?account.full_name+' · '+account.email:'Sign in with Google to view your account.'}</p><Link href="/login/user" className="cta" style={{display:"inline-block",textDecoration:"none"}}>Google account sign-in →</Link></div>{account&&<div className="step"><strong>Account security</strong><p>End your EventPass session on this device.</p><Link href="/ticket-staff" className="outline" style={{display:"inline-block",textDecoration:"none",marginRight:8}}>Ticket Staff workspace</Link><button className="outline" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/auth/logout',{method:'POST'});if(!r.ok)throw Error('Sign out failed');window.location.assign('/login/user')}catch(e){setNotice(e instanceof Error?e.message:'Sign out failed');setBusy(false)}}}>Sign out</button></div>}<div className="step"><strong>Notification preferences</strong><p>Ticket confirmations, payment review updates and event reminders.</p></div><div className="step"><strong>Security & privacy</strong><p>Session controls and personal account settings remain in the existing authentication flow.</p></div></>}
 </div>
 {selected&&<div className="modalbg" role="presentation"><section ref={checkoutDialog} className="modal" role="dialog" aria-modal="true" aria-label="Reserve event tickets"><div className="modalhead"><h2>{selected.title}</h2><button onClick={()=>setSelected(null)}>Close</button></div><p>{selected.venue} · {selected.date}</p><div className="step"><strong>Reservation</strong>{categoryError&&<p role="alert">{categoryError}</p>}{ticketCategories.length>0&&<label>Ticket category <select value={ticketCategoryId} onChange={e=>{setTicketCategoryId(e.target.value);setReceipt(null);setReference('');setPaymentMethod('manual')}}>{generalCapacity!==0&&<option value="">General</option>}{ticketCategories.map(category=><option key={category.id} value={category.id}>{category.name} · {money(category.price_ngn)}</option>)}</select></label>}<p>Ticket price: {money(unitPrice)}</p><label>Quantity <input type="number" min="1" max="10" value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(10,Number(e.target.value)||1)))}/></label><p>Total: {money(unitPrice*quantity)}</p></div>{unitPrice>0&&<div className="step"><label>Payment method <select value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value==='paystack'?'paystack':event.target.value==='onsite'?'onsite':'manual')}>
 <option value="manual">Bank transfer</option>{paymentDetails?.onsite_payments_enabled&&<option value="onsite">Pay onsite</option>}<option value="paystack" disabled={!paystackEnabled}>Paystack test checkout {paystackEnabled?'':'· setup pending'}</option></select></label>
 {paymentMethod==='onsite'&&<p>Show your order at the venue and pay before the reservation expires. Tickets appear after the organiser confirms collection.</p>}
 {paymentMethod==='paystack'&&<p>Paystack test checkout uses a verified organiser subaccount. Tickets issue only after confirmed provider payment.</p>}</div>}{unitPrice>0&&paymentMethod==='manual'&&<div className="step"><strong>Transfer to the organiser’s verified account</strong>
 {paymentError?<p role="alert">{paymentError}</p>:!paymentDetails?<p role="status">Loading verified bank details…</p>:<>
 <dl className="checkout-bank-details">
  <div><dt>Bank</dt><dd>{paymentDetails.bank_name}</dd></div>
  <div><dt>Account holder</dt><dd>{paymentDetails.bank_account_name}</dd></div>
  <div><dt>Account number</dt><dd><strong>{paymentDetails.bank_account_number}</strong> <button className="outline" type="button" onClick={()=>void copyAccountNumber()}>Copy</button></dd></div>
 </dl>
 {copyStatus&&<p role="status">{copyStatus}</p>}
 <p>Confirm the account holder and transfer the total shown above, then attach your receipt.</p>
 <label>Payment reference <input className="search" value={reference} onChange={e=>setReference(e.target.value)} placeholder="Bank transfer reference"/></label><label className="file">Payment evidence (optional at reservation; upload before expiry)<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e=>setReceipt(e.target.files?.[0]||null)}/></label></>}</div>}{unitPrice===0&&paymentError&&<p role="alert">{paymentError}</p>}{notice&&<p role="alert">{notice}</p>}<button className="cta" disabled={busy||generalCapacity===null||(unitPrice>0&&paymentMethod==='manual'&&!paymentDetails)||(unitPrice>0&&paymentMethod==='paystack'&&!paystackEnabled)} onClick={()=>void reserve()}>{busy?'Processing…':account?'Reserve tickets':'Sign in with Google to reserve'}</button></section></div>}
 </main><div className="bottom">{tabs.map(([name,icon])=><button key={name} className={tab===name?'active':''} aria-current={tab===name?'page':undefined} onClick={()=>{setTab(name);window.scrollTo(0,0)}}><i aria-hidden="true">{icon}</i>{name}</button>)}</div>

 </div>;
}