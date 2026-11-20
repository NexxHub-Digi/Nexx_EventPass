import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,Alert,ScrollView,Pressable,Text,TextInput,View,StyleSheet,Platform,StatusBar,ActivityIndicator,Image,useWindowDimensions,BackHandler} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import PlatformOverview from './PlatformOverview';
import AdminFinanceLedger from './AdminFinanceLedger';
import AdminSidebar,{type AdminPage} from './AdminSidebar';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
WebBrowser.maybeCompleteAuthSession();

const PORTAL: string="platform_admin",TITLE="Nexx EventPass Platform Admin",BASE=(process.env.EXPO_PUBLIC_API_URL||'https://nexx-eventpass.vercel.app').replace(/\/$/,'');
type Member={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
type Event={id:string;title:string;venue:string;organiser_id:string;starts_at:string;price_ngn:number;status:string;bank_name?:string;bank_account_name?:string;bank_account_number?:string};
type Ticket={id:string;title:string;qr:string|null;status:string;redeemed_at:string|null};
type Order={id:string;event_id:string;event_title?:string;buyer_name?:string;buyer_email?:string;status:string;quantity:number;payment_reference:string;receipt_uploaded_at?:string|null;amount_ngn:number};
type Gate={event_id:string;title:string;gate_label:string};
type Applicant={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null;event_count?:number;pending_orders?:number;tickets_issued?:number;gate_operators?:number;can_create_events?:boolean;can_invite_gates?:boolean;can_verify_payments?:boolean};
type AdminAccount={id:string;email:string;full_name:string;role:string;account_status:string;google_verified:boolean;ticket_count:number;order_count:number;event_count:number;gate_event_count:number};
type SupportCase={id:string;subject:string;description:string;organiser_name:string;status:string;priority:string;resolution:string;payment_order_id?:string|null};
type ModerationEvent={id:string;title:string;venue:string;organiser_id:string;organiser_name:string;organiser_email:string;status:string;verification_status:string;owner_eligible:boolean;pending_media:number};
type MediaReview={id:string;event_id:string;file_name:string;media_type:string};
type RefundCase={id:string;event_title:string;buyer_email:string;status:string;refund_status:string;amount_ngn:number;refund_note?:string|null};
type AuditEntry={id:string;action:string;created_at:string;performed_by:string;target_email?:string|null;details?:{reason?:string}|null};
type Theme={id:string;name:string;label:string;color_a:string;color_b:string;accent:string};
type EventMetrics={id:string;title:string;organiser_name:string;status:string;verification_status:string;tickets_issued:number;external_tickets_issued:number;checked_in:number;pending_orders:number;reserved_seats:number;confirmed_revenue_ngn:number;refund_cases:number;active_gate_operators:number;capacity:number};
async function api(p:string,t:string,method='GET',data?:unknown){const multi=data instanceof FormData;const r=await fetch(BASE+'/api/'+p,{method,headers:{...(multi?{}:{'Content-Type':'application/json'}),...(t?{Authorization:'Bearer '+t}:{})},body:multi?data: data?JSON.stringify(data):undefined});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v}
export default function App(){
 const scroll=useRef<ScrollView>(null);
 const [reduceMotion,setReduceMotion]=useState(true);
 useEffect(()=>{
  let mounted=true;
  void AccessibilityInfo.isReduceMotionEnabled().then(enabled=>{if(mounted)setReduceMotion(enabled)}).catch(()=>{});
  const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
  return ()=>{mounted=false;listener.remove()};
 },[]);
 const [booting,setBooting]=useState(true);
 const [section,setSection]=useState<AdminPage>('overview');
 const [menuOpen,setMenuOpen]=useState(false),[showDesktopSidebar,setShowDesktopSidebar]=useState(true);
 const {width:viewportWidth}=useWindowDimensions();
 const desktopNavigation=viewportWidth>=900;
 const [token,setToken]=useState(''),[member,setMember]=useState<Member|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[orders,setOrders]=useState<Order[]>([]),[gates,setGates]=useState<Gate[]>([]),[eventId,setEventId]=useState('');
 const [applicants,setApplicants]=useState<Applicant[]>([]),[organiserEmail,setOrganiserEmail]=useState('');
 const [selectedOrganiser,setSelectedOrganiser]=useState(''),[organiserName,setOrganiserName]=useState('');
 const [rejectApplicant,setRejectApplicant]=useState(''),[rejectReason,setRejectReason]=useState('');
 const [accounts,setAccounts]=useState<AdminAccount[]>([]),[userSearch,setUserSearch]=useState(''),[selectedAccount,setSelectedAccount]=useState(''),[userName,setUserName]=useState(''),[deactivateReason,setDeactivateReason]=useState('');
 const [cases,setCases]=useState<SupportCase[]>([]),[selectedSupportId,setSelectedSupportId]=useState(''),[supportDrafts,setSupportDrafts]=useState<Record<string,{resolution:string;priority:string}>>({}),[settings,setSettings]=useState<Record<string,string>>({});
 const [settingKey,setSettingKey]=useState('support_email'),[settingValue,setSettingValue]=useState('');
 const [bankAccounts,setBankAccounts]=useState<{id:string;bank_name:string;account_name:string;account_number:string;status:string;organiser_name:string}[]>([]);
 const [bankReviewId,setBankReviewId]=useState(''),[bankReviewNote,setBankReviewNote]=useState('');
 const [summary,setSummary]=useState<Record<string,number>>({});
 const [moderationEvents,setModerationEvents]=useState<ModerationEvent[]>([]),[moderationMedia,setModerationMedia]=useState<MediaReview[]>([]);
 const [auditHistory,setAuditHistory]=useState<AuditEntry[]>([]),[refundCases,setRefundCases]=useState<RefundCase[]>([]);
 const [eventMetrics,setEventMetrics]=useState<EventMetrics[]>([]),[eventQuery,setEventQuery]=useState('');
 const [themes,setThemes]=useState<Theme[]>([]),[themeName,setThemeName]=useState(''),[themeLabel,setThemeLabel]=useState(''),[themeA,setThemeA]=useState('#552AA8'),[themeB,setThemeB]=useState('#231A56'),[themeAccent,setThemeAccent]=useState('#FFFFFF');
 const [accountPage,setAccountPage]=useState(1),[accountCount,setAccountCount]=useState(0),[accountRole,setAccountRole]=useState('');
 const [refundNotes,setRefundNotes]=useState<Record<string,string>>({}),[ownerFixEvent,setOwnerFixEvent]=useState(''),[ownerFixEmail,setOwnerFixEmail]=useState(''),[ownerFixReason,setOwnerFixReason]=useState('');
 async function load(t:string){
 const me=await api('auth/me',t);if(!me.user)throw Error('Please sign in again');
 if(!(PORTAL==='organiser'&&me.user.account_status==='pending') && !(me.portals||[]).includes(PORTAL)){await SecureStore.deleteItemAsync('eventpass_token');setMember(null);setToken('');throw Error('This account is not authorised for this app')}
 setMember(me.user);
 setBankAccounts((await api('organiser/payment-account',t)).accounts||[]);
 if(me.user.account_status==='pending')return;
 const ev=await api('events',t);setEvents(ev.events||[]);
 const [a,people,support,configuration,overview,moderation,audit,refunds,eventDirectory,themeCatalog]=await Promise.all([
  api('platform/organisers',t),api('platform/users',t),api('support/cases',t),api('platform/settings',t),
  api('platform/overview',t),api('platform/events',t),api('platform/audit',t),api('refunds',t),api('platform/event-directory',t),api('ticket-themes',t)]);
 setApplicants(a.organisers||[]);setAccounts(people.accounts||[]);setCases(support.cases||[]);setSettings(configuration.settings||{});
 setSummary(overview.stats||{});setModerationEvents(moderation.events||[]);setModerationMedia(moderation.media||[]);
 setAuditHistory(audit.history||[]);setRefundCases(refunds.orders||[]);
 setEventMetrics(eventDirectory.events||[]);setThemes(themeCatalog.themes||[]);setAccountCount(people.count||0);setAccountPage(people.page||1);
 }
 useEffect(()=>{
  let mounted=true;
  void SecureStore.getItemAsync('eventpass_token').then(async t=>{if(t&&mounted){setToken(t);await load(t)}})
   .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Could not open your session')})
   .finally(()=>{if(mounted)setBooting(false)});
  return ()=>{mounted=false};
 },[]);
 async function exec(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function login(){await exec(async()=>{
   const redirect='eventpassplatformadmin://oauth';
   const verifier=Array.from(Crypto.getRandomBytes(32)).map(b=>b.toString(16).padStart(2,'0')).join('');
   const challenge=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,verifier);
   const result=await WebBrowser.openAuthSessionAsync(BASE+'/api/auth/google?portal='+encodeURIComponent(PORTAL)+'&client=native&challenge='+challenge,redirect);
   if(result.type!=='success')throw Error('Google sign-in was cancelled');
   const code=new URL(result.url).searchParams.get('code');
   if(!code)throw Error('Google did not return a valid sign-in code');
   const data=await api('auth/mobile','','POST',{code,client:PORTAL,codeVerifier:verifier});
   await SecureStore.setItemAsync('eventpass_token',data.token);
   setToken(data.token);await load(data.token);setSection('overview');setMenuOpen(false);
 })}
 async function searchUsers(page=1,role=accountRole){await exec(async()=>{const r=await api('platform/users?q='+encodeURIComponent(userSearch)+'&role='+encodeURIComponent(role)+'&page='+page,token);setAccounts(r.accounts||[]);setAccountPage(r.page||page);setAccountCount(r.count||0)})}
 async function searchEvents(){await exec(async()=>{const data=await api('platform/event-directory?q='+encodeURIComponent(eventQuery),token);setEventMetrics(data.events||[])})}
 async function rejectOrganiser(id:string){await exec(async()=>{
  if(rejectApplicant!==id||rejectReason.trim().length<10)throw Error('Provide a rejection reason of at least 10 characters');
  await api('platform/organisers',token,'POST',{action:'reject',userId:id,reason:rejectReason.trim()});
  setRejectApplicant('');setRejectReason('');await load(token);
  Alert.alert('Application rejected','Decision and reason recorded in the platform audit.');
 })}
 async function updateOrganiserName(id:string){await exec(async()=>{await api('platform/organisers',token,'POST',{action:'configure',userId:id,fullName:organiserName.trim()});await load(token);Alert.alert('Organiser updated','Profile change was saved and audited.')})}
 async function toggleOrganiserCapability(a:Applicant,key:'can_create_events'|'can_invite_gates'|'can_verify_payments'){
  await exec(async()=>{
   const values={can_create_events:a.can_create_events!==false,can_invite_gates:a.can_invite_gates!==false,can_verify_payments:a.can_verify_payments!==false};
   values[key]=!values[key];
   await api('platform/organisers',token,'POST',{action:'capabilities',userId:a.id,canCreateEvents:values.can_create_events,canInviteGates:values.can_invite_gates,canVerifyPayments:values.can_verify_payments});
   await load(token);Alert.alert('Permissions updated','The organiser capability change is saved in the platform audit.');
  });
 }
 async function createTheme(){await exec(async()=>{
  const result=await api('ticket-themes',token,'POST',{name:themeName.trim(),label:themeLabel.trim(),colorA:themeA,colorB:themeB,accent:themeAccent});
  const updated=await api('ticket-themes',token);setThemes(updated.themes||[]);
  setThemeName('');setThemeLabel('');Alert.alert('Ticket theme created',result.theme.name+' is now available in the organiser design catalogue.');
 })}
 async function changeAccount(action:'configure'|'suspend'|'restore'|'deactivate'){await exec(async()=>{
  if(!selectedAccount)throw Error('Select an account');
  if(action==='deactivate'&&!deactivateReason.trim())throw Error('Provide a deactivation reason');
  await api('platform/users',token,'PATCH',{action,userId:selectedAccount,fullName:userName,reason:deactivateReason});
  const r=await api('platform/users?q='+encodeURIComponent(userSearch)+'&role='+encodeURIComponent(accountRole)+'&page='+accountPage,token);setAccounts(r.accounts||[]);setAccountCount(r.count||0);
  Alert.alert('Account updated','Change recorded in platform audit.');
 })}
 async function resolveCase(c:SupportCase,status:'open'|'in_progress'|'resolved'|'closed'){await exec(async()=>{
  const draft=supportDrafts[c.id]||{resolution:c.resolution||'',priority:c.priority};
  if(['resolved','closed'].includes(status)&&draft.resolution.trim().length<10)throw Error('Enter a resolution of at least 10 characters for this case.');
  await api('support/cases',token,'PATCH',{id:c.id,status,priority:draft.priority,resolution:draft.resolution.trim()});
  setCases((await api('support/cases',token)).cases||[]);
  Alert.alert('Case updated','The case status, priority and resolution were saved and audited.');
 })}
 function confirmCase(c:SupportCase,status:'open'|'in_progress'|'resolved'|'closed'){
  if(['resolved','closed'].includes(status)&&((supportDrafts[c.id]?.resolution??c.resolution??'').trim().length<10)){setError('Enter a case-specific resolution of at least 10 characters before closing.');return}
  Alert.alert('Confirm support action','Update '+c.subject+' to '+status.replace('_',' ')+'? This action is audited.',[
   {text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>void resolveCase(c,status)}
  ]);
 }
 async function saveSetting(){await exec(async()=>{await api('platform/settings',token,'PATCH',{key:settingKey,value:settingValue});setSettings({...settings,[settingKey]:settingValue});Alert.alert('Configuration saved')})}
 async function moderate(eventId:string,action:'verify'|'reject'|'approve_media'|'reject_media',mediaId?:string){await exec(async()=>{
  await api('platform/events',token,'POST',{eventId,action,...(mediaId?{mediaId}:{})});
  await load(token);Alert.alert('Review saved','The moderated record has been updated.');
 })}
 async function correctEventOwner(eventId:string,expectedOwnerId:string){await exec(async()=>{
  if(ownerFixReason.trim().length<12)throw Error('Explain and verify the ownership correction (12+ characters).');
  if(!ownerFixEmail.trim())throw Error('Enter the confirmed active organiser email.');
  await api('platform/events',token,'POST',{eventId,expectedOwnerId,organiserEmail:ownerFixEmail.trim(),reason:ownerFixReason.trim(),ownershipConfirmed:true,action:'correct_owner'});
  setOwnerFixEvent('');setOwnerFixEmail('');setOwnerFixReason('');await load(token);
  Alert.alert('Ownership corrected','The listing returned to draft for a new review.');
 })}
 async function updateRefund(orderId:string,action:'review_required'|'initiated'|'settled'){await exec(async()=>{
  const note=(refundNotes[orderId]||'').trim();
  if(action==='settled'&&note.length<10)throw Error('Enter a verified settlement reference for this order (10+ characters).');
  await api('refunds',token,'PATCH',{orderId,action,note});
  setRefundCases((await api('refunds',token)).orders||[]);setRefundNotes(previous=>({...previous,[orderId]:''}));
  Alert.alert('Refund case updated','The action has been recorded in the payment audit.');
 })}
 async function logout(){try{if(token)await api('auth/logout',token,'POST')}catch{setError('Server logout unavailable; session may remain active until expiry.')}finally{await SecureStore.deleteItemAsync('eventpass_token');setToken('');setMember(null);setMenuOpen(false);setSection('overview')}}
 function navigateAdmin(page:AdminPage){setSection(page);setMenuOpen(false);scroll.current?.scrollTo({y:0,animated:false})}
 useEffect(()=>{
  if(!menuOpen)return;
  const listener=BackHandler.addEventListener('hardwareBackPress',()=>{setMenuOpen(false);return true});
  return ()=>listener.remove();
 },[menuOpen]);
 const input=(hint:string,value:string,update:(x:string)=>void,secret=false)=><TextInput style={s.input} placeholder={hint} placeholderTextColor="#94a3b8" value={value} onChangeText={update} autoCapitalize="none" secureTextEntry={secret}/>;
 const button=(label:string,fn:()=>void,sub=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled:busy}} onPress={fn} disabled={busy} style={({pressed})=>[s.button,sub&&s.subButton,pressed&&(reduceMotion?s.pressedStill:s.pressed),busy&&s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 const surfaceMotion=useRef(new Animated.Value(1)).current;
 const opening=booting||(busy&&!member);
 const surface=opening?'opening':member?section:'signin';
 useLayoutEffect(()=>{
  if(reduceMotion){surfaceMotion.setValue(1);return}
  surfaceMotion.setValue(0);
  const animation=Animated.timing(surfaceMotion,{toValue:1,duration:240,easing:Easing.out(Easing.cubic),useNativeDriver:true});
  animation.start();
  return ()=>animation.stop();
 },[surface,reduceMotion,surfaceMotion]);
 const surfaceStyle={
  opacity:surfaceMotion.interpolate({inputRange:[0,1],outputRange:[.76,1]}),
  transform:[{translateY:surfaceMotion.interpolate({inputRange:[0,1],outputRange:[7,0]})}],
 };
 if(opening)return <Animated.View style={[s.loading,surfaceStyle]} accessibilityLiveRegion="polite">
  <Image accessible={false} source={require('./assets/app-icon.png')} style={{width:72,height:72,borderRadius:18}}/>
  <Text style={{color:'#f8faff',fontWeight:'800',fontSize:22}}>Nexx EventPass</Text>
  <Text style={{color:'#ced8f0'}}>{booting?'Opening EventPass…':'Connecting to Google…'}</Text>
  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.loadingTrack}>
   {!reduceMotion?<ActivityIndicator color={'#9ccfff'}/>:<View style={s.loadingDot}/>}
  </View>
 </Animated.View>;
 return <View style={s.root}>
  <StatusBar barStyle="light-content"/>
  <View style={s.head}>
   {member&&<Pressable accessibilityRole="button" accessibilityLabel={desktopNavigation?(showDesktopSidebar?'Collapse sidebar':'Expand sidebar'):(menuOpen?'Close menu':'Open sidebar menu')} accessibilityState={{expanded:desktopNavigation?showDesktopSidebar:menuOpen}} onPress={()=>desktopNavigation?setShowDesktopSidebar(x=>!x):setMenuOpen(x=>!x)} style={s.menuTrigger}><Text style={s.menuTriggerIcon}>☰</Text></Pressable>}
   <Pressable style={s.brandRow} accessibilityRole="button" accessibilityLabel="Platform Admin dashboard" disabled={busy||!member} onPress={()=>navigateAdmin('overview')}>
    <Image accessible={false} source={require('./assets/app-icon.png')} style={s.brandMark}/><View style={s.brandCopy}>
    <Text style={s.brand}>Nexx EventPass</Text><Text style={s.headLabel}>Platform Admin</Text>
   </View></Pressable>
   {member&&<Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={busy} onPress={()=>void logout()} style={s.accountBadge}><Text style={s.headLabel}>Sign out</Text></Pressable>}
  </View>
  <View style={s.workspaceFrame}>
    {member&&desktopNavigation&&showDesktopSidebar&&<AdminSidebar active={section} operatorName={member.full_name} onNavigate={navigateAdmin} onClose={()=>setShowDesktopSidebar(false)}
      pendingSupport={cases.filter(c=>['open','in_progress'].includes(c.status)).length}
      pendingOrganisers={applicants.filter(a=>a.role==='user'&&a.requested_role==='organiser').length}
      pendingRefunds={refundCases.filter(r=>['review_required','initiated'].includes(r.refund_status)).length}/>}
    <Animated.View style={[{flex:1},surfaceStyle]}>
    <ScrollView ref={scroll} key={member?section:'signin'} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
 {!member?<View style={s.welcome}>
   <View pointerEvents="none" style={s.welcomeGlow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/>
   <Text style={s.welcomeLabel}>Platform operations</Text><Text style={s.welcomeTitle}>Manage EventPass.</Text>
   <Text style={s.welcomeText}>Review accounts, verify bank details and resolve support cases.</Text>
   {button('Continue with Google',()=>{void login()})}
  </View>:<>
 {section!=='overview'&&<View style={s.sectionBanner}>
  <Text style={s.sectionEyebrow}>NEXX EVENTPASS  /  ADMINISTRATION</Text>
  <Text style={s.sectionBannerTitle}>{({organisers:'Organiser management',accounts:'Users & access',events:'Event moderation',analytics:'Events & analytics',finance:'Payments & refunds',support:'Support desk',themes:'Ticket themes',audit:'Audit history',settings:'Platform settings',more:'Explore workspace'} as Record<string,string>)[section]||'Platform operations'}</Text>
  <Text style={s.sectionBannerHint}>Signed in as {member.full_name} · Secure administrator workspace</Text>
 </View>}
 {member.account_status==='pending'?<View style={s.card}><Text style={s.title}>Approval pending</Text><Text style={s.hint}>Platform Admin must approve this organiser application.</Text></View>:<>{button('Refresh',()=>{void exec(async()=>load(token))},true)}
 {section==='overview'&&<PlatformOverview fullName={member.full_name} summary={summary}
 pendingOrganisers={applicants.filter(a=>a.role==='user'&&a.requested_role==='organiser').length}
 pendingEvents={moderationEvents.filter(e=>e.verification_status==='pending').length}
 pendingRefunds={refundCases.filter(r=>r.refund_status!=='settled').length}
 pendingSupport={cases.filter(c=>['open','in_progress'].includes(c.status)).length}
 pendingBanks={bankAccounts.filter(b=>b.status==='pending').length}
 onNavigate={navigateAdmin} onRefresh={()=>void exec(async()=>load(token))} busy={busy}/>}
 {section==='analytics'&&<><Text style={s.title}>Events & analytics</Text>
 <Text style={s.hint}>Confirmed revenue excludes pending orders and manually tracked offline sales.</Text>
 {input('Search event or organiser',eventQuery,setEventQuery)}
 {button('Search event reports',()=>{void searchEvents()},true)}
 {!eventMetrics.length&&<Text style={s.hint}>No events match this search. Try another title or organiser.</Text>}
 {eventMetrics.map(event=><View key={event.id} style={s.card}>
  <Text style={s.title}>{event.title}</Text><Text style={s.hint}>Organiser: {event.organiser_name} · {event.status} · {event.verification_status}</Text>
  <Text style={s.hint}>Issued: {event.tickets_issued} (offline {event.external_tickets_issued}) · Admitted: {event.checked_in}</Text>
  <Text style={s.hint}>Capacity: {event.capacity} · Pending orders: {event.pending_orders} · Reserved seats: {event.reserved_seats}</Text>
  <Text style={s.hint}>Confirmed order revenue: ₦{Number(event.confirmed_revenue_ngn).toLocaleString('en-NG')}</Text>
  <Text style={s.hint}>Refund cases: {event.refund_cases} · Gate assignments: {event.active_gate_operators}</Text>
  {button('Open moderation',()=>setSection('events'),true)}
 </View>)}
 </>}
 {section==='themes'&&<><Text style={s.title}>Ticket themes</Text>
 <Text style={s.hint}>Create reusable ticket themes for organisers. Each colour must be a six-digit HEX value.</Text>
 {input('New theme name',themeName,setThemeName)}
 {input('Theme category or label',themeLabel,setThemeLabel)}
 {input('Background colour A (e.g. #552AA8)',themeA,setThemeA)}
 {input('Background colour B (e.g. #231A56)',themeB,setThemeB)}
 {input('Accent colour (e.g. #FFFFFF)',themeAccent,setThemeAccent)}
 <View accessibilityLabel="New ticket theme preview" style={[s.card,{backgroundColor:/^#[A-Fa-f0-9]{6}$/.test(themeA)?themeA:'#253251',borderColor:/^#[A-Fa-f0-9]{6}$/.test(themeAccent)?themeAccent:'#506180',borderWidth:2}]}>
  <Text style={{color:'#fff',fontWeight:'900'}}>{themeName.trim()||'New ticket theme'}</Text>
  <Text style={{color:'#fff'}}>{themeLabel.trim()||'Preview only — not published'}</Text>
  <View style={{backgroundColor:/^#[A-Fa-f0-9]{6}$/.test(themeB)?themeB:'#231A56',height:16,borderRadius:8,marginTop:8}}/>
 </View>
 {button('Create ticket theme',()=>Alert.alert('Publish new ticket theme?','Organisers will be able to select this design. Review its name and colours before publishing.',[
  {text:'Cancel',style:'cancel'},{text:'Create theme',onPress:()=>void createTheme()}
 ]))}
 <Text style={s.title}>Available themes ({themes.length})</Text>
 {themes.map(theme=><View key={theme.id} style={s.card}>
  <View style={{height:10,backgroundColor:theme.color_a,borderRadius:5,marginBottom:8}}/>
  <Text style={s.title}>{theme.name}</Text>
  <Text style={s.hint}>{theme.label} · {theme.id}</Text>
  <Text style={s.hint}>{theme.color_a} / {theme.color_b} · Accent: {theme.accent}</Text>
 </View>)}
 </>}
 {section==='events'&&<><Text style={s.title}>Event moderation</Text>
 <Text style={s.hint}>Review listing ownership, eligibility and pending media.</Text>
 {!moderationEvents.length&&<Text style={s.hint}>No events require moderation.</Text>}
 {moderationEvents.map(event=><View key={event.id} style={s.card}>
  <Text style={s.title}>{event.title}</Text><Text style={s.hint}>{event.venue} · {event.status} / {event.verification_status}</Text>
  <Text style={s.hint}>Organiser: {event.organiser_name} ({event.organiser_email})</Text>
  {!event.owner_eligible?<><Text style={s.error}>Ineligible owner. Confirm the rightful organiser before reassignment.</Text>
    {ownerFixEvent===event.id?<>{input('Confirmed organiser email',ownerFixEmail,setOwnerFixEmail)}
    {input('Ownership correction reason',ownerFixReason,setOwnerFixReason)}
    {button('Confirm audited correction',()=>Alert.alert('Change event owner?','Only proceed after confirming the intended organiser. Payment settings will be cleared and the listing returned to draft.',[
       {text:'Cancel',style:'cancel'},{text:'Correct owner',style:'destructive',onPress:()=>void correctEventOwner(event.id,event.organiser_id)}]))}
    {button('Cancel',()=>{setOwnerFixEvent('');setOwnerFixEmail('');setOwnerFixReason('')},true)}</>
    :button('Review ownership correction',()=>{setOwnerFixEvent(event.id);setOwnerFixEmail('');setOwnerFixReason('')},true)}
  </>:event.verification_status!=='verified'?<>
   {button('Approve and publish',()=>void moderate(event.id,'verify'))}
   {button('Reject event',()=>Alert.alert('Reject event?','The event will return to draft if there are no issued tickets or active reservations.',[
    {text:'Cancel',style:'cancel'},{text:'Reject',style:'destructive',onPress:()=>void moderate(event.id,'reject')}]),true)}
  </>:null}
 </View>)}
 <Text style={s.title}>Pending media ({moderationMedia.length})</Text>
 {moderationMedia.map(media=><View key={media.id} style={s.card}>
  <Text style={s.hint}>{media.file_name} · {media.media_type}</Text>
  {button('Approve media',()=>void moderate(media.event_id,'approve_media',media.id))}
  {button('Reject media',()=>Alert.alert('Reject media?','This pending asset will be removed.',[
   {text:'Cancel',style:'cancel'},{text:'Reject',style:'destructive',onPress:()=>void moderate(media.event_id,'reject_media',media.id)}]),true)}
 </View>)}
 </>}
 {section==='finance'&&<><Text style={s.title}>Payments, commissions & refunds</Text>
 <AdminFinanceLedger token={token} apiBase={BASE}/>
 <Text style={s.title}>Refund cases</Text>
 <Text style={s.hint}>Verify settlement evidence before marking refunds completed.</Text>
 <Text style={s.hint}>Refunds must be reviewed, initiated and independently verified before settlement. Record evidence separately for each order.</Text>
 {!refundCases.length&&<Text style={s.hint}>No payment exceptions awaiting review.</Text>}
 {refundCases.map(refund=><View key={refund.id} style={s.card}>
  <Text style={s.title}>{refund.event_title}</Text>
  <Text style={s.hint}>{refund.buyer_email} · ₦{Number(refund.amount_ngn).toLocaleString('en-NG')}</Text>
  <Text style={s.hint}>{refund.status} · {refund.refund_status}</Text>
  {!!refund.refund_note&&<Text style={s.hint}>Previous note: {refund.refund_note}</Text>}
  {refund.refund_status==='not_required'&&button('Open review',()=>void updateRefund(refund.id,'review_required'),true)}
  {refund.refund_status==='review_required'&&button('Refund initiated',()=>Alert.alert('Initiate refund?','Only record initiation after arranging repayment to the buyer.',[
   {text:'Cancel',style:'cancel'},{text:'Record initiation',onPress:()=>void updateRefund(refund.id,'initiated')}
  ]),true)}
  {refund.refund_status==='initiated'&&<>
   <TextInput accessibilityLabel={'Settlement reference for '+refund.buyer_email} placeholder="Verified transfer reference (minimum 10 characters)" placeholderTextColor="#a4b1c8" style={s.input} maxLength={500} value={refundNotes[refund.id]||''} onChangeText={value=>setRefundNotes(previous=>({...previous,[refund.id]:value}))}/>
   {button('Mark settled with evidence',()=>Alert.alert('Confirm refund settlement?','Verify the transfer for '+refund.buyer_email+' before confirming. The transaction will become read-only.',[
    {text:'Cancel',style:'cancel'},{text:'Confirm settlement',onPress:()=>void updateRefund(refund.id,'settled')}
   ]))}
  </>}
  {refund.refund_status==='settled'&&<Text style={s.hint}>Settlement recorded — read only</Text>}
 </View>)}
 </>}
 {section==='audit'&&<><Text style={s.title}>Administrative audit trail</Text>
 <Text style={s.hint}>The most recent 100 administrator actions.</Text>
 {!auditHistory.length&&<Text style={s.hint}>No administrator actions recorded.</Text>}
 {auditHistory.map(item=><View key={item.id} style={s.card}>
  <Text style={{color:'#fff',fontWeight:'800'}}>{item.action.replace(/_/g,' ')}</Text>
  <Text style={s.hint}>{item.performed_by} · {new Date(item.created_at).toLocaleString('en-NG')}</Text>
  {!!item.target_email&&<Text style={s.hint}>{item.target_email}</Text>}
  {!!item.details?.reason&&<Text style={s.hint}>Reason: {item.details.reason}</Text>}
 </View>)}
 </>}
 {section==='organisers'&&<><Text style={s.title}>Organiser management</Text>{input('Existing Google-verified User email',organiserEmail,setOrganiserEmail)}{button('Create organiser',()=>{void exec(async()=>{await api('platform/organisers',token,'POST',{action:'create',email:organiserEmail});await load(token)})})}
<Text style={s.title}>Organiser bank account verification</Text>
<Text style={s.hint}>Independently confirm the beneficiary and account number before verifying.</Text>
{bankAccounts.filter(account=>account.status==='pending').map(account=><View key={account.id} style={s.card}>
 <Text style={s.title}>{account.organiser_name}</Text><Text selectable style={s.hint}>{account.bank_name} · {account.account_name} · {account.account_number}</Text>
 {button('Verify account',()=>Alert.alert('Confirm verified beneficiary?','Only approve after independently confirming the bank, account number and beneficiary.',[
   {text:'Cancel',style:'cancel'},{text:'Approve verified account',onPress:()=>void exec(async()=>{
     await api('organiser/payment-account',token,'PATCH',{accountId:account.id,decision:'verified'});await load(token);
   })}
 ]))}
 {bankReviewId===account.id?<><TextInput accessibilityLabel="Reason for rejection" placeholder="Reason for rejection" placeholderTextColor="#a4b1c8" style={s.input} value={bankReviewNote} onChangeText={setBankReviewNote}/>
 {button('Confirm rejection',()=>{void exec(async()=>{
  await api('organiser/payment-account',token,'PATCH',{accountId:account.id,decision:'rejected',note:bankReviewNote});setBankReviewId('');await load(token);
 })},true)}</>:button('Reject account',()=>{setBankReviewId(account.id);setBankReviewNote('')},true)}
</View>)}
{applicants.map(a=><View key={a.id} style={s.card}><Text style={s.title}>{a.full_name}</Text><Text style={s.hint}>{a.email} · {a.role} · {a.account_status}</Text>
 {button(selectedOrganiser===a.id?'Close organiser profile':'View organiser profile',()=>{setSelectedOrganiser(previous=>previous===a.id?'':a.id);setOrganiserName(a.full_name)},true)}
 {selectedOrganiser===a.id&&<View style={s.card}>
  <Text style={s.hint}>Events: {a.event_count??0} · Issued tickets: {a.tickets_issued??0} · Pending orders: {a.pending_orders??0} · Assigned gate operators: {a.gate_operators??0}</Text>
  <Text style={s.hint}>Google verification is required for organiser creation. Open Users & access to review the linked identity and verification record.</Text>
  {a.role==='organiser'&&<>
   {input('Organiser display name',organiserName,setOrganiserName)}
   {button('Save organiser profile',()=>void updateOrganiserName(a.id))}
   {([['can_create_events','Create events'],['can_invite_gates','Invite gate operators'],['can_verify_payments','Verify payments']] as const).map(([key,label])=><Pressable key={key} accessibilityRole="switch" accessibilityState={{checked:a[key]!==false,disabled:busy}} disabled={busy} style={[s.button,s.subButton]} onPress={()=>Alert.alert('Change organiser permission?',label+' will be '+(a[key]!==false?'disabled':'enabled')+' for this organiser.',[
    {text:'Cancel',style:'cancel'},{text:'Confirm',onPress:()=>void toggleOrganiserCapability(a,key)}
   ])}><Text style={s.buttonText}>{a[key]!==false?'✓ ':'○ '}{label}</Text></Pressable>)}
  </>}
 </View>}
{a.role==='user'&&a.requested_role==='organiser'&&<>
  {button('Approve organiser',()=>Alert.alert('Approve organiser?','Approve this existing organiser application?',[
   {text:'Cancel',style:'cancel'},{text:'Approve',onPress:()=>void exec(async()=>{await api('platform/organisers',token,'POST',{action:'approve',userId:a.id});await load(token);Alert.alert('Approved','Organiser access activated.')})}
  ]))}
  {rejectApplicant===a.id?<View style={s.card}>
   <Text style={s.hint}>Rejection reason (minimum 10 characters). This will be saved in the platform audit.</Text>
   <TextInput accessibilityLabel="Organiser rejection reason" placeholder="Explain the rejection" placeholderTextColor="#a4b1c8" style={s.input} multiline maxLength={400} value={rejectReason} onChangeText={setRejectReason}/>
   {button('Confirm rejection',()=>Alert.alert('Reject organiser application?','The request will be declined and the reason recorded. The account remains a User.',[
    {text:'Cancel',style:'cancel'},{text:'Reject application',style:'destructive',onPress:()=>void rejectOrganiser(a.id)}
   ]))}
   {button('Cancel rejection',()=>{setRejectApplicant('');setRejectReason('')},true)}
  </View>:button('Reject application',()=>{setRejectApplicant(a.id);setRejectReason('')},true)}
 </>}
{a.role==='organiser'&&a.account_status==='active'&&button('Suspend organiser',()=>Alert.alert('Suspend organiser access?','This prevents organiser operations but preserves issued tickets, settlements and audit records for '+a.email+'.',[
 {text:'Cancel',style:'cancel'},{text:'Suspend access',style:'destructive',onPress:()=>void exec(async()=>{await api('platform/organisers',token,'POST',{action:'suspend',userId:a.id});await load(token);Alert.alert('Access suspended','Organiser permissions have been revoked until restored.')})}
]),true)}
{a.role==='organiser'&&a.account_status==='suspended'&&button('Restore organiser',()=>Alert.alert('Restore organiser access?','Confirm '+a.email+' is authorised to resume organiser operations.',[
 {text:'Cancel',style:'cancel'},{text:'Restore access',onPress:()=>void exec(async()=>{await api('platform/organisers',token,'POST',{action:'restore',userId:a.id});await load(token);Alert.alert('Access restored','Organiser account is active again.')})}
]))}</View>)}
 </>}
 {section==='accounts'&&<><Text style={s.title}>All users and access</Text><Text style={s.hint}>Search user, organiser and gate identities. Open a profile to see ticket and event counts.</Text>
 {input('Search account by email or name',userSearch,setUserSearch)}
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
  {([['','All'],['user','Users'],['organiser','Organisers'],['platform_admin','Admins']] as const).map(([role,label])=><Pressable key={role} accessibilityRole="button" accessibilityState={{selected:accountRole===role}} style={[s.button,s.subButton,accountRole===role&&{borderColor:'#5DE9C5'}]} onPress={()=>{setAccountRole(role);void searchUsers(1,role)}}><Text style={s.buttonText}>{label}</Text></Pressable>)}
 </View>
 {button('Search accounts',()=>{void searchUsers(1)},true)}
 <Text style={s.hint}>Showing page {accountPage} of {Math.max(1,Math.ceil(accountCount/40))} · {accountCount} matching accounts</Text>
 <View style={{flexDirection:'row',gap:10}}>
  <Pressable accessibilityRole="button" accessibilityState={{disabled:accountPage<=1||busy}} disabled={accountPage<=1||busy} style={[s.button,s.subButton,{flex:1}]} onPress={()=>void searchUsers(accountPage-1)}><Text style={s.buttonText}>Previous</Text></Pressable>
  <Pressable accessibilityRole="button" accessibilityState={{disabled:accountPage*40>=accountCount||busy}} disabled={accountPage*40>=accountCount||busy} style={[s.button,s.subButton,{flex:1}]} onPress={()=>void searchUsers(accountPage+1)}><Text style={s.buttonText}>Next</Text></Pressable>
 </View>
 {!accounts.length&&<Text style={s.hint}>No accounts match these filters.</Text>}
 {accounts.map(a=><View key={a.id} style={s.card}>
  <Text style={{color:'#fff',fontWeight:'800',fontSize:16}}>{a.full_name}</Text><Text style={s.hint}>{a.email} · {a.role} · {a.account_status}</Text>
  <Text style={s.hint}>{a.ticket_count} tickets · {a.order_count} orders · {a.event_count} hosted events · {a.gate_event_count} gates</Text>
  {button(selectedAccount===a.id?'Close user profile':'Open user profile',()=>{setSelectedAccount(current=>current===a.id?'':a.id);setUserName(a.full_name);setDeactivateReason('')},true)}
  {selectedAccount===a.id&&<>
   <Text style={s.hint}>Google identity: {a.google_verified?'Verified Google account':'Not verified / not linked'}</Text>
   <Text style={s.hint}>Order history: {a.order_count} · Tickets: {a.ticket_count} · Hosted events: {a.event_count} · Gate assignments: {a.gate_event_count}</Text>
   {a.role==='platform_admin'?<Text style={s.hint}>Platform Administrator accounts cannot be changed here.</Text>:<>
    {input('Name',userName,setUserName)}{button('Save profile',()=>void changeAccount('configure'))}
    {a.account_status==='active'?button('Suspend account',()=>Alert.alert('Suspend this account?','This prevents sign-in and operational access. Existing orders, ticket admissions and audit history are retained.',[
     {text:'Cancel',style:'cancel'},{text:'Suspend account',style:'destructive',onPress:()=>void changeAccount('suspend')}
    ]),true):a.account_status==='suspended'?button('Restore account',()=>Alert.alert('Restore account access?','Confirm this account is authorised to regain access.',[
     {text:'Cancel',style:'cancel'},{text:'Restore access',onPress:()=>void changeAccount('restore')}
    ])):null}
    {input('Deactivation reason',deactivateReason,setDeactivateReason)}
    {button('Deactivate (keep audit records)',()=>Alert.alert('Deactivate account?','This disables access while retaining legally required orders, tickets, payment and admission records. A written reason is required.',[
     {text:'Cancel',style:'cancel'},{text:'Deactivate account',style:'destructive',onPress:()=>void changeAccount('deactivate')}
    ]),true)}
   </>}
  </>}
 </View>)}
 </>}
 {section==='support'&&<><Text style={s.title}>Support operations</Text>
 <Text style={s.hint}>Real organiser and payment cases. Select a case to edit its own priority, resolution and status. Every saved action is audited.</Text>
 <View style={s.card}><Text style={s.title}>{cases.filter(c=>['open','in_progress'].includes(c.status)).length} cases requiring attention</Text>
  <Text style={s.hint}>{cases.filter(c=>c.priority==='urgent'&&!['closed','resolved'].includes(c.status)).length} urgent · {cases.filter(c=>c.status==='resolved').length} resolved</Text>
 </View>
 {button('Refresh support cases',()=>void exec(async()=>{const data=await api('support/cases',token);setCases(data.cases||[])}),true)}
 {!cases.length&&<Text style={s.hint}>No support requests are currently recorded.</Text>}
 {cases.map(c=><View style={s.card} key={c.id}>
  <Text style={{color:'#fff',fontSize:16,fontWeight:'800'}}>{c.subject}</Text>
  <Text style={s.hint}>{c.organiser_name} · {c.status.replace('_',' ')} · {c.priority}</Text>
  <Text style={s.hint}>{c.description}</Text>
  {!!c.payment_order_id&&<Text style={s.hint}>Linked payment order: {c.payment_order_id}</Text>}
  {!!c.resolution&&<Text style={s.hint}>Last resolution: {c.resolution}</Text>}
  {button(selectedSupportId===c.id?'Close case':'Open case / take action',()=>{
   setSelectedSupportId(current=>current===c.id?'':c.id);
   setSupportDrafts(p=>({...p,[c.id]:p[c.id]||{priority:c.priority,resolution:c.resolution||''}}));
  },true)}
  {selectedSupportId===c.id&&<View style={s.card}>
   <Text style={s.title}>Case details</Text>
   <Text style={s.hint} selectable>Reference: {c.id}</Text>
   <Text style={s.hint}>Priority</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
    {(['low','normal','high','urgent'] as const).map(p=><Pressable key={p} accessibilityRole="button"
     accessibilityLabel={'Set '+p+' priority for '+c.subject}
     accessibilityState={{selected:(supportDrafts[c.id]?.priority||c.priority)===p}}
     onPress={()=>setSupportDrafts(old=>({...old,[c.id]:{priority:p,resolution:old[c.id]?.resolution||c.resolution||''}}))}
     style={[s.button,s.subButton,(supportDrafts[c.id]?.priority||c.priority)===p&&{borderColor:'#8AE7D0'}, {minWidth:78}]}>
      <Text style={s.buttonText}>{p}</Text>
    </Pressable>)}
   </View>
   <TextInput accessibilityLabel={'Resolution for '+c.subject} multiline textAlignVertical="top" maxLength={1500}
    placeholder="Record investigation, resolution and next actions" placeholderTextColor="#94a3b8"
    value={supportDrafts[c.id]?.resolution??c.resolution??''}
    onChangeText={value=>setSupportDrafts(old=>({...old,[c.id]:{priority:old[c.id]?.priority||c.priority,resolution:value}}))}
    style={[s.input,{minHeight:100}]}/>
   {c.status==='open'&&button('Start investigation',()=>confirmCase(c,'in_progress'),true)}
   {!['resolved','closed'].includes(c.status)&&button('Resolve case',()=>confirmCase(c,'resolved'))}
   {c.status==='resolved'&&button('Close resolved case',()=>confirmCase(c,'closed'),true)}
   {['closed','resolved'].includes(c.status)&&button('Reopen case',()=>confirmCase(c,'open'),true)}
   {button('Save case details',()=>confirmCase(c,c.status as 'open'|'in_progress'|'resolved'|'closed'),true)}
  </View>}
 </View>)}
 </>}
 {section==='settings'&&<><Text style={s.title}>Platform settings</Text>
 <Text style={s.hint}>Supported settings: support_email, organiser_approval_policy, event_verification_policy, help_text. Secrets are configured only on the server.</Text>
 {input('Setting key',settingKey,setSettingKey)}{input('Setting value',settingValue,setSettingValue)}
 {button('Save setting',()=>{void saveSetting()})}</>}
 </>}
 </>}
 {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{busy&&<ActivityIndicator color="#45D6C9"/>}
 </ScrollView>
    </Animated.View>
   </View>
   {member&&!desktopNavigation&&menuOpen&&<View style={s.drawerOverlay}>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss navigation drawer" onPress={()=>setMenuOpen(false)} style={s.drawerBackdrop}/>
    <View style={[s.drawerPanel,{width:Math.min(334,viewportWidth*.86)}]}>
     <AdminSidebar active={section} operatorName={member.full_name} onNavigate={navigateAdmin} onClose={()=>setMenuOpen(false)} isDrawer
      pendingSupport={cases.filter(c=>['open','in_progress'].includes(c.status)).length}
      pendingOrganisers={applicants.filter(a=>a.role==='user'&&a.requested_role==='organiser').length}
      pendingRefunds={refundCases.filter(r=>['review_required','initiated'].includes(r.refund_status)).length}/>
    </View>
   </View>
 </View>
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#0b1020'},
 workspaceFrame:{flex:1,flexDirection:'row',minHeight:0},
 menuTrigger:{width:44,height:44,borderRadius:12,borderWidth:1,borderColor:'#5a668a',backgroundColor:'#272a52',alignItems:'center',justifyContent:'center'},
 menuTriggerIcon:{color:'#fff',fontWeight:'900',fontSize:23},
 drawerOverlay:{position:'absolute',top:0,bottom:0,left:0,right:0,zIndex:90,flexDirection:'row'},
 drawerBackdrop:{position:'absolute',top:0,bottom:0,left:0,right:0,backgroundColor:'#020615cc'},
 drawerPanel:{height:'100%',paddingTop:Platform.OS==='android'?(StatusBar.currentHeight||24):Platform.OS==='ios'?45:0},

 head:{backgroundColor:'#111a31',borderBottomWidth:1,borderColor:'#334362',paddingHorizontal:18,paddingTop:(Platform.OS==='android'?(StatusBar.currentHeight||0):Platform.OS==='ios'?54:14)+8,paddingBottom:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 brandRow:{flexDirection:'row',alignItems:'center',gap:10,flexShrink:1},brandCopy:{flexShrink:1},
 brandMark:{width:44,height:44,borderRadius:12},
 brand:{fontSize:19,fontWeight:'900',color:'#fff',letterSpacing:-.5},
 headLabel:{fontSize:12,color:'#c6d3ec',fontWeight:'600',marginTop:3},
 accountBadge:{borderWidth:1,borderColor:'#46577a',paddingHorizontal:11,paddingVertical:9,borderRadius:11},
 body:{padding:18,paddingBottom:38,width:'100%',maxWidth:760,alignSelf:'center',flexGrow:1},
 title:{color:'#f7f8ff',fontSize:22,fontWeight:'800',letterSpacing:-.45,marginTop:12,marginBottom:6},
 hint:{color:'#bac7e0',fontSize:14,lineHeight:21,marginVertical:5},
 input:{borderWidth:1,borderColor:'#455777',backgroundColor:'#192743',color:'#fff',minHeight:50,borderRadius:12,paddingHorizontal:14,marginVertical:7},
 button:{minHeight:47,padding:12,backgroundColor:'#5e3fc4',borderRadius:13,alignItems:'center',justifyContent:'center',marginVertical:5,borderWidth:1,borderColor:'#977eff'},
 subButton:{backgroundColor:'#1c2a46',borderColor:'#4c6185'},buttonText:{color:'#fff',fontSize:14,fontWeight:'800',textAlign:'center'},
 pressed:{opacity:.8,transform:[{scale:.985}]},disabled:{opacity:.55},
 card:{backgroundColor:'#16213a',padding:16,borderRadius:17,borderWidth:1,borderColor:'#374b6f',marginVertical:7},
 error:{color:'#ffd1da',backgroundColor:'#492738',padding:13,borderRadius:11,marginVertical:10},
 loading:{flex:1,backgroundColor:'#0b1020',justifyContent:'center',alignItems:'center',gap:14},
 loadingTrack:{minHeight:24,justifyContent:'center'},loadingDot:{width:9,height:9,borderRadius:5,backgroundColor:'#9ccfff'},
 pressedStill:{opacity:.76},
 welcomeGlow:{position:'absolute',width:212,height:212,borderRadius:106,borderWidth:26,borderColor:'#9ccfff22',right:-68,top:-107},
 welcome:{overflow:'hidden',backgroundColor:'#1e2350',borderRadius:24,borderWidth:1,borderColor:'#634994',padding:24,marginTop:22,gap:13},
 welcomeLabel:{color:'#9ccfff',fontSize:13,fontWeight:'800',letterSpacing:1.2},
 welcomeTitle:{color:'#fff',fontSize:36,lineHeight:40,fontWeight:'900',letterSpacing:-1.5},
 welcomeText:{color:'#d0d9f2',fontSize:16,lineHeight:24,marginBottom:6},
 navigation:{flexDirection:'row',paddingHorizontal:8,paddingTop:8,paddingBottom:Platform.OS==='ios'?24:10,gap:4,backgroundColor:'#111b32',borderTopWidth:1,borderColor:'#354971'},
 navLink:{flex:1,alignItems:'center',justifyContent:'center',minHeight:49,borderRadius:11,paddingHorizontal:2},
 sectionBanner:{borderRadius:18,borderColor:'#65588e',borderWidth:1,backgroundColor:'#1c2240',padding:19,marginTop:8,marginBottom:12,gap:9},
 sectionEyebrow:{fontSize:10,letterSpacing:1.3,fontWeight:'900',color:'#c4adf8'},
 sectionBannerTitle:{fontSize:25,fontWeight:'900',letterSpacing:-.6,color:'#fff'},
 sectionBannerHint:{fontSize:12,lineHeight:18,color:'#c2cce1'},
 navIcon:{fontSize:18,color:'#c1cdec',fontWeight:'900'},
 navCurrent:{backgroundColor:'#32265c',borderTopColor:'#d6ba7e',borderTopWidth:2},navText:{fontSize:11,fontWeight:'700',color:'#c1cdec'},navTextCurrent:{color:'#f2e1ba'},
});
