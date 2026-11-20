'use client';
import React,{useEffect,useRef,useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {useParams} from 'next/navigation';
import {portalHome} from '@/lib/portal-home';
import {ticketThemes,findTicketTheme} from '@/lib/ticket-themes';
import {masqueradeTemplates,isMasqueradeTemplate,masqueradePosterTemplates,isMasqueradePoster} from '@/lib/masquerade-templates';
import {EventPosterDesign} from '@/components/EventPosterDesign';
import {TicketDesign} from '@/components/TicketDesign';
import TicketStudioEditor from '@/components/TicketStudioEditor';
import EventPassLoading from '@/components/EventPassLoading';
import FinanceLedger from '@/components/FinanceLedger';
import OfflineTicketManager from '@/components/OfflineTicketManager';
type Member={id:string;email:string;full_name:string;role:string;account_status:string;requested_role:string|null};
type Event={payment_account_id?:string|null;onsite_payments_enabled?:boolean;id:string;organiser_id:string;title:string;venue:string;starts_at:string;price_ngn:number;capacity:number;status:string;verification_status?:string;organiser?:string;description?:string;category?:string;ticket_theme?:string;admission_label?:string;poster_template?:string;cover_media_id?:string|null;video_media_id?:string|null;ticket_art_id?:string|null;bank_name?:string;bank_account_name?:string;bank_account_number?:string};
type BankAccount={id:string;bank_name:string;account_name:string;account_number:string;status:'pending'|'verified'|'rejected';organiser_name?:string;review_note?:string};
type Order={payment_method?:'manual'|'onsite'|'free';id:string;event_id:string;event_title:string;reservation_expires_at?:string;refund_status?:string;buyer_name?:string;buyer_email?:string;status:string;quantity:number;amount_ngn:number;payment_reference:string;receipt_uploaded_at?:string|null};
type Ticket={id:string;event_id:string;title:string;venue:string;starts_at:string;status:string;qr:string|null;entry_code?:string|null;redeemed_at?:string|null;ticket_theme?:string;admission_label?:string;ticket_art_id?:string|null};
type Gate={event_id:string;title:string;gate_label:string;organiser_name?:string};
type Organiser={id:string;email:string;full_name:string;role:string;account_status:string;requested_role:string|null;event_count:number;pending_orders:number;tickets_issued:number;gate_operators:number;created_at:string;approved_at?:string|null;bank_name?:string|null;account_name?:string|null;account_number?:string|null;can_create_events?:boolean;can_invite_gates?:boolean;can_verify_payments?:boolean};
type GateOperator={event_id:string;user_id:string;gate_label:string;email:string;full_name:string;account_status:string;scan_count:number;admitted_count:number;last_scan_at:string|null};
type Invite={id:string;event_id:string;invitee_email:string;gate_label:string;status:string};
type Scan={id:string;outcome:string;operator?:string;gate_label:string;scanned_at:string};
type EventMedia={id:string;event_id?:string;media_type:string;file_name:string;approved?:boolean;url:string};
type AdminAccount={id:string;email:string;full_name:string;role:string;account_status:string;google_verified:boolean;order_count:number;ticket_count:number;event_count:number;gate_event_count:number;created_at:string};
type SupportCase={payment_order_id?:string|null;id:string;organiser_id:string;organiser_name:string;subject:string;description:string;status:string;priority:string;resolution:string};
type EventReport={id:string;title:string;venue:string;organiser_id:string;organiser_name:string;status:string;verification_status:string;capacity:number;tickets_issued:number;external_tickets_issued:number;reserved_seats:number;pending_orders:number;checked_in:number;confirmed_revenue_ngn:number;refund_cases:number;active_gate_operators:number};
type RefundCase={id:string;event_id:string;event_title:string;buyer_email:string;organiser_name:string;amount_ngn:number;status:string;refund_status:string;refund_note:string;reservation_expires_at:string};
type AuditRecord={id:string;action:string;performed_by:string;target_email?:string;created_at:string;details:Record<string,unknown>};
type ModerationEvent={id:string;organiser_id:string;owner_eligible:boolean;title:string;venue:string;starts_at:string;organiser_name:string;organiser_email:string;status:string;verification_status:string;pending_media:number};
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
export default function RoleWorkspace({portal}:{portal?:Role}={}){
 const p=useParams<{role:string}>(),role=(portal||p.role) as Role,title=roles[role],scanControls=useRef<{stop:()=>void}|null>(null);
 const [me,setMe]=useState<Member|null>(null),[portals,setPortals]=useState<string[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[orders,setOrders]=useState<Order[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[gates,setGates]=useState<Gate[]>([]),[invites,setInvites]=useState<Invite[]>([]);
 const [search,setSearch]=useState(''),[filterCategory,setFilterCategory]=useState('All'),[sortBy,setSortBy]=useState('soonest');
 const [themeCatalog,setThemeCatalog]=useState<{id:string;name:string;label:string;gradient:string;accent:string}[]>(ticketThemes.map(t=>({...t})));
 const [newThemeName,setNewThemeName]=useState(''),[newThemeLabel,setNewThemeLabel]=useState(''),[themeColorA,setThemeColorA]=useState('#3d2683'),[themeColorB,setThemeColorB]=useState('#12a59c'),[themeAccent,setThemeAccent]=useState('#ffffff');
 const [eventDescription,setEventDescription]=useState(''),[eventCategory,setEventCategory]=useState('Music'),[ticketTheme,setTicketTheme]=useState('aurora'),[admissionLabel,setAdmissionLabel]=useState('ADMIT ONE'),[posterTemplate,setPosterTemplate]=useState('none');
 const [eventMedia,setEventMedia]=useState<EventMedia[]>([]),[moderationEvents,setModerationEvents]=useState<ModerationEvent[]>([]),[moderationMedia,setModerationMedia]=useState<EventMedia[]>([]);
 const [organisers,setOrganisers]=useState<Organiser[]>([]),[stats,setStats]=useState<Record<string,number>>({});
 const [selectedOrganiser,setSelectedOrganiser]=useState(''),[editName,setEditName]=useState('');
 const [rejectOrganiserId,setRejectOrganiserId]=useState(''),[rejectOrganiserReason,setRejectOrganiserReason]=useState('');
 const [canCreate,setCanCreate]=useState(true),[canGates,setCanGates]=useState(true),[canPayments,setCanPayments]=useState(true);
 const [eventReports,setEventReports]=useState<EventReport[]>([]),[reportSearch,setReportSearch]=useState(''),[selectedReport,setSelectedReport]=useState(''),[auditHistory,setAuditHistory]=useState<AuditRecord[]>([]);
 const [refundCases,setRefundCases]=useState<RefundCase[]>([]),[refundNotes,setRefundNotes]=useState<Record<string,string>>({});
 const [allUsers,setAllUsers]=useState<AdminAccount[]>([]),[userSearch,setUserSearch]=useState(''),[userFilter,setUserFilter]=useState(''),[userPage,setUserPage]=useState(1),[usersCount,setUsersCount]=useState(0),[selectedUser,setSelectedUser]=useState(''),[userEditName,setUserEditName]=useState(''),[accountReason,setAccountReason]=useState('');
 const [cases,setCases]=useState<SupportCase[]>([]),[caseSubject,setCaseSubject]=useState(''),[caseDescription,setCaseDescription]=useState(''),[casePriority,setCasePriority]=useState('normal');
 const [selectedSupportId,setSelectedSupportId]=useState(''),[supportDrafts,setSupportDrafts]=useState<Record<string,{resolution:string;priority:string}>>({});
 const [platformSettings,setPlatformSettings]=useState<Record<string,string>>({}),[settingKey,setSettingKey]=useState('support_email'),[settingValue,setSettingValue]=useState('');
 const [bankName,setBankName]=useState(''),[accountName,setAccountName]=useState(''),[accountNumber,setAccountNumber]=useState('');
 const [bankAccounts,setBankAccounts]=useState<BankAccount[]>([]);
 const [eventBankId,setEventBankId]=useState('');
 const verifiedBanks=bankAccounts.filter(account=>account.status==='verified');

 const [eventVisibility,setEventVisibility]=useState('public');
 const [eventId,setEventId]=useState(''),[eventTitle,setEventTitle]=useState(''),[venue,setVenue]=useState(''),[startsAt,setStartsAt]=useState(''),[capacity,setCapacity]=useState('100'),[ticketPrice,setTicketPrice]=useState('5000'),[keyword,setKeyword]=useState('');
 const [quantity,setQuantity]=useState('1'),[paymentRef,setPaymentRef]=useState(''),[selectedEvent,setSelectedEvent]=useState(''),[receipt,setReceipt]=useState<File|null>(null),[receiptUploads,setReceiptUploads]=useState<Record<string,File|null>>({});
 const [expandedQr,setExpandedQr]=useState<{value:string;eventName:string;entryCode?:string|null}|null>(null);
 const [adminTab,setAdminTab]=useState('overview');
 const [adminMenuOpen,setAdminMenuOpen]=useState(false),[adminNavCollapsed,setAdminNavCollapsed]=useState(false),[organiserMenuOpen,setOrganiserMenuOpen]=useState(false);
 const [showEventDesign,setShowEventDesign]=useState(false);
 const [organiserTab,setOrganiserTab]=useState<'dashboard'|'events'|'tickets'|'offline'|'payments'|'team'|'profile'|'settings'>('dashboard');
 const [gateOperators,setGateOperators]=useState<GateOperator[]>([]);
 const [staffEmail,setStaffEmail]=useState(''),[gateLabel,setGateLabel]=useState('Main gate'),[newOrganiser,setNewOrganiser]=useState(''),[latestInvite,setLatestInvite]=useState('');
 const [inbox,setInbox]=useState<{pending:number;unread:number;payments:{id:string;event_title:string;buyer_name:string;amount_ngn:number;payment_reference:string;reservation_expires_at:string;read_at:string|null}[]}>({pending:0,unread:0,payments:[]});
 async function refreshInbox(){setInbox(await api('organiser/payment-inbox'))}
 useEffect(()=>{
  if(role!=='organiser'||me?.role!=='organiser'||me.account_status!=='active')return;
  const refresh=()=>{if(document.visibilityState==='visible')void refreshInbox().catch(()=>{})};
  refresh();
  const timer=window.setInterval(refresh,15000);
  document.addEventListener('visibilitychange',refresh);
  return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',refresh)};
 },[role,me?.id,me?.role,me?.account_status]);
 useEffect(()=>{
  if(!adminMenuOpen&&!organiserMenuOpen)return;
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){setAdminMenuOpen(false);setOrganiserMenuOpen(false)}};
  document.addEventListener('keydown',onKeyDown);
  return ()=>document.removeEventListener('keydown',onKeyDown);
 },[adminMenuOpen,organiserMenuOpen]);
 const adminMenuItems=[
  ['overview','Dashboard','▦'],['organisers','Organisers','◉'],['users','Users & access','♙'],['moderation','Event moderation','◇'],['reports','Events & analytics','▥'],
  ['refunds','Payments & refunds','₦'],['support','Support desk','♧'],['themes','Ticket themes','✧'],['audit','Audit logs','≡'],['settings','Settings','⚙']
 ] as const;
 function navigateAdmin(tab:string){
  setAdminTab(tab);setAdminMenuOpen(false);setMessage('');window.scrollTo({top:0,behavior:'instant'});
 }
 function navigateOrganiser(tab:typeof organiserTab){
  setOrganiserTab(tab);setOrganiserMenuOpen(false);setMessage('');window.scrollTo({top:0,behavior:'instant'});
 }
 const cameraGeneration=useRef(0);
 const verificationInFlight=useRef(false);
 const lastDecoded=useRef({value:'',at:0});
 const [scanCode,setScanCode]=useState(''),[scanning,setScanning]=useState(false),[scanOutcome,setScanOutcome]=useState(''),[scans,setScans]=useState<Scan[]>([]);
 const [rehearsal,setRehearsal]=useState(false);
 const rehearsalRef=useRef(false);
 const valid=role==='user'||role==='organiser'||role==='gate'||role==='platform-admin';
 const allowed=me&&portals.includes(role==='platform-admin'?'platform_admin':role);
 useEffect(()=>{if(role==='gate'&&gates.length===1&&!eventId)setEventId(gates[0].event_id)},[role,gates,eventId]);
 useEffect(()=>{if(role!=='user'||!events.length||selectedEvent)return;const id=new URLSearchParams(window.location.search).get('eventId');if(id&&events.some(e=>e.id===id&&e.status==='published'&&e.verification_status==='verified')){void loadUserMedia(id)}},[role,events,selectedEvent]);
 async function fetchAll(){
  const m=await api('auth/me');setMe(m.user);setPortals(m.portals||[]);
  if(!m.user)return;
  const [e,themeResult]=await Promise.all([api('events'),api('ticket-themes')]);setEvents(e.events||[]);if(themeResult.themes?.length)setThemeCatalog(themeResult.themes);
  if(m.user.account_status==='pending'||(role==='organiser'&&m.user.role==='user'&&m.user.requested_role==='organiser'))return;
  const rr=role==='platform-admin'?'platform_admin':role;
  if(!(m.portals||[]).includes(rr))return;
  if(role==='user'){
   const [t,o]=await Promise.all([api('tickets'),api('orders')]);setTickets(t.tickets||[]);setOrders(o.orders||[]);
  }else if(role==='organiser'){
   const [b,g,support,report,refunds]=await Promise.all([api('organiser/payment-account'),api('gates'),api('support/cases'),api('platform/event-directory'),api('refunds')]);
   setEventReports(report.events||[]);setRefundCases(refunds.orders||[]);
   setCases(support.cases||[]);
   setBankAccounts(b.accounts||[]);
   setGates(g.gates||[]);setInvites(g.invitations||[]);setGateOperators(g.operators||[]);
  }else if(role==='gate'){const g=await api('gates');setGates(g.gates||[]);}
  else if(role==='platform-admin'){
   const [a,overview,banks]=await Promise.all([api('platform/organisers'),api('platform/overview'),api('organiser/payment-account')]);
   setBankAccounts(banks.accounts||[]);
   setOrganisers(a.organisers||[]);setStats(overview.stats||{});
   const [reviews,people,support,configuration,report,refunds,audit]=await Promise.all([api('platform/events'),api('platform/users'),api('support/cases'),api('platform/settings'),api('platform/event-directory'),api('refunds'),api('platform/audit')]);
   setEventReports(report.events||[]);setRefundCases(refunds.orders||[]);setAuditHistory(audit.history||[]);
   setModerationEvents(reviews.events||[]);setModerationMedia(reviews.media||[]);
   setAllUsers(people.accounts||[]);setUsersCount(people.count||0);setCases(support.cases||[]);setPlatformSettings(configuration.settings||{});
  }
 }
 useEffect(()=>{setLoading(true);fetchAll().catch(e=>setMessage((e as Error).message)).finally(()=>setLoading(false));return ()=>{cameraGeneration.current++;scanControls.current?.stop()}},[role]);
 useEffect(()=>{if(role!=='user'||!me||me.account_status!=='active')return;
 const refresh=()=>{if(document.visibilityState==='visible')api('tickets').then(v=>setTickets(v.tickets||[])).catch(()=>{})};
 const id=setInterval(refresh,12000);return ()=>clearInterval(id);
 },[role,me?.id,me?.account_status]);
 useEffect(()=>{if(!eventId){setOrders([]);setScans([]);return}
 if(role==='organiser'){setOrders([]);api('orders?eventId='+encodeURIComponent(eventId)).then(v=>setOrders(v.orders||[])).catch(e=>setMessage((e as Error).message));}
 if(role==='organiser'||role==='gate')api('gates/activity?eventId='+encodeURIComponent(eventId)).then(v=>setScans(v.scans||[])).catch(e=>setMessage((e as Error).message));
 if(role==='organiser')api('events/media?eventId='+encodeURIComponent(eventId)).then(v=>setEventMedia(v.media||[])).catch(e=>setMessage((e as Error).message));
 },[eventId,role]);
 async function run(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
 async function createEvent(){await run(async()=>{
  const date=new Date(startsAt);if(!Number.isFinite(date.getTime()))throw Error('Choose an event date');
  const result=await api('events','POST',{title:eventTitle,venue,description:eventDescription,category:eventCategory,ticketTheme,admissionLabel,posterTemplate,visibility:eventVisibility,startsAt:date.toISOString(),capacity:Number(capacity),priceNgn:Number(ticketPrice),paymentAccountId:eventBankId,qrKeyword:keyword});
  setEventTitle('');setKeyword('');await fetchAll();setEventId(result.event.id);setMessage('Event created! Add promotional media and send your listing for Platform Admin verification.');
 })}
 async function addNewTicketTheme(){await run(async()=>{
  await api('ticket-themes','POST',{name:newThemeName,label:newThemeLabel,colorA:themeColorA,colorB:themeColorB,accent:themeAccent});
  const r=await api('ticket-themes');setThemeCatalog(r.themes||[]);setNewThemeName('');setNewThemeLabel('');
  setMessage('New ticket theme is available to organisers');
 })}
 async function saveEventDesign(){await run(async()=>{
  if(!eventId)throw Error('Select your event first');
  await api('events','PATCH',{eventId,description:eventDescription,category:eventCategory,ticketTheme,admissionLabel,posterTemplate});
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
 async function correctEventOwner(event:ModerationEvent,form:HTMLFormElement){await run(async()=>{
  const fields=new FormData(form);
  await api('platform/events','POST',{eventId:event.id,action:'correct_owner',expectedOwnerId:event.organiser_id,
   organiserEmail:fields.get('organiserEmail'),reason:fields.get('reason'),ownershipConfirmed:fields.get('ownershipConfirmed')==='on'});
  const result=await api('platform/events');setModerationEvents(result.events||[]);setModerationMedia(result.media||[]);
  setMessage('Owner corrected. The listing is now a draft and requires a new publication review.');
 })}
 async function loadUserMedia(id:string){setSelectedEvent(id);if(!id){setEventMedia([]);return}
  try{const v=await api('events/media?eventId='+encodeURIComponent(id));setEventMedia(v.media||[])}
  catch(e){setMessage(e instanceof Error?e.message:'Media unavailable')}
 }
 async function saveBank(){await run(async()=>{
  await api('organiser/payment-account','POST',{bankName,accountName,accountNumber});
  setBankName('');setAccountName('');setAccountNumber('');
  await fetchAll();setMessage('Bank account submitted for Platform Admin review');
 })}
 async function reviewBank(accountId:string,decision:string,note:string){await run(async()=>{
  await api('organiser/payment-account','PATCH',{accountId,decision,note});
  setBankAccounts((await api('organiser/payment-account')).accounts||[]);
  setMessage(decision==='verified'?'Bank account verified':'Bank account rejected');
 })}
 async function book(e:Event){await run(async()=>{
  if(!receipt&&e.price_ngn>0)throw Error('Upload payment receipt before submitting a paid order');
  const o=await api('orders','POST',{eventId:e.id,quantity:Number(quantity),paymentAccountId:e.payment_account_id,paymentReference:e.price_ngn>0?paymentRef:'FREE-TICKET'});
  if(receipt){const form=new FormData();form.set('orderId',o.order.id);form.set('receipt',receipt);await api('orders/receipt','POST',form);}
  setSelectedEvent('');setPaymentRef('');setReceipt(null);setMessage('Order received. Organiser will verify funds and receipt before ticket issuance.');
  await fetchAll();
 })}
 async function upload(orderId:string){await run(async()=>{
  const file=receiptUploads[orderId];if(!file)throw Error('Select a receipt first');
  const form=new FormData();form.set('orderId',orderId);form.set('receipt',file);
  await api('orders/receipt','POST',form);setMessage('Receipt delivered for organiser review.');await fetchAll();
 })}
 async function review(id:string,decision:'approved'|'rejected',collection?:{collectedAmountNgn:number;collectionReference:string}){await run(async()=>{
  await api('review','POST',{orderId:id,decision,...collection});setMessage('Payment review saved');
  if(eventId){const r=await api('orders?eventId='+encodeURIComponent(eventId));setOrders(r.orders||[])}
  await Promise.all([refreshInbox(),fetchAll()]);
 })}
 async function inviteGate(){await run(async()=>{
  if(!eventId)throw Error('Select an event first');
  const r=await api('gates','POST',{eventId,email:staffEmail,gateLabel});setMessage(r.message);setLatestInvite(r.invitationLink||'');setStaffEmail('');
  const g=await api('gates');setGates(g.gates||[]);setInvites(g.invitations||[]);setGateOperators(g.operators||[]);
 })}
 async function addExistingOperator(){await run(async()=>{
  if(!eventId)throw Error('Select an event');
  const r=await api('gates','POST',{eventId,email:staffEmail,gateLabel,mode:'add'});
  setLatestInvite('');setStaffEmail('');setMessage(r.message);
  const g=await api('gates');setGates(g.gates||[]);setInvites(g.invitations||[]);setGateOperators(g.operators||[]);
 })}
 async function revokeGate(i:Invite){await run(async()=>{
  await api('gates','DELETE',{eventId:i.event_id,email:i.invitee_email});setMessage('Gate invitation and access revoked');
  const g=await api('gates');setGates(g.gates||[]);setInvites(g.invitations||[]);setGateOperators(g.operators||[]);
 })}
 async function adminAction(action:string,id?:string){if(action==='revoke'&&!window.confirm('Suspend this organiser? Existing ticket and financial history will be retained.'))return;
  if(action==='reject'){
   if(rejectOrganiserId!==id||rejectOrganiserReason.trim().length<10){setMessage('Enter a rejection reason of at least 10 characters');return}
   if(!window.confirm('Reject this organiser application with the recorded reason?'))return;
  }
  await run(async()=>{
  await api('platform/organisers','POST',{action,userId:id,email:newOrganiser,...(action==='reject'?{reason:rejectOrganiserReason.trim()}:{})});
  if(action==='reject'){setRejectOrganiserId('');setRejectOrganiserReason('')}
  setMessage('Organiser action completed');setNewOrganiser('');
  const a=await api('platform/organisers');setOrganisers(a.organisers||[]);if(id)setSelectedOrganiser(id);
 })}
 function chooseOrganiser(id:string){
  setAdminTab('organisers');setSelectedOrganiser(id);const org=organisers.find(x=>x.id===id);
  setEditName(org?.full_name||'');
  setCanCreate(org?.can_create_events!==false);setCanGates(org?.can_invite_gates!==false);setCanPayments(org?.can_verify_payments!==false);
 }
 async function configureOrganiser(){await run(async()=>{
  if(!selectedOrganiser)throw Error('Select an organiser');
  await api('platform/organisers','POST',{action:'configure',userId:selectedOrganiser,fullName:editName});
  const res=await api('platform/organisers');setOrganisers(res.organisers||[]);setMessage('Organiser profile updated');
 })}
 async function searchAdminUsers(page=1){await run(async()=>{const r=await api('platform/users?q='+encodeURIComponent(userSearch)+'&role='+encodeURIComponent(userFilter)+'&page='+page);setAllUsers(r.accounts||[]);setUsersCount(r.count||0);setUserPage(page)})}
 function chooseUser(id:string){setAdminTab('users');setSelectedUser(id);const a=allUsers.find(x=>x.id===id);setUserEditName(a?.full_name||'');setAccountReason('')}
 async function changeUser(action:'configure'|'suspend'|'restore'|'deactivate'){await run(async()=>{if(!selectedUser)throw Error('Select a user first');
  if(['deactivate','suspend'].includes(action)&&!window.confirm('Suspend this account? Ticket, order and audit records will be retained.'))return;
  await api('platform/users','PATCH',{action,userId:selectedUser,fullName:userEditName,reason:accountReason});
  const r=await api('platform/users?q='+encodeURIComponent(userSearch)+'&role='+encodeURIComponent(userFilter)+'&page='+userPage);setAllUsers(r.accounts||[]);setUsersCount(r.count||0);setMessage('Account updated and audited')})}
 async function openSupportCase(){await run(async()=>{const r=await api('support/cases','POST',{subject:caseSubject,description:caseDescription,priority:casePriority});
  setCaseSubject('');setCaseDescription('');setMessage('Support request sent: '+r.case.id);const x=await api('support/cases');setCases(x.cases||[])})}
 function openSupportCaseEditor(c:SupportCase){setSelectedSupportId(current=>current===c.id?'':c.id);setSupportDrafts(p=>({...p,[c.id]:p[c.id]||{priority:c.priority,resolution:c.resolution||''}}))}
 async function updateCase(c:SupportCase,status:'open'|'in_progress'|'resolved'|'closed'){
  const draft=supportDrafts[c.id]||{priority:c.priority,resolution:c.resolution||''};
  if(['resolved','closed'].includes(status)&&draft.resolution.trim().length<10){setMessage('Enter a case-specific resolution of at least 10 characters');return}
  if(['resolved','closed'].includes(status)&&!window.confirm('Confirm '+status+' for '+c.subject+'? This action is recorded in the administrator audit.'))return;
  await run(async()=>{
   await api('support/cases','PATCH',{id:c.id,status,priority:draft.priority,resolution:draft.resolution.trim()});
   const x=await api('support/cases');setCases(x.cases||[]);setMessage('Support case '+status.replace('_',' ')+' and audit updated');
  });
 }
 async function saveSetting(){await run(async()=>{await api('platform/settings','PATCH',{key:settingKey,value:settingValue});setPlatformSettings({...platformSettings,[settingKey]:settingValue});setMessage('Platform setting saved')})}
 async function saveCapabilities(){await run(async()=>{
  await api('platform/organisers','POST',{action:'capabilities',userId:selectedOrganiser,canCreateEvents:canCreate,canInviteGates:canGates,canVerifyPayments:canPayments});
  const a=await api('platform/organisers');setOrganisers(a.organisers||[]);setMessage('Organiser permissions saved and audited');
 })}
 async function refreshReports(){await run(async()=>{const r=await api('platform/event-directory?q='+encodeURIComponent(reportSearch));setEventReports(r.events||[]);setMessage('Reports updated')})}
 async function updateRefund(orderId:string,action:'review_required'|'initiated'|'settled'){await run(async()=>{
  const note=(refundNotes[orderId]||'').trim();
  if(action==='settled'&&note.length<10)throw Error('Enter settlement evidence for this specific order (minimum 10 characters).');
  await api('refunds','PATCH',{orderId,action,note});const r=await api('refunds');setRefundCases(r.orders||[]);
  setRefundNotes(p=>({...p,[orderId]:''}));setMessage('Refund status updated in the payment audit.');
 })}
 function stopScan(){
  cameraGeneration.current++;
  scanControls.current?.stop();
  scanControls.current=null;
  setScanning(false);
 }
 async function scan(value=scanCode){
  if(verificationInFlight.current)return;
  verificationInFlight.current=true;
  setScanOutcome('');
  try{
   await run(async()=>{
    if(!eventId||!value.trim())throw Error('Select your event and enter a ticket code');
    let result;
    const testOnly=rehearsalRef.current;
    try{result=await api('scan','POST',{eventId,code:value.trim(),testOnly})}
    catch(error){throw Error('Could not verify ticket. Do not admit. '+(error instanceof Error?error.message:''))}
    setScanOutcome(result.outcome);setScanCode('');
    // The admission result is authoritative. History refresh must not stall the next QR.
    if(!testOnly&&!scanning)void api('gates/activity?eventId='+encodeURIComponent(eventId))
      .then(history=>setScans(history.scans||[])).catch(()=>{});
   });
  }finally{verificationInFlight.current=false}
 }
 async function startScan(){
  if(!eventId||scanning||verificationInFlight.current)return;
  const generation=++cameraGeneration.current;
  setMessage('');setScanOutcome('');setScanning(true);
  try{
   if(!window.isSecureContext)throw Error('Camera access requires HTTPS');
   const {BrowserQRCodeReader}=await import('@zxing/browser');
   if(generation!==cameraGeneration.current)return;
   const preview=document.getElementById('gate-video') as HTMLVideoElement|null;
   if(!preview)throw Error('Camera preview unavailable');
   const reader=new BrowserQRCodeReader();
   const controller=await reader.decodeFromVideoDevice(undefined,preview,(result)=>{
    if(!result||generation!==cameraGeneration.current||verificationInFlight.current)return;
    const value=result.getText(),now=Date.now();
    if(value===lastDecoded.current.value&&now-lastDecoded.current.at<2500)return;
    lastDecoded.current={value,at:now};
    // Continuous decode: keep the camera mounted between admissions.
    void scan(value);
   });
   if(generation===cameraGeneration.current)scanControls.current=controller;
   else controller.stop();
  }catch(error){
   if(generation!==cameraGeneration.current)return;
   stopScan();
   setMessage(error instanceof Error&&error.message.includes('HTTPS')?error.message:
    'Camera unavailable. Check camera permissions or enter the ticket code below.');
  }
 }
 function resetPortalHome(){
  setMessage('');
  if(role==='platform-admin'){setAdminTab('overview');setAdminMenuOpen(false)}
  if(role==='organiser'){setOrganiserTab('dashboard');setOrganiserMenuOpen(false)}
  if(role==='gate'){
   stopScan();setEventId('');setScanCode('');setScanOutcome('');setScans([]);
  }
  window.scrollTo({top:0,behavior:'instant'});
 }
 async function signout(){await api('auth/logout','POST');window.location.assign('/login/'+role)}
 const input=(label:string,value:string,onChange:(v:string)=>void,type='text')=><label className="rw-field">{label}<input value={value} onChange={e=>onChange(e.target.value)} type={type}/></label>;
 const themeFor=(id:string)=>themeCatalog.find(t=>t.id===id)||findTicketTheme(id);
 const categories=['All',...new Set(events.filter(e=>e.status==='published').map(e=>e.category||'Other'))];
 const visibleEvents=events.filter(e=>e.status==='published'&&e.verification_status!=='pending')
  .filter(e=>filterCategory==='All'||(e.category||'Other')===filterCategory)
  .filter(e=>[e.title,e.venue,e.organiser||'',e.description||''].join(' ').toLowerCase().includes(search.toLowerCase()))
  .sort((a,b)=>sortBy==='price'?a.price_ngn-b.price_ngn:sortBy==='latest'?new Date(b.starts_at).getTime()-new Date(a.starts_at).getTime():new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());
 const btn=(text:string,callback:()=>void,secondary=false)=><button className={secondary?'ghost':'primary'} disabled={busy} onClick={callback}>{text}</button>;
 if(!valid)return <main className="rw-shell"><h1>Unknown interface</h1><a href="/login/user">User login</a></main>;
 if(loading)return <EventPassLoading label={"Opening "+title+" workspace"}/>;
 if(!me)return <main className="rw-shell"><h1>{title}</h1><p>Sign in to continue.</p><a className="rw-primary-link" href={'/login/'+role}>Sign in to {title}</a></main>;
 if(role==='organiser'&&me.role==='user'&&me.requested_role==='organiser')return <main className="rw-shell"><h1>Organiser approval pending</h1><p>Your Google or email account is registered. The Platform Administrator must approve your organiser request before your management interface becomes active.</p><p>{me.email}</p><a className="google-auth-button" href="/api/auth/google?portal=organiser&intent=link"><span className="google-g" aria-hidden="true">G</span> Link Google account</a><button onClick={()=>{void signout()}}>Sign out</button></main>;
 if(!allowed)return <main className="rw-shell"><h1>{title} access inactive</h1><p>Your account does not have permission to access this interface.</p><p>Organisers require administrator approval. Gate operators require an invitation from an organiser and a Google-verified email.</p><a href="/login/user">Open User interface</a></main>;
 return <main className={role==='platform-admin'?"rw-shell ep-admin-shell":"rw-shell"} data-portal={role}><style>{`.rw-workspace-shell{display:grid;grid-template-columns:225px minmax(0,1fr);gap:16px;align-items:start}.rw-workspace-shell>.rw-layout{width:100%}@media(max-width:800px){.rw-workspace-shell{grid-template-columns:1fr}.rw-workspace-shell>aside,.rw-workspace-shell>nav{position:static!important}.rw-workspace-shell>nav{grid-template-columns:repeat(2,minmax(0,1fr));display:grid!important}.rw-workspace-shell>nav .eyebrow{grid-column:1/-1}}`}</style><div className="rw-top"><div><a href={portalHome[role]} className="rw-brand" aria-label={title+' home'} onClick={event=>{
   if(role==='user'||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   event.preventDefault();resetPortalHome();
  }}>◈ NEXX <span>EVENTPASS</span></a><div className="rw-label">{title} · Nexx Future</div></div><div className="rw-tools"><span>{me.full_name}</span><a className="rw-google-link" href={'/api/auth/google?portal='+encodeURIComponent(role==='platform-admin'?'platform_admin':role)+'&intent=link'}>Link Google account</a>{btn('Sign out',()=>{void signout()},true)}</div></div>
 <nav className="rw-portal-switch" aria-label={`${title} workspace navigation`}><span aria-current="page">{title} workspace</span></nav>
 {message&&<div className="rw-message" role="status">{message}<button onClick={()=>setMessage('')}>×</button></div>}
 
 {role==='platform-admin'&&<div className={['rw-workspace-shell','ep-admin-workspace',adminNavCollapsed?'is-collapsed':''].filter(Boolean).join(' ')}>
  {adminMenuOpen&&<button type="button" className="ep-admin-drawer-scrim" aria-label="Close administrator menu" onClick={()=>setAdminMenuOpen(false)}/>}
  <aside id="platform-admin-navigation" className={['rw-panel','ep-admin-sidebar',adminMenuOpen?'is-open':'',adminNavCollapsed?'is-collapsed':''].filter(Boolean).join(' ')}>
   <div className="ep-admin-side-brand"><span className="ep-admin-side-symbol">◈</span><span className="ep-admin-side-label"><b>NEXX EVENTPASS</b><small>Administration</small></span><button type="button" className="ep-admin-side-close" aria-label="Close administrator menu" onClick={()=>setAdminMenuOpen(false)}>×</button></div>
   <div className="eyebrow ep-admin-nav-caption">WORKSPACE</div>
   <nav aria-label="Platform administration" style={{display:'grid',gap:6}}>{adminMenuItems.map(([key,label,glyph])=>
    <button type="button" key={key} className={adminTab===key?'primary':'ghost'} aria-label={label} aria-current={adminTab===key?'page':undefined} title={label} onClick={()=>navigateAdmin(key)}>
     <span className="ep-admin-nav-icon" aria-hidden="true">{glyph}</span><span className="ep-admin-nav-label">{label}</span>
     {key==='support'&&cases.filter(c=>['open','in_progress'].includes(c.status)).length>0&&<span className="ep-admin-nav-count">{cases.filter(c=>['open','in_progress'].includes(c.status)).length}</span>}
    </button>)}</nav>
   <div className="ep-admin-side-footer"><small>Signed in securely</small><strong>{me.email}</strong></div>
  </aside>
  <div className="rw-layout ep-admin-main" style={{minWidth:0}}>
   <header className="ep-admin-main-header">
    <div className="ep-admin-main-leading">
     <button type="button" className="ep-admin-menu-trigger" aria-controls="platform-admin-navigation" aria-expanded={adminMenuOpen} aria-label="Open or collapse administrator sidebar" onClick={()=>{
      if(window.matchMedia('(max-width: 900px)').matches)setAdminMenuOpen(x=>!x);else setAdminNavCollapsed(x=>!x);
     }}><span aria-hidden="true">☰</span> <span>Menu</span></button>
     <div className="ep-admin-page-title"><div className="eyebrow">PLATFORM / {adminTab==='overview'?'DASHBOARD':'WORKSPACE'}</div><h1>{adminMenuItems.find(([key])=>key===adminTab)?.[1]||'Dashboard'}</h1></div>
    </div>
    <div className="ep-admin-header-status"><span className="ep-admin-status-dot" aria-hidden="true"/> Live database <small>{me.full_name}</small></div>
   </header>
  <section className="rw-panel ep-admin-dashboard" style={{display:adminTab==='overview'?'':'none'}}><div className="ep-admin-dashboard-welcome"><div><div className="eyebrow">WELCOME TO YOUR COMMAND CENTRE</div><h2>Good to see you, {me.full_name}</h2><p>Review live performance, resolve pending work and manage EventPass from the menu.</p></div><span className="ep-admin-live-label">Platform Administrator</span></div><div className="ep-admin-section-heading"><div><div className="eyebrow">OPERATIONS AT A GLANCE</div><h2 id="admin-overview">Platform overview</h2><p>Live operational totals across organisers, reservations, tickets and admission activity.</p></div><span className="ep-admin-live-label">Database-backed</span></div><p className="ep-admin-metric-note">Verified collections are confirmed payments only. Offline sales are manually recorded, not necessarily received. Refund exposure reflects open review cases, not approved payouts.</p><div className="rw-stats ep-admin-kpis">{Object.entries(stats).map(([k,v])=><div className="rw-stat ep-admin-kpi" key={k}><small>{({verified_collections_ngn:'Verified collections',verified_commissions_ngn:'Verified platform commissions',commission_outstanding_ngn:'Outstanding commission remittance',manual_offline_sales_ngn:'Manually recorded offline sales',refund_review_exposure_ngn:'Unresolved refund exposure'} as Record<string,string>)[k]||k.replace(/_/g,' ')}</small><b>{k.endsWith('_ngn')?'₦'+Number(v).toLocaleString('en-NG'):Number(v).toLocaleString('en-NG')}</b><span className="ep-admin-kpi-rule" aria-hidden="true"/></div>)}</div>
  <div className="ep-admin-section-heading"><div><div className="eyebrow">LIVE WORK QUEUE</div><h3>Requires administrator attention</h3><p>Open a section below to resolve records in the database. These are not demo tasks.</p></div>{btn('Refresh dashboard',()=>{void run(async()=>{await fetchAll();setMessage('Live administrator dashboard refreshed')})},true)}</div>
  <div className="ep-admin-queues">
   {([
    ['Organiser applications',organisers.filter(o=>o.role==='user'&&o.requested_role==='organiser').length,'organisers'],
    ['Bank verification requests',Number(stats.pending_bank_reviews||0),'refunds'],
    ['Event / media reviews',moderationEvents.length+moderationMedia.length,'moderation'],
    ['Open support cases',cases.filter(c=>['open','in_progress'].includes(c.status)).length,'support'],
    ['Unresolved refund cases',refundCases.filter(r=>['review_required','initiated'].includes(r.refund_status)).length,'refunds']
   ] as [string,number,string][]).map(([label,count,tab])=><button type="button" key={label} className="ep-admin-queue-item" onClick={()=>setAdminTab(tab)}>
    <span className="ep-admin-queue-count">{count}</span><span>{label}</span><strong aria-hidden="true">›</strong>
   </button>)}
  </div>
  <div className="ep-admin-section-heading"><div><h3>Operational shortcuts</h3><p>All shortcuts open their connected administrative workspaces.</p></div></div>
  <div className="ep-admin-shortcuts">
   {([['Review organisers','organisers'],['Moderate events','moderation'],['Manage accounts','users'],['Payments & reconciliation','refunds'],['Support desk','support'],['Event analytics','reports'],['Audit history','audit'],['Platform settings','settings']] as [string,string][]).map(([label,tab])=><button type="button" key={tab} className="ghost" onClick={()=>setAdminTab(tab)}>{label} <span aria-hidden="true">›</span></button>)}
  </div>
  <h3>Recent support activity</h3>
  {cases.slice(0,4).map(c=><button type="button" className="ep-admin-recent-case" key={c.id} onClick={()=>{setSelectedSupportId(c.id);setSupportDrafts(p=>({...p,[c.id]:p[c.id]||{priority:c.priority,resolution:c.resolution||''}}));setAdminTab('support')}}><strong>{c.subject}</strong><small>{c.organiser_name} · {c.status.replace('_',' ')} · {c.priority}</small><span>Review case</span></button>)}
  {!cases.length&&<p>No support requests recorded.</p>}
  </section>
  <section className="rw-panel rw-wide" style={{display:adminTab==='reports'?'':'none'}}><div className="eyebrow">MULTI-TENANT BUSINESS INTELLIGENCE</div><h2 id="admin-reports">All organiser events and revenue</h2>
   <p>Inspect any event's available capacity, live reservations, issued tickets, attendance, revenue, refunds and assigned operators.</p>
   <div className="rw-market-filters">{input('Search event or organiser',reportSearch,setReportSearch)}{btn('Search reports',()=>{void refreshReports()})}</div>
   {eventReports.map(e=><div className="rw-list-item" key={e.id}>
    <div><b>{e.title}</b><p>{e.organiser_name} · {e.status} / {e.verification_status}</p><small>{e.checked_in} admitted · {e.tickets_issued} issued · {e.reserved_seats} temporarily reserved · {money(e.confirmed_revenue_ngn)} confirmed</small></div>
    {btn(selectedReport===e.id?'Close':'Event details',()=>setSelectedReport(selectedReport===e.id?'':e.id),true)}
    {selectedReport===e.id&&<div className="rw-profile" style={{width:'100%'}}>
     <h3>Event operations</h3><p>Venue: {e.venue}</p>
     <div className="rw-stats"><div className="rw-stat"><b>{e.capacity}</b><small>Capacity</small></div>
      <div className="rw-stat"><b>{e.tickets_issued}</b><small>Issued · {e.external_tickets_issued} external</small></div>
      <div className="rw-stat"><b>{e.reserved_seats}</b><small>Reservations</small></div>
      <div className="rw-stat"><b>{e.checked_in}</b><small>Check-ins</small></div>
      <div className="rw-stat"><b>{e.refund_cases}</b><small>Refund cases</small></div>
      <div className="rw-stat"><b>{e.active_gate_operators}</b><small>Gate operators</small></div></div>
     <p>Available: <strong>{Math.max(0,e.capacity-e.tickets_issued-e.reserved_seats)}</strong> · Confirmed revenue: <strong>{money(e.confirmed_revenue_ngn)}</strong></p>
    </div>}
   </div>)}
   {!eventReports.length&&<p>No events match this search.</p>}
  </section>
  {adminTab==='refunds'&&<><section className="rw-panel rw-wide">
    <h2>Organiser bank account verification</h2>
    <p>Confirm the bank, beneficiary and account number independently before verifying.</p>
    {!bankAccounts.length&&<p>No accounts submitted.</p>}
    {bankAccounts.map(account=><div className="rw-list-item" key={account.id}>
      <div><strong>{account.organiser_name} · {account.status}</strong><p>{account.bank_name} · {account.account_name}</p><p>{account.account_number}</p>{account.review_note&&<p>{account.review_note}</p>}</div>
      {account.status==='pending'&&<form className="rw-actions" onSubmit={event=>{
       event.preventDefault();
       const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
       const note=String(new FormData(event.currentTarget).get('note')||'').trim();
       const decision=submitter?.value;
       if(!decision)return;
       if(decision==='rejected'&&!note){setMessage('Enter a reason for rejection');return}
       void reviewBank(account.id,decision,note);
      }}>
       <label className="rw-field">Review note<input name="note" maxLength={500}/></label>
       <button type="submit" className="primary" value="verified" disabled={busy}>Verify account</button>
       <button type="submit" className="ghost" value="rejected" disabled={busy}>Reject account</button>
      </form>}
    </div>)}
  </section><FinanceLedger admin/></>}
  <section className="rw-panel rw-wide" style={{display:adminTab==='refunds'?'':'none'}}><div className="eyebrow">PAYMENT EXCEPTIONS</div><h2>Refund and reconciliation desk</h2>
   <p>Expired reservations with payment evidence and rejected paid orders require manual settlement checks. Mark refunded only after verifying the transfer back to the buyer.</p>
   <p>Use each order’s own settlement reference; review, initiate and verify settlement in sequence.</p>
   {refundCases.map(r=><div key={r.id} className="rw-list-item"><div><b>{r.event_title} — {money(r.amount_ngn)}</b>
    <p>{r.buyer_email} · {r.refund_status} · {r.status}</p><small>{r.organiser_name||''} · {r.refund_note||'Not yet reconciled'}</small></div>
    <div className="rw-actions">
     {r.refund_status==='not_required'&&btn('Open review',()=>{void updateRefund(r.id,'review_required')},true)}
     {r.refund_status==='review_required'&&btn('Refund initiated',()=>{if(window.confirm('Record that repayment has been initiated for '+r.buyer_email+'?'))void updateRefund(r.id,'initiated')},true)}
     {r.refund_status==='initiated'&&<>
      <label className="rw-field">Verified settlement reference for {r.buyer_email}<input maxLength={500} value={refundNotes[r.id]||''} onChange={e=>setRefundNotes(p=>({...p,[r.id]:e.target.value}))}/></label>
      {btn('Mark settled',()=>{if((refundNotes[r.id]||'').trim().length<10){setMessage('Add a verified transfer reference for this order (10+ characters)');return}if(window.confirm('Confirm you independently verified refund settlement for '+r.buyer_email+'?'))void updateRefund(r.id,'settled')})}
     </>}
     {r.refund_status==='settled'&&<span>Settlement recorded — read only</span>}
    </div></div>)}
   {!refundCases.length&&<p>No payment exceptions are currently recorded.</p>}
  </section>
  <section className="rw-panel rw-wide" style={{display:adminTab==='users'?'':'none'}}><div className="eyebrow">MULTI-TENANT CRM</div><h2>User and operator directory</h2>
   <p>Search accounts and open a profile to view tickets, event activity and gate assignments. Deactivation preserves financial and admission audit records.</p>
   <div className="rw-market-filters">{input('Search name or email',userSearch,setUserSearch)}
    <select value={userFilter} aria-label="Filter by role" onChange={e=>setUserFilter(e.target.value)}><option value="">All roles</option><option value="user">Users / Gate identities</option><option value="organiser">Organisers</option><option value="platform_admin">Administrators</option></select>
    {btn('Search users',()=>{void searchAdminUsers(1)})}</div>
   <p>{usersCount} accounts · page {userPage}</p>
   {allUsers.map(a=><div key={a.id} className="rw-list-item"><div><strong>{a.full_name}</strong><p>{a.email}</p><small>{a.role} · {a.account_status} · {a.google_verified?'Google verified':'Unlinked'} · {a.ticket_count} tickets · {a.gate_event_count} gates</small></div>{btn('Open profile',()=>chooseUser(a.id),true)}</div>)}
   <div className="rw-actions">{userPage>1&&btn('Previous',()=>{void searchAdminUsers(userPage-1)},true)}{userPage*40<usersCount&&btn('Next',()=>{void searchAdminUsers(userPage+1)},true)}</div>
   {selectedUser&&allUsers.filter(a=>a.id===selectedUser).map(a=><div key={a.id} className="rw-profile" style={{border:'2px solid #7355d5',borderRadius:16,padding:20,marginTop:20}}><button type="button" onClick={()=>setSelectedUser('')}>Close profile ×</button><h3>Account: {a.full_name}</h3><p>{a.email} · {a.role} · {a.account_status} · joined {nice(a.created_at)}</p>
    <div className="rw-stats"><div className="rw-stat"><b>{a.order_count}</b><small>Orders</small></div><div className="rw-stat"><b>{a.ticket_count}</b><small>Tickets</small></div><div className="rw-stat"><b>{a.event_count}</b><small>Events</small></div><div className="rw-stat"><b>{a.gate_event_count}</b><small>Gates</small></div></div>
    {a.role==='platform_admin'?<p>Other administrators cannot be modified from this directory.</p>:<>
    {input('Full name',userEditName,setUserEditName)}{btn('Save profile',()=>{void changeUser('configure')})}
    {a.account_status==='active'?btn('Suspend',()=>{void changeUser('suspend')},true):btn('Restore access',()=>{void changeUser('restore')})}
    {input('Reason for deactivation',accountReason,setAccountReason)}{btn('Deactivate account',()=>{void changeUser('deactivate')},true)}
    </>}</div>)}
  </section>
  <section className="rw-panel rw-wide ep-admin-support" style={{display:adminTab==='support'?'':'none'}}><div className="eyebrow">SUPPORT OPERATIONS</div><h2>Support cases & resolutions</h2>
   <p>Every decision is tied to an individual case, saved to PostgreSQL and audited. Open a case to inspect its details and update priority or status.</p>
   <div className="rw-stats">
    <div className="rw-stat"><b>{cases.filter(c=>['open','in_progress'].includes(c.status)).length}</b><small>Needs attention</small></div>
    <div className="rw-stat"><b>{cases.filter(c=>c.priority==='urgent'&&c.status!=='closed'&&c.status!=='resolved').length}</b><small>Urgent</small></div>
    <div className="rw-stat"><b>{cases.filter(c=>c.status==='resolved').length}</b><small>Resolved</small></div>
   </div>
   {btn('Refresh support cases',()=>{void run(async()=>{const r=await api('support/cases');setCases(r.cases||[]);setMessage('Support inbox refreshed')})},true)}
   {cases.map(c=><div className="rw-list-item ep-admin-support-case" key={c.id}>
    <div><b>{c.subject}</b><p>{c.organiser_name} · <strong>{c.status.replace('_',' ')}</strong> · {c.priority} priority</p>
     <small>{c.description}</small>{c.payment_order_id&&<p><a href={'/api/orders/receipt?orderId='+c.payment_order_id} target="_blank" rel="noreferrer">Review linked payment evidence</a></p>}
     {c.resolution&&<p>Latest resolution: {c.resolution}</p>}
    </div>
    {btn(selectedSupportId===c.id?'Close case details':'Open case / take action',()=>openSupportCaseEditor(c),true)}
    {selectedSupportId===c.id&&<div className="rw-profile" style={{width:'100%'}}>
     <h3>Case: {c.subject}</h3><p>Assigned status: {c.status} · Case reference: <code>{c.id}</code></p>
     <label className="rw-field">Case priority<select aria-label={'Priority for '+c.subject} value={(supportDrafts[c.id]||{priority:c.priority}).priority} onChange={e=>setSupportDrafts(p=>({...p,[c.id]:{priority:e.target.value,resolution:p[c.id]?.resolution||c.resolution||''}}))}>
      {['low','normal','high','urgent'].map(level=><option key={level} value={level}>{level}</option>)}</select></label>
     <label className="rw-field">Resolution / guidance for this case<textarea rows={4} minLength={10} maxLength={1500} value={(supportDrafts[c.id]||{resolution:c.resolution||''}).resolution} onChange={e=>setSupportDrafts(p=>({...p,[c.id]:{priority:p[c.id]?.priority||c.priority,resolution:e.target.value}}))} placeholder="Record actions taken, the outcome and any next steps"/></label>
     <div className="rw-actions">
      {c.status!=='in_progress'&&c.status!=='closed'&&btn('Start investigation',()=>{void updateCase(c,'in_progress')},true)}
      {c.status!=='resolved'&&c.status!=='closed'&&btn('Resolve case',()=>{void updateCase(c,'resolved')})}
      {c.status==='resolved'&&btn('Close resolved case',()=>{void updateCase(c,'closed')},true)}
      {['resolved','closed'].includes(c.status)&&btn('Reopen case',()=>{void updateCase(c,'open')},true)}
      {btn('Save priority / notes',()=>{void updateCase(c,c.status as 'open'|'in_progress'|'resolved'|'closed')},true)}
     </div>
    </div>}
   </div>)}
   {!cases.length&&<p>No support requests are currently recorded.</p>}
  </section>
  <section className="rw-panel rw-wide" style={{display:adminTab==='settings'?'':'none'}}><div className="eyebrow">PLATFORM CONFIGURATION</div><h2>Operational settings</h2>
   <p>Set organiser onboarding policy, event authenticity checks, support email, and help instructions. API credentials are managed in hosting environment variables.</p>
   <label className="rw-field">Setting<select value={settingKey} onChange={e=>{setSettingKey(e.target.value);setSettingValue(platformSettings[e.target.value]||'')}}>
    <option value="support_email">Support contact email</option><option value="organiser_approval_policy">Organiser approval checklist</option>
    <option value="event_verification_policy">Event authenticity checklist</option><option value="help_text">Help text</option></select></label>
   <label className="rw-field">Value<textarea rows={3} value={settingValue} onChange={e=>setSettingValue(e.target.value)}/></label>{btn('Save settings',()=>{void saveSetting()})}
  </section>
  <section className="rw-panel" style={{display:adminTab==='organisers'?'':'none'}}><h2>Organiser directory and access control</h2><div className="rw-profile" style={{margin:'12px 0 20px'}}>
   <h3>Approve verified organiser onboarding</h3><p>Only a previously registered, Google-verified User can become an organiser. This action uses the administrator approval API and never creates default passwords.</p>
   {input('Existing verified User email',newOrganiser,setNewOrganiser,'email')}
   {btn('Create verified organiser',()=>{void adminAction('create')})}
  </div>
   <p>Select <strong>View / edit profile</strong> to inspect an organiser, update their details, change permissions, or revoke access. Changes are saved through the administrator API and audited.</p><div className="rw-actions">{btn('Refresh organisers',()=>{void run(async()=>{const r=await api('platform/organisers');setOrganisers(r.organisers||[]);setMessage('Organiser directory refreshed')})},true)}{btn('Find users',()=>{setAdminTab('users');void searchAdminUsers(1)},true)}</div>
   {organisers.map(o=><div className="rw-list-item" key={o.id}>
    <div><b>{o.full_name}</b><p>{o.email}</p><small>{o.role==='user'&&o.requested_role==='organiser'?'PENDING APPROVAL':o.account_status.toUpperCase()} · {o.event_count} events · {o.tickets_issued} tickets · {o.gate_operators} operators</small></div>
    <div className="rw-actions">
    {btn(selectedOrganiser===o.id?'Close profile':'View / edit profile',()=>selectedOrganiser===o.id?setSelectedOrganiser(''):chooseOrganiser(o.id),true)}
    {o.role==='user'&&o.requested_role==='organiser'&&<>{btn('Approve',()=>{void adminAction('approve',o.id)})}
    {rejectOrganiserId===o.id?<div className="rw-actions" style={{display:'grid',gap:8}}><label className="rw-field">Reason for rejecting this application<textarea rows={3} maxLength={400} minLength={10} required value={rejectOrganiserReason} onChange={e=>setRejectOrganiserReason(e.target.value)} /></label>
    {btn('Confirm rejection',()=>{void adminAction('reject',o.id)},true)}{btn('Cancel rejection',()=>{setRejectOrganiserId('');setRejectOrganiserReason('')},true)}</div>
    :btn('Reject',()=>{setRejectOrganiserId(o.id);setRejectOrganiserReason('')},true)}</>}
    {o.role==='organiser'&&o.account_status==='active'&&btn('Revoke access',()=>{void adminAction('revoke',o.id)},true)}
    {o.role==='organiser'&&o.account_status==='suspended'&&btn('Restore access',()=>{void adminAction('restore',o.id)})}
    </div></div>)}
   {!organisers.length&&<p>No organiser applicants or approved accounts yet.</p>}
   {selectedOrganiser&&organisers.filter(o=>o.id===selectedOrganiser).map(o=><div className="rw-profile" key={o.id} style={{border:'2px solid #7355d5',borderRadius:16,padding:20,marginTop:20}}><div className="rw-actions"><button type="button" onClick={()=>setSelectedOrganiser('')}>Close profile ×</button><button type="button" onClick={()=>{setUserSearch(o.email);setUserFilter('');setAdminTab('users');void api('platform/users?q='+encodeURIComponent(o.email)+'&page=1').then(r=>{setAllUsers(r.accounts||[]);setUsersCount(r.count||0);setUserPage(1);setSelectedUser(o.id);setUserEditName(o.full_name)}).catch(e=>setMessage((e as Error).message))}}>Open full account record</button></div>
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
      <h3>Tenant permissions</h3><p>Disable a sensitive capability without suspending the entire organiser account. Every change is audited.</p>
      <label className="rw-field"><input type="checkbox" checked={canCreate} onChange={e=>setCanCreate(e.target.checked)}/> Create or edit events</label>
      <label className="rw-field"><input type="checkbox" checked={canGates} onChange={e=>setCanGates(e.target.checked)}/> Invite or add gate operators</label>
      <label className="rw-field"><input type="checkbox" checked={canPayments} onChange={e=>setCanPayments(e.target.checked)}/> Approve or reject payments</label>
      {btn('Save tenant permissions',()=>{void saveCapabilities()})}
      <h3>Configure organiser profile</h3>
      {input('Display name',editName,setEditName)}
      {btn('Save organiser configuration',()=>{void configureOrganiser()})}
    </>:<p>This applicant is not approved. Approve before configuring the organiser profile.</p>}
   </div>)}
  </section>  <section className="rw-panel rw-wide" style={{display:adminTab==='themes'?'':'none'}}><div className="eyebrow">TICKET DESIGN SERVICE</div><h2>Publish new ticket themes</h2>
   <p>Approved designs appear in every organiser's theme selector without requiring an application update. Custom artwork remains available.</p>
   {input('Theme name',newThemeName,setNewThemeName)}{input('Theme label',newThemeLabel,setNewThemeLabel)}
   <div className="rw-media-inputs"><label className="rw-field">First colour<input type="color" value={themeColorA} onChange={e=>setThemeColorA(e.target.value)}/></label>
    <label className="rw-field">Second colour<input type="color" value={themeColorB} onChange={e=>setThemeColorB(e.target.value)}/></label>
    <label className="rw-field">Accent colour<input type="color" value={themeAccent} onChange={e=>setThemeAccent(e.target.value)}/></label></div>
   <div className="rw-theme-grid">{themeCatalog.map(t=><div key={t.id} className="rw-theme-option" style={{background:t.gradient}}><strong>{t.name}</strong><small>{t.label}</small></div>)}</div>
   {btn('Add theme to catalogue',()=>{void addNewTicketTheme()})}
  </section>
  <section className="rw-panel rw-wide" style={{display:adminTab==='audit'?'':'none'}}><div className="eyebrow">AUDIT TRAIL</div><h2>Recent administrator actions</h2>
    {auditHistory.map(h=><div key={h.id} className="rw-list-item"><div><b>{h.action.replaceAll('_',' ')}</b>
      <p>{h.performed_by} · {nice(h.created_at)}</p><small>{h.target_email||'Platform event or setting'} · {JSON.stringify(h.details||{})}</small></div></div>)}
    {!auditHistory.length&&<p>No administrator actions logged.</p>}
  </section>
  <section className="rw-panel rw-wide" style={{display:adminTab==='moderation'?'':'none'}}><div className="eyebrow">EVENT AUTHENTICITY</div><h2>Review organiser listings and media</h2>
   <p>Verify the identity, location, date, marketing materials and ticket promises before publishing an event to the public marketplace.</p>
   {moderationEvents.map(ev=><div className="rw-review-card" key={ev.id}>
     <div><strong>{ev.title}</strong><p>{ev.venue} · {nice(ev.starts_at)}</p><small>Submitted by {ev.organiser_name} ({ev.organiser_email})</small><p>Listing: {ev.verification_status} · {ev.pending_media} unreviewed assets</p></div>
     {!ev.owner_eligible&&ev.status!=='cancelled'&&<form className="rw-layout" onSubmit={e=>{e.preventDefault();void correctEventOwner(ev,e.currentTarget)}}>
      <strong>Correct event owner</strong>
      <p>The listing is unavailable for booking. Correcting the owner returns it to draft and clears its payment settings.</p>
      <label>Confirmed organiser email<input name="organiserEmail" type="email" required maxLength={254}/></label>
      <label>Reason and verification reference<textarea name="reason" required minLength={12} maxLength={500}/></label>
      <label><input name="ownershipConfirmed" type="checkbox" required/> I confirmed this organiser owns the event.</label>
      <button className="primary" type="submit">Correct owner</button>
     </form>}
     <div className="rw-actions">{ev.owner_eligible&&ev.verification_status!=='verified'&&<>{btn('Verify & publish',()=>{void moderateEvent(ev.id,'verify')})}{btn('Reject listing',()=>{void moderateEvent(ev.id,'reject')},true)}</>}</div>
     <div className="rw-gallery">{moderationMedia.filter(m=>m.event_id===ev.id).map(m=><div className="rw-media-card" key={m.id}>
       {m.media_type==='video'?<video src={m.url} playsInline controls preload="metadata"/>:<img src={m.url} alt={m.file_name}/>}
       <small>{m.file_name}</small><div className="rw-actions">{btn('Approve',()=>{void moderateEvent(ev.id,'approve_media',m.id)})}{btn('Reject',()=>{void moderateEvent(ev.id,'reject_media',m.id)},true)}</div>
     </div>)}</div>
   </div>)}
   {!moderationEvents.length&&<p>No pending event or media submissions.</p>}
  </section></div></div>}
 {role==='organiser'&&inbox.unread>0&&<div className="rw-message" role="status">
  <span>{inbox.unread} new payment {inbox.unread===1?'receipt needs':'receipts need'} review.</span>
  <button type="button" onClick={()=>setOrganiserTab('payments')}>Open pending payments</button>
 </div>}
 {role==='organiser'&&<div className="rw-workspace-shell"><nav className="rw-panel" aria-label="Organiser navigation" style={{display:'grid',gap:8,alignContent:'start',position:'sticky',top:16,padding:12}}><div className="eyebrow" style={{padding:8}}>ORGANISER WORKSPACE</div>
   {(['dashboard','events','tickets','offline','payments','team','profile','settings'] as const).map(tab=><button key={tab} type="button" className={organiserTab===tab?'primary':'ghost'} aria-current={organiserTab===tab?'page':undefined} onClick={()=>setOrganiserTab(tab)} style={{textTransform:'capitalize',textAlign:'left',padding:12}}>{tab==='tickets'?'Ticket Studio':tab==='offline'?'Offline Ticketing':tab==='team'?'Gate Management':tab==='payments'?'Payments & Bank Details':tab==='dashboard'?'Overview':tab}</button>)}
  </nav><div className="rw-layout" style={{minWidth:0}}>
  <section className="rw-panel rw-wide" aria-label="Active organiser event" style={{padding:16}}>
    <div className="eyebrow">ACTIVE EVENT CONTEXT</div>
    <label className="rw-field">Choose the event for payments, ticket design and gate management
      <select value={eventId} onChange={e=>{
        const id=e.target.value;setEventId(id);setOrders([]);setScans([]);setEventMedia([]);setLatestInvite('');
        const selected=events.find(ev=>ev.id===id);
        if(selected){setEventDescription(selected.description||'');setEventCategory(selected.category||'Other');setTicketTheme(selected.ticket_theme||'aurora');setAdmissionLabel(selected.admission_label||'ADMIT ONE');setPosterTemplate(selected.poster_template||'none');}
      }}>
        <option value="">Select an event</option>
        {events.filter(e=>e.organiser_id===me?.id).map(e=><option value={e.id} key={e.id}>{e.title} · {e.status} / {e.verification_status||'pending'}</option>)}
      </select>
    </label>
    {eventId&&<div className="rw-actions">{btn('Ticket Studio',()=>setOrganiserTab('tickets'),true)}{btn('Payment approvals',()=>setOrganiserTab('payments'),true)}{btn('Gate team',()=>setOrganiserTab('team'),true)}</div>}
  </section>
  {organiserTab==='offline'&&<OfflineTicketManager events={events} organiserId={me.id}/>}
  {organiserTab==='profile'&&<section className="rw-panel rw-wide"><div className="eyebrow">ORGANISER PROFILE</div><h2>My account</h2><p><strong>Name:</strong> {me?.full_name||'Not set'}</p><p><strong>Email:</strong> {me?.email}</p><p><strong>Account status:</strong> {me?.account_status}</p><p>For changes to verified identity or organiser permissions, contact Platform Support under Settings.</p></section>}
  
  {organiserTab==='dashboard'&&<section className="rw-panel rw-wide" style={{display:organiserTab==='dashboard'?'':'none'}}><div className="eyebrow">ORGANISER DASHBOARD</div><h2>Welcome, {me?.full_name||'Organiser'}</h2><p>Manage your events, tickets, payments and admissions from one place.</p><div className="rw-stats">
   <div className="rw-stat"><b>{events.filter(e=>e.organiser_id===me?.id).length}</b><small>My events</small></div>
   <div className="rw-stat"><b>{eventReports.reduce((n,e)=>n+Number(e.tickets_issued||0),0)}</b><small>Tickets issued</small></div>
   <div className="rw-stat"><b>{eventReports.reduce((n,e)=>n+Number(e.pending_orders||0),0)}</b><small>Pending payments</small></div>
   <div className="rw-stat"><b>{eventReports.reduce((n,e)=>n+Number(e.checked_in||0),0)}</b><small>Admissions</small></div>
   <div className="rw-stat"><b>{money(eventReports.reduce((n,e)=>n+Number(e.confirmed_revenue_ngn||0),0))}</b><small>Confirmed revenue</small></div>
   <div className="rw-stat"><b>{gateOperators.length}</b><small>Assigned gate operators</small></div></div>
   <div className="rw-actions">{btn('Manage events',()=>setOrganiserTab('events'))}{btn('Review payments',()=>setOrganiserTab('payments'),true)}{btn('Manage gate team',()=>setOrganiserTab('team'),true)}</div>
   <h3>Recent events</h3>{eventReports.slice(0,5).map(e=><div className="rw-list-item" key={e.id}><div><b>{e.title}</b><p>{e.tickets_issued} tickets issued · {e.checked_in} admitted · {money(e.confirmed_revenue_ngn)}</p></div></div>)}
   {!eventReports.length&&<p>No events yet. Open Events to create your first event.</p>}
  </section>}
  <section className="rw-panel" style={{display:organiserTab==='settings'?'':'none'}}><div className="eyebrow">ORGANISER HELPDESK</div><h2>Get Platform Support</h2><p>Report issues with event verification, bank payments, QR tickets, or gate staff. Only you and Platform Admin can see your cases.</p>
   {input('Subject',caseSubject,setCaseSubject)}
   <label className="rw-field">Description<textarea rows={3} value={caseDescription} onChange={e=>setCaseDescription(e.target.value)}/></label>
   <label className="rw-field">Priority<select value={casePriority} onChange={e=>setCasePriority(e.target.value)}>{['low','normal','high','urgent'].map(x=><option key={x}>{x}</option>)}</select></label>{btn('Create support request',()=>{void openSupportCase()})}
   {cases.map(c=><div className="rw-list-item" key={c.id}><div><b>{c.subject}</b><p>{c.status} · {c.priority}</p>{c.resolution&&<p>Response: {c.resolution}</p>}</div></div>)}
  </section>
  <section className="rw-panel rw-wide" style={{display:organiserTab==='dashboard'?'':'none'}}><div className="eyebrow">ORGANISER REPORTS</div><h2>My event operations</h2>
   {eventReports.map(e=><div key={e.id} className="rw-list-item"><div><b>{e.title}</b><p>{e.tickets_issued} issued · {e.reserved_seats} reserved · {e.checked_in} admitted · {e.refund_cases} refund cases</p>
    <small>{money(e.confirmed_revenue_ngn)} confirmed revenue · Available {Math.max(0,e.capacity-e.tickets_issued-e.reserved_seats)} of {e.capacity}</small></div></div>)}
   {!eventReports.length&&<p>Event reporting will appear after you create an event.</p>}
  </section>
  {organiserTab==='payments'&&<section className="rw-panel rw-wide" aria-label="Pending payments">
   <h2>Pending payments ({inbox.pending})</h2>
   <p>A buyer submitted a receipt for each payment below. Confirm that funds arrived before approving.</p>
   <div className="rw-actions">
    {btn('Refresh pending payments',()=>{void run(refreshInbox)},true)}
    {inbox.unread>0&&btn('Mark notifications read',()=>{void run(async()=>{await api('organiser/payment-inbox','PATCH');await refreshInbox()})},true)}
   </div>
   {!inbox.payments.length&&<p>No receipts awaiting review.</p>}
   {inbox.payments.map(payment=><article key={payment.id} className="rw-list-item">
    <div><strong>{payment.event_title}</strong> {!payment.read_at&&<small>· New receipt</small>}
     <p>{payment.buyer_name} · {money(payment.amount_ngn)} · {payment.payment_reference}</p>
     <p>Review by {nice(payment.reservation_expires_at)}</p>
     <a href={'/api/orders/receipt?orderId='+payment.id} target="_blank" rel="noreferrer">View submitted receipt</a>
    </div>
    <div className="rw-actions">
     {btn('Approve verified payment',()=>{if(window.confirm('Have you confirmed that the funds reached the account?'))void review(payment.id,'approved')})}
     {btn('Reject payment',()=>{if(window.confirm('Reject this payment and keep the receipt available for support?'))void review(payment.id,'rejected')},true)}
    </div>
   </article>)}
  </section>}
  {organiserTab==='payments'&&<FinanceLedger key={orders.filter(order=>order.status==='approved').length} admin={false}/>}
  <section className="rw-panel rw-wide" style={{display:organiserTab==='payments'?'':'none'}}><h2 id="admin-refunds">Payment exceptions and refunds</h2>
   <p>Enter settlement evidence separately for each order before confirming a transfer.</p>
   {refundCases.map(r=><div key={r.id} className="rw-list-item"><div><b>{r.event_title}</b><p>{money(r.amount_ngn)} · {r.refund_status}</p><small>{r.buyer_email} · {r.refund_note||'Check bank settlement before taking action'}</small></div>
    <div className="rw-actions">
     {r.refund_status==='not_required'&&btn('Open review',()=>void updateRefund(r.id,'review_required'),true)}
     {r.refund_status==='review_required'&&btn('Refund initiated',()=>{if(window.confirm('Record initiation of repayment for '+r.buyer_email+'?'))void updateRefund(r.id,'initiated')},true)}
     {r.refund_status==='initiated'&&<><label className="rw-field">Verified settlement reference for {r.buyer_email}<input maxLength={500} value={refundNotes[r.id]||''} onChange={e=>setRefundNotes(p=>({...p,[r.id]:e.target.value}))}/></label>
     {btn('Mark settled',()=>{if((refundNotes[r.id]||'').trim().length<10){setMessage('Provide this order’s verified settlement reference (10+ characters)');return}if(window.confirm('Confirm independently verified refund settlement for '+r.buyer_email+'?'))void updateRefund(r.id,'settled')})}</>}
     {r.refund_status==='settled'&&<span>Settlement recorded — read only</span>}
    </div></div>)}
  </section>
  <section className="rw-panel rw-wide" id="organiser-payments" style={{display:organiserTab==='payments'?'':'none'}}>
   <h2>Organiser bank accounts</h2>
   <p>Submit each account for Platform Admin verification. Verified accounts can be reused across your paid events.</p>
   {bankAccounts.map(account=><div className="rw-list-item" key={account.id}>
    <div><strong>{account.bank_name} · {account.status}</strong><p>{account.account_name} · {account.account_number}</p>{account.review_note&&<p>{account.review_note}</p>}</div>
   </div>)}
   <h3>Add bank account</h3>
   {input('Bank name',bankName,setBankName)}{input('Account holder name',accountName,setAccountName)}{input('Account number',accountNumber,setAccountNumber)}
   {btn('Submit bank account for review',()=>{void saveBank()})}
  </section>
  <section className="rw-panel" style={{display:organiserTab==='events'?'':'none'}}><div className="eyebrow">EVENT STUDIO</div><h2>Create and design an event</h2><p>Create as many events as you need. Your listing is reviewed before it appears publicly.</p>
  <label className="rw-field">Event visibility
  <select value={eventVisibility} onChange={e=>setEventVisibility(e.target.value)}>
   <option value="public">Public — EventPass marketplace</option>
   <option value="unlisted">Unlisted — not public discovery</option>
   <option value="private">Private external — offline tickets only</option>
  </select></label>
  <p>{eventVisibility==='private'?'Private events are managed by their organiser and do not appear in public discovery.':eventVisibility==='unlisted'?'Unlisted events are hidden from discovery.':'Public events require platform verification before discovery.'}</p>
  {input('Event name',eventTitle,setEventTitle)}{input('Venue',venue,setVenue)}
  <label className="rw-field">Event description<textarea rows={4} maxLength={2500} value={eventDescription} onChange={e=>setEventDescription(e.target.value)} placeholder="Describe the experience, performers, attractions and ticket benefits"/></label>
  <label className="rw-field">Event category<select value={eventCategory} onChange={e=>setEventCategory(e.target.value)}>{['Music','Nightlife','Festival','Business','Food','Sports','Arts','Education','Community','Other'].map(c=><option key={c}>{c}</option>)}</select></label>
  {input('Date and time',startsAt,setStartsAt,'datetime-local')}{input('Price (NGN)',ticketPrice,setTicketPrice,'number')}{input('Capacity',capacity,setCapacity,'number')}{input('Private encrypted QR keyword (8+ characters)',keyword,setKeyword,'password')}
  {input('Admission label (e.g. ADMIT ONE — MASK COMPULSORY)',admissionLabel,setAdmissionLabel)}
  <details open={showEventDesign} onToggle={e=>setShowEventDesign(e.currentTarget.open)}><summary style={{cursor:"pointer",fontWeight:750,padding:"14px 0"}}>Customize ticket and poster designs (optional)</summary><h3>Ticket design collection</h3>
  <p className="masque-studio-guidance">Luxury ticket layouts inspired by the STJ Masked Party references. Choose a design; your event information is inserted automatically, and a different encrypted QR is added to each buyer's ticket after approval.</p>
  <div className="masque-template-gallery">{masqueradeTemplates.map(t=><button type="button" key={t.id} aria-pressed={ticketTheme===t.id} className={'masque-template-choice '+(ticketTheme===t.id?'selected':'')} onClick={()=>setTicketTheme(t.id)}><TicketDesign compact preview themeId={t.id} title={eventTitle||'Masked Party'} venue={venue||'Your Event Venue'} startsAt={startsAt||'2026-11-29T23:00:00'} priceNgn={Number(ticketPrice)||0} organiser={me?.full_name||'Event Organiser'} admissionLabel={admissionLabel}/><span>{t.name}<small>{ticketTheme===t.id?'✓ Selected':'Select design'}</small></span></button>)}</div>
  <div className="rw-theme-grid">{themeCatalog.map(t=><button key={t.id} type="button" className={'rw-theme-option '+(ticketTheme===t.id?'selected':'')} onClick={()=>setTicketTheme(t.id)} style={{background:t.gradient}}>
  <span>{t.label}</span><strong>{t.name}</strong><small>{ticketTheme===t.id?'✓ Selected':'Preview theme'}</small></button>)}</div>
  <h3>Matching event poster collection</h3>
  <p className="masque-studio-guidance">The two portrait examples are event advertisements, not gate-entry tickets. Choose an optional poster that uses your own event title, date and price.</p>
  <div className="masque-poster-gallery">{masqueradePosterTemplates.map(t=><button type="button" key={t.id} aria-pressed={posterTemplate===t.id} className={'masque-poster-choice '+(posterTemplate===t.id?'selected':'')} onClick={()=>setPosterTemplate(posterTemplate===t.id?'none':t.id)}>
   <EventPosterDesign compact posterId={t.id} title={eventTitle||'Masked Apartment Party'} venue={venue||'Your Event Venue'} startsAt={startsAt||'2026-11-29T23:00:00'} priceNgn={Number(ticketPrice)||0} organiser={me?.full_name||'Event Organiser'} description={eventDescription}/>
   <span>{t.name}{posterTemplate===t.id?' ✓':''}</span></button>)}</div>
  </details>
  {Number(ticketPrice)>0&&<label className="rw-field">Verified bank account for this event
   <select value={eventBankId} onChange={e=>setEventBankId(e.target.value)}><option value="">{verifiedBanks.length?'Choose an account':'No verified account available'}</option>
    {verifiedBanks.map(account=><option key={account.id} value={account.id}>{account.bank_name} · {account.account_number}</option>)}
   </select>
  </label>}
  {Number(ticketPrice)>0&&!verifiedBanks.length&&<button type="button" className="ghost" onClick={()=>setOrganiserTab('payments')}>Add a bank account</button>}
  <button type="button" className="primary" disabled={busy||(Number(ticketPrice)>0&&!eventBankId)} onClick={()=>{void createEvent()}}>Create event for verification</button>
  </section>
  <section className="rw-panel rw-wide" style={{display:organiserTab==='payments'?'':'none'}}><h2>Events and payment approvals</h2><label className="rw-field">Choose an event<select value={eventId} onChange={e=>{const id=e.target.value;setEventId(id);const selected=events.find(ev=>ev.id===id);if(selected){setEventDescription(selected.description||'');setEventCategory(selected.category||'Other');setTicketTheme(selected.ticket_theme||'aurora');setAdmissionLabel(selected.admission_label||'ADMIT ONE');setPosterTemplate(selected.poster_template||'none')}setLatestInvite('')}}><option value="">Select event</option>
  {events.filter(e=>e.organiser_id===me.id).map(e=><option value={e.id} key={e.id}>{e.title}</option>)}</select></label>
  {events.some(event=>event.id===eventId&&event.price_ngn>0)&&<label className="rw-field">Checkout bank account
   <select value={events.find(event=>event.id===eventId)?.payment_account_id||''} disabled={busy} onChange={e=>{
    const paymentAccountId=e.target.value;
    if(paymentAccountId)void run(async()=>{
     await api('events','PATCH',{action:'payment_account',eventId,paymentAccountId});
     await fetchAll();setMessage('Checkout bank account updated');
    });
   }}>
    <option value="" disabled>Choose a verified account</option>
    {verifiedBanks.map(account=><option key={account.id} value={account.id}>{account.bank_name} · {account.account_number}</option>)}
   </select>
  </label>}
  {eventId&&<label className="rw-field"><input type="checkbox" disabled={busy} checked={Boolean(events.find(event=>event.id===eventId)?.onsite_payments_enabled)}
   onChange={e=>{const enabled=e.target.checked;void run(async()=>{
    await api('finance','PATCH',{action:'onsite',eventId,enabled});
    await fetchAll();
   })}}/> Accept onsite payments for this event</label>}
  {orders.map(o=><div className="rw-list-item" key={o.id}><div><b>{o.buyer_name||o.buyer_email||'User'}</b><p>{o.quantity} tickets · {money(o.amount_ngn)} · {o.status}</p>
   <small>Order {o.id}</small>
   <p>{o.payment_method==='onsite'?'Onsite payment':o.payment_method==='free'?'Free ticket':'Bank reference: '+o.payment_reference}</p>
   <p>{o.status==='pending'&&o.reservation_expires_at?('Reservation ends '+nice(o.reservation_expires_at)):''}{o.refund_status&&o.refund_status!=='not_required'?' · Refund: '+o.refund_status:''}</p>
   {o.receipt_uploaded_at&&<a href={'/api/orders/receipt?orderId='+o.id} target="_blank" rel="noreferrer">View submitted receipt</a>}</div>
   {o.status==='pending'&&<div className="rw-actions">
    {o.payment_method==='onsite'?<form onSubmit={e=>{
     e.preventDefault();
     const data=new FormData(e.currentTarget);
     void review(o.id,'approved',{collectedAmountNgn:Number(data.get('amount')),collectionReference:String(data.get('reference'))});
    }}>
      <label className="rw-field">Amount collected onsite (₦)<input type="number" name="amount" min={1} step={1} required/></label>
      <label className="rw-field">Collection reference<input name="reference" minLength={5} maxLength={120} required/></label>
      <button className="primary" type="submit" disabled={busy}>Confirm collection and issue tickets</button>
    </form>:btn('Approve',()=>{void review(o.id,'approved')})}
    {btn('Reject',()=>{void review(o.id,'rejected')},true)}
   </div>}</div>)}
  {!eventId&&<p>Select an event to review payments and assign gate staff.</p>}</section>
  {eventId&&<section className="rw-panel rw-wide" style={{display:organiserTab==='tickets'?'':'none'}}><div className="eyebrow">CREATIVE MANAGER</div><h2>Event media & ticket designs</h2>
    <p>Upload real event posters, image galleries, short videos, or your own ticket artwork. Media appears to Users only after platform review. Image limit 2 MB; video teasers up to 3.5 MB.</p>
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
    <TicketStudioEditor key={eventId} eventId={eventId} eventTitle={events.find(e=>e.id===eventId)?.title||''} venue={events.find(e=>e.id===eventId)?.venue||''} startsAt={events.find(e=>e.id===eventId)?.starts_at||''} priceNgn={events.find(e=>e.id===eventId)?.price_ngn||0} organiser={me?.full_name||''} initialLabel={admissionLabel} onLabelChange={setAdmissionLabel} onThemeChange={setTicketTheme}/>
    <details><summary style={{cursor:'pointer',padding:12,fontWeight:700}}>Promotional poster designs (optional)</summary>
    <div className="masque-poster-gallery">{masqueradePosterTemplates.map(t=><button type="button" key={t.id} aria-pressed={posterTemplate===t.id} className={'masque-poster-choice '+(posterTemplate===t.id?'selected':'')} onClick={()=>setPosterTemplate(posterTemplate===t.id?'none':t.id)}><EventPosterDesign compact posterId={t.id} title={events.find(e=>e.id===eventId)?.title||eventTitle||'Event'} venue={events.find(e=>e.id===eventId)?.venue||venue||''} startsAt={events.find(e=>e.id===eventId)?.starts_at||startsAt||''} priceNgn={events.find(e=>e.id===eventId)?.price_ngn||0} organiser={me?.full_name||''} description={eventDescription}/><span>{t.name}</span></button>)}</div></details>
    <label className="rw-field">Event category<select value={eventCategory} onChange={e=>setEventCategory(e.target.value)}>{['Music','Nightlife','Festival','Business','Food','Sports','Arts','Education','Community','Other'].map(c=><option key={c}>{c}</option>)}</select></label>
    <label className="rw-field">Public event description<textarea rows={3} maxLength={2500} value={eventDescription} onChange={e=>setEventDescription(e.target.value)}/></label>
    {btn('Save design for review',()=>{void saveEventDesign()})}
  </section>}
  {eventId&&<section className="rw-panel rw-wide" style={{display:organiserTab==='team'?'':'none'}}><h2>Gate operators</h2><p>Invite anyone by email, including people without EventPass accounts. Copy and share the private link; they register or sign in and accept it. Links expire in 72 hours and grant access only to this event.</p>
    {input('Operator email',staffEmail,setStaffEmail,'email')}{input('Gate label',gateLabel,setGateLabel)}{btn('Create private invitation link',()=>{void inviteGate()})}{btn('Add existing verified operator',()=>{void addExistingOperator()},true)}{latestInvite&&<div className="rw-invite"><p>Private invitation link (visible only now; share it with the invited person):</p><input readOnly aria-label="New gate invitation URL" value={latestInvite} onFocus={e=>e.currentTarget.select()}/>{btn('Copy invitation link',()=>{void navigator.clipboard.writeText(latestInvite).then(()=>setMessage('Invitation link copied')).catch(()=>setMessage('Select and copy the link manually'))},true)}<p>Do not publish this link publicly. Creating a new invitation invalidates the old one.</p></div>}
    <h3>Assigned operators ({gateOperators.filter(o=>o.event_id===eventId).length})</h3>{gateOperators.filter(o=>o.event_id===eventId).map(o=><div className="rw-list-item" key={o.user_id}><div><b>{o.full_name||o.email}</b><p>{o.email} · {o.gate_label} · {o.account_status}</p><p>Scans: {o.scan_count} · Admitted: {o.admitted_count} · Last scan: {o.last_scan_at?nice(o.last_scan_at):'Never'}</p></div>{btn('Revoke',()=>{void revokeGate({id:o.user_id,event_id:o.event_id,invitee_email:o.email,gate_label:o.gate_label,status:'accepted'})},true)}</div>)}<h3>Invitation history</h3>{invites.filter(i=>i.event_id===eventId).map(i=><div className="rw-list-item" key={i.id}><div><b>{i.invitee_email}</b><p>{i.gate_label} · {i.status}</p></div>{i.status!=='revoked'&&btn('Revoke',()=>{void revokeGate(i)},true)}</div>)}<h3>Recent gate activity</h3>{scans.length?scans.slice(0,20).map(s=><div className="rw-list-item" key={s.id}><div><b>{s.operator||'Operator'}</b><p>{s.outcome} · {s.gate_label} · {nice(s.scanned_at)}</p></div></div>):<p>No scans recorded for this event yet.</p>}{btn('Refresh gate activity',()=>{void run(async()=>{const [a,g]=await Promise.all([api('gates/activity?eventId='+encodeURIComponent(eventId)),api('gates')]);setScans(a.scans||[]);setGateOperators(g.operators||[]);setInvites(g.invitations||[]);})},true)}</section>}
 </div></div>}
 {role==='user'&&<div className="rw-layout">
  <section className="rw-panel rw-wide rw-market">
    <div className="rw-market-hero"><div className="eyebrow">NEXX EVENTPASS • DISCOVER</div><h1>Find your next experience.</h1><p>Concerts, celebrations, festivals, meetups and memorable nights—all in one place.</p>
    <div className="rw-market-filters">
      <input aria-label="Search events" placeholder="Search by name, venue, organiser or description..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <select aria-label="Event category" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>{categories.map(c=><option key={c} value={c}>{c==='All'?'All categories':c}</option>)}</select>
      <select aria-label="Sort events" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
       <option value="soonest">Soonest first</option><option value="latest">Latest date</option><option value="price">Lowest price</option></select>
    </div></div>
    <div className="rw-market-count"><strong>{visibleEvents.length}</strong> verified {visibleEvents.length===1?'event':'events'} to explore</div>
    <div className="rw-market-grid">{visibleEvents.map(e=><article key={e.id} className="rw-market-card">
      <div className="rw-market-cover">
        {e.cover_media_id?<img loading="lazy" src={'/api/events/media?id='+e.cover_media_id} alt={e.title+' event poster'}/>:isMasqueradePoster(e.poster_template||'')?<div className="ep-poster-thumb"><EventPosterDesign posterId={e.poster_template||''} title={e.title} venue={e.venue} startsAt={e.starts_at} priceNgn={e.price_ngn} organiser={e.organiser} description={e.description}/></div>:e.video_media_id?<video muted playsInline loop autoPlay preload="metadata" src={'/api/events/media?id='+e.video_media_id}/>:<div className="rw-market-placeholder" style={{background:themeFor(e.ticket_theme||'aurora').gradient}}><span>◈</span><strong>{e.title}</strong></div>}
        <span className="rw-event-tag">{e.category||'Event'}</span>
      </div>
      <div className="rw-market-info"><div className="rw-market-meta">{nice(e.starts_at)} · {e.venue}</div>
        <h3>{e.title}</h3><p>{e.description||'Discover event details, tickets and more.'}</p>
        <div className="rw-market-organiser">Hosted by <strong>{e.organiser||'Verified organiser'}</strong></div>
        <div className="rw-market-footer"><strong>{e.price_ngn?money(e.price_ngn):'Free entry'}</strong>
         {btn(selectedEvent===e.id?'Close details':'Explore tickets',()=>{void loadUserMedia(selectedEvent===e.id?'':e.id)},true)}</div>
      </div>
      {selectedEvent===e.id&&<div className="rw-booking rw-market-booking">
       <h4>Explore {e.title}</h4>
       {e.description&&<p>{e.description}</p>}
       <div className="rw-gallery">{eventMedia.map(m=><div key={m.id} className="rw-media-card">
        {m.media_type==='video'?<video controls playsInline preload="metadata" src={m.url}/>:<img loading="lazy" src={m.url} alt={m.file_name}/>}</div>)}</div>
       <h4>{e.price_ngn?'Pay the organiser by bank transfer':'Request a free ticket'}</h4>
       {e.price_ngn>0?(e.bank_name?<><p>{e.bank_name} — {e.bank_account_name}</p><strong>{e.bank_account_number}</strong></>:<p>The organiser has not configured payment instructions yet.</p>):<p>Approval may still be required before your ticket is issued.</p>}
       {input('Number of tickets',quantity,setQuantity,'number')}
       {e.price_ngn>0&&<>{input('Bank transfer reference',paymentRef,setPaymentRef)}
        <label className="rw-field">Payment receipt (PNG, JPG, WebP, PDF, max 2 MB)<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={v=>setReceipt(v.target.files?.[0]||null)}/></label></>}
       <p>Tickets are released only after the organiser approves the order.</p>
       {btn('Request '+quantity+' '+(quantity==='1'?'ticket':'tickets'),()=>{void book(e)})}
      </div>}
    </article>)}</div>
    {!visibleEvents.length&&<div className="rw-empty"><h3>No matching events yet</h3><p>Try another search or choose a different category.</p></div>}
  </section>
  <section className="rw-panel"><h2>My orders</h2>{orders.map(o=><div className="rw-list-item" key={o.id}><div><b>{o.event_title}</b><p>{o.status} · {money(o.amount_ngn)}</p><small>{o.payment_reference}</small>
      {o.status==='pending'&&o.reservation_expires_at&&<p style={{color:new Date(o.reservation_expires_at).getTime()<=Date.now()?'#f9a8b4':'#b8f3df'}}>
      {new Date(o.reservation_expires_at).getTime()<=Date.now()?'Reservation expired. Contact organiser if you transferred funds.':'Reserved until '+nice(o.reservation_expires_at)}</p>}
      {o.refund_status&&o.refund_status!=='not_required'&&<p>Refund status: {o.refund_status.replaceAll('_',' ')}</p>}
      {!o.receipt_uploaded_at&&o.status==='pending'&&(!o.reservation_expires_at||new Date(o.reservation_expires_at).getTime()>Date.now())&&o.amount_ngn>0&&<label className="rw-field">Upload missing receipt<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e=>setReceiptUploads({...receiptUploads,[o.id]:e.target.files?.[0]||null})}/>{btn('Send receipt',()=>{void upload(o.id)})}</label>}</div></div>)}{!orders.length&&<p>Your event orders will appear here.</p>}</section>
  <section className="rw-panel"><h2>My ticket wallet</h2>{tickets.map(t=>isMasqueradeTemplate(t.ticket_theme||'')?<div key={t.id} className="rw-wallet-masquerade"><TicketDesign themeId={t.ticket_theme} title={t.title} venue={t.venue} startsAt={t.starts_at} priceNgn={events.find(e=>e.id===t.event_id)?.price_ngn||0} organiser={events.find(e=>e.id===t.event_id)?.organiser||'Event Organiser'} qr={t.qr} ticketCode={t.entry_code||undefined} customArtwork={t.ticket_art_id?'/api/events/media?id='+t.ticket_art_id:null} admissionLabel={t.admission_label||'ADMIT ONE'} status={t.redeemed_at?'redeemed':t.status}/><small>{t.redeemed_at?'Already checked in':'Approved ticket · Unique entry QR'} · {t.entry_code||'Backup code pending'}</small>{t.qr&&btn('Enlarge secure entry QR',()=>setExpandedQr({value:t.qr!,eventName:t.title,entryCode:t.entry_code}),true)}</div>:<div key={t.id} className="rw-ticket rw-designed-ticket" style={{background:themeFor(t.ticket_theme||'aurora').gradient}}>
    {t.ticket_art_id&&<img className="rw-ticket-art" src={'/api/events/media?id='+t.ticket_art_id} alt="Custom event ticket design"/>}
    <div className="rw-ticket-details"><small>NEXX EVENTPASS • OFFICIAL ENTRY</small><h3>{t.title}</h3><p>{t.venue} · {nice(t.starts_at)}</p>
      {t.qr&&<div className="rw-qr"><QRCodeSVG value={t.qr} size={220} level="M" includeMargin/></div>}
      {t.entry_code&&<p><strong>Backup code: {t.entry_code}</strong></p>}
      <b>{t.redeemed_at?'ALREADY CHECKED IN':t.status.toUpperCase()}</b></div>
    </div>)}{!tickets.length&&<p>Approved event passes will appear here with a unique encrypted QR code.</p>}</section>
 </div>}
 {role==='user'&&expandedQr&&<div className="masque-qr-modal-backdrop" role="presentation" onClick={()=>setExpandedQr(null)}>
  <div className="masque-qr-modal" role="dialog" aria-modal="true" aria-label="Enlarged ticket QR" onClick={e=>e.stopPropagation()}>
   <h3>{expandedQr.eventName}</h3><p>Show this secure QR to the assigned Gate Operator.</p>
   <div className="masque-expanded-code"><QRCodeSVG value={expandedQr.value} size={288} level="M" includeMargin/></div>
   {expandedQr.entryCode&&<p><strong>Manual backup code: {expandedQr.entryCode}</strong></p>}
   {btn('Close',()=>setExpandedQr(null))}
  </div>
 </div>}
 {role==='gate'&&<div className="rw-gate-flow"><div className="eyebrow">ASSIGNED ENTRY CONTROL</div>
  <h1>{eventId?'Ready for entry':'Choose your assigned event'}</h1>
  <p>Only events assigned by your organiser appear here. Select one, start scanning and immediately verify entry.</p>
  {gates.length?<>
   <div className="rw-gate-event-list" aria-label="Assigned events">{gates.map(g=><button className={'rw-gate-event '+(eventId===g.event_id?'selected':'')} key={g.event_id} disabled={busy} aria-pressed={eventId===g.event_id} onClick={()=>{stopScan();setEventId(g.event_id);setScanOutcome('');setScanCode('');setScans([]);setMessage('')}}>
    <strong>{g.title}</strong><small>{g.gate_label}</small></button>)}</div>
    {eventId&&<div className="rw-gate-stage">
    <div className="rw-scan-context"><span>Scanning for</span><strong>{gates.find(gate=>gate.event_id===eventId)?.title}</strong></div>
    {busy&&<p role="status" className="rw-scan-verifying">Verifying ticket…</p>}
    <button type="button" className={rehearsal?'primary':'ghost'} aria-pressed={rehearsal}
      onClick={()=>{rehearsalRef.current=!rehearsalRef.current;setRehearsal(rehearsalRef.current);setScanOutcome('')}} style={{width:'100%',padding:14,marginBottom:10}}>
        {rehearsal?'⚠ TEST ONLY ACTIVE — No admission will be recorded':'Enable non-consuming test mode'}
     </button>
     {!scanning&&<button type="button" className="primary" disabled={busy} onClick={()=>{void startScan()}} style={{fontSize:18,padding:"18px 24px",width:"100%"}}>📷 Start fast continuous scanner</button>}
    <div className="rw-camera rw-gate-camera" style={{display:scanning?'block':'none'}}><video id="gate-video" autoPlay muted playsInline style={{width:'100%'}}/>
    {scanning&&<div className="rw-scan-target" aria-hidden="true"><div className="rw-scan-sweep"/></div>}</div>{scanning&&btn('Stop scanning',stopScan,true)}
    <p id="gate-backup-help" style={{fontSize:13,opacity:.88}}>QR not detected? Enter the backup code printed below the QR on the ticket. Entry still works only once.</p>
     <form onSubmit={e=>{e.preventDefault();void scan()}}>
      <label className="rw-field">Ticket code<input value={scanCode} onChange={e=>setScanCode(e.target.value)}
        autoComplete="off" spellCheck={false} maxLength={2048} placeholder="NX-XXXX-XXXX-XXXX or QR" aria-describedby="gate-backup-help"/></label>
      <button type="submit" className="ghost" disabled={busy||!scanCode.trim()}>Verify ticket code</button>
    </form>
    {!!scanOutcome&&<div key={scanOutcome} role="status" className={'rw-result '+scanOutcome}>
      <b>{scanOutcome==='valid_test'?'TEST ONLY — VALID, NOT ADMITTED':scanOutcome==='approved'?'✓ VALID — ADMIT':scanOutcome==='duplicate'?'ALREADY CHECKED IN':scanOutcome==='wrong_event'?'WRONG EVENT':scanOutcome==='revoked'?'REVOKED TICKET':'✕ ENTRY REJECTED'}</b>
      <p>{scanOutcome==='valid_test'?'Rehearsal passed. No ticket was redeemed. Disable test mode before admitting guests.':scanOutcome==='approved'?'This ticket is genuine and has been redeemed.':scanOutcome==='duplicate'?'The ticket has already been used. Do not admit again.':'Do not admit this ticket. Ask the holder to contact the organiser.'}</p>
    </div>}
    <details><summary>Recent scan activity</summary>
      {scans.length?<ul>{scans.slice(0,10).map(scan=><li key={scan.id}>{scan.outcome.replaceAll('_',' ')} · {nice(scan.scanned_at)}</li>)}</ul>:<p>No scans recorded yet.</p>}
    </details>
   </div>}
  </>:<div className="rw-empty"><h3>No assigned event</h3><p>Ask an organiser to invite your Google email. Your assigned event will appear here after confirmation.</p></div>}
 </div>}
 </main>;
}
