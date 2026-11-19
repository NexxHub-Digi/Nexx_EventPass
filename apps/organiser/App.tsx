import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,AppState,Alert,Share,ScrollView,Pressable,Text,TextInput,View,StyleSheet,Platform,StatusBar,ActivityIndicator,Image} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
WebBrowser.maybeCompleteAuthSession();

const PORTAL: string="organiser",TITLE="Nexx EventPass Event Organiser",BASE=(process.env.EXPO_PUBLIC_API_URL||'https://nexx-eventpass.vercel.app').replace(/\/$/,'');
type Member={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
type Event={payment_account_id?:string|null;onsite_payments_enabled?:boolean;id:string;title:string;venue:string;organiser_id:string;starts_at:string;price_ngn:number;status:string;description?:string;category?:string;ticket_theme?:string;admission_label?:string;poster_template?:string;verification_status?:string;bank_name?:string;bank_account_name?:string;bank_account_number?:string};
type Ticket={id:string;title:string;qr:string|null;status:string;redeemed_at:string|null};
type BankAccount={id:string;bank_name:string;account_name:string;account_number:string;status:string;review_note?:string};
type FinanceTotals={gross_ngn:number|string;commission_ngn:number|string;organiser_net_ngn:number|string;outstanding_ngn:number|string};
type Order={payment_method?:'manual'|'onsite'|'free';id:string;event_id:string;event_title?:string;buyer_name?:string;buyer_email?:string;status:string;quantity:number;payment_reference:string;receipt_uploaded_at?:string|null;amount_ngn:number};
type Gate={event_id:string;title:string;gate_label:string};
type Applicant={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
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
 const [token,setToken]=useState(''),[member,setMember]=useState<Member|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[orders,setOrders]=useState<Order[]>([]),[gates,setGates]=useState<Gate[]>([]),[eventId,setEventId]=useState('');
 const [bank,setBank]=useState(''),[accName,setAccName]=useState(''),[accNo,setAccNo]=useState(''),[eventTitle,setEventTitle]=useState(''),[venue,setVenue]=useState(''),[date,setDate]=useState(''),[time,setTime]=useState('19:00'),[price,setPrice]=useState('5000'),[capacity,setCapacity]=useState('100'),[keyword,setKeyword]=useState(''),[staff,setStaff]=useState('');
 const [description,setDescription]=useState(''),[category,setCategory]=useState('Music'),[theme,setTheme]=useState('aurora'),[admissionLabel,setAdmissionLabel]=useState('ADMIT ONE'),[posterTemplate,setPosterTemplate]=useState('none'),[media,setMedia]=useState<{id:string;media_type:string;url:string;approved:boolean}[]>([]);
 const [previewOrder,setPreviewOrder]=useState('');
 const [inbox,setInbox]=useState<{pending:number;unread:number;payments:{id:string;event_title:string;buyer_name:string;amount_ngn:number;payment_reference:string;receipt_mime:string}[]}>({pending:0,unread:0,payments:[]});
 const [finances,setFinances]=useState<FinanceTotals|null>(null),[financeError,setFinanceError]=useState('');
 async function refreshFinances(t=token){try{const data=await api('finance',t);setFinances(data.totals||null);setFinanceError('')}catch(error){setFinances(null);setFinanceError('Financial totals unavailable. Retry refresh.')}}
 async function refreshInbox(t=token){setInbox(await api('organiser/payment-inbox',t))}
 useEffect(()=>{
  if(!token||member?.role!=='organiser'||member.account_status!=='active')return;
  const refresh=()=>{if(AppState.currentState==='active')void refreshInbox(token).catch(()=>{})};
  refresh();
  const interval=setInterval(refresh,15000);
  const listener=AppState.addEventListener('change',refresh);
  return ()=>{clearInterval(interval);listener.remove()};
 },[token,member?.id,member?.role,member?.account_status]);
 function reviewInbox(id:string,decision:'approved'|'rejected'){
  const approving=decision==='approved';
  Alert.alert(approving?'Confirm funds received':'Reject payment',approving?'Approve only after confirming the transfer reached the bank account.':'The buyer can ask Platform Support to review their submitted receipt.',[
   {text:'Cancel',style:'cancel'},
   {text:approving?'Approve':'Reject',onPress:()=>void exec(async()=>{
    await api('review',token,'POST',{orderId:id,decision});
    await refreshInbox();
    if(eventId)setOrders((await api('orders?eventId='+eventId,token)).orders||[]);
   })}
  ]);
 }
 const [bankAccounts,setBankAccounts]=useState<BankAccount[]>([]),[eventBankId,setEventBankId]=useState('');
 const verifiedBanks=bankAccounts.filter(account=>account.status==='verified');
 const [onsiteOrder,setOnsiteOrder]=useState(''),[collected,setCollected]=useState(''),[collectionRef,setCollectionRef]=useState('');
 const [tab,setTab]=useState<'dashboard'|'events'|'tickets'|'payments'|'team'|'profile'>('dashboard');
 const [themes,setThemes]=useState<[string,string][]>([['aurora','Aurora Glow'],['midnight','Midnight Gold'],['sunset','Sunset Social'],['neon','Neon Pulse'],['minimal','Minimal Ivory'],['custom','Custom Artwork']]);
 async function uploadEventFile(purpose=''){if(!eventId)throw Error('Select an event');
  const result=await DocumentPicker.getDocumentAsync({type:purpose==='ticket_art'?['image/jpeg','image/png','image/webp']:['image/jpeg','image/png','image/webp','video/mp4','video/webm']});
  if(result.canceled)return;const file=result.assets[0];
  await exec(async()=>{
   const form=new FormData();form.append('eventId',eventId);if(purpose)form.append('purpose',purpose);
   form.append('file',{uri:file.uri,name:file.name,type:file.mimeType||'image/jpeg'} as unknown as Blob);
   await api('events/media',token,'POST',form);
   setMedia((await api('events/media?eventId='+eventId,token)).media||[]);
   Alert.alert('Uploaded','Media is waiting for Platform Admin review.');
  });
 }
 async function saveDesign(){if(!eventId)return;
  await exec(async()=>{
   await api('events',token,'PATCH',{eventId,description,category,ticketTheme:theme,admissionLabel,posterTemplate});
   await load(token);Alert.alert('Design saved','Updates are waiting for verification');
  });
 }
 async function load(t:string){
 const me=await api('auth/me',t);if(!me.user)throw Error('Please sign in again');
 if(!(PORTAL==='organiser'&&(me.user.requested_role==='organiser'||me.user.account_status==='pending')) && !(me.portals||[]).includes(PORTAL)){await SecureStore.deleteItemAsync('eventpass_token');setMember(null);setToken('');throw Error('This account is not authorised for this app')}
 setMember(me.user);
 if(me.user.account_status==='pending'||me.user.requested_role==='organiser')return;
 const ev=await api('events',t);setEvents(ev.events||[]);
 const [b,themeList]=await Promise.all([api('organiser/payment-account',t),api('ticket-themes',t)]);
 await Promise.all([refreshInbox(t).catch(()=>{}),refreshFinances(t)]);
 if(themeList.themes?.length)setThemes(themeList.themes.map((x:{id:string;name:string})=>[x.id,x.name]));
 setBankAccounts(b.accounts||[]);
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
   const redirect='eventpassorganiser://oauth';
   const verifier=Array.from(Crypto.getRandomBytes(32)).map(b=>b.toString(16).padStart(2,'0')).join('');
   const challenge=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,verifier);
   const result=await WebBrowser.openAuthSessionAsync(BASE+'/api/auth/google?portal='+encodeURIComponent(PORTAL)+'&client=native&challenge='+challenge,redirect);
   if(result.type!=='success')throw Error('Google sign-in was cancelled');
   const code=new URL(result.url).searchParams.get('code');
   if(!code)throw Error('Google did not return a valid sign-in code');
   const data=await api('auth/mobile','','POST',{code,client:PORTAL,codeVerifier:verifier});
   await SecureStore.setItemAsync('eventpass_token',data.token);
   setToken(data.token);await load(data.token);
 })}
 async function logout(){try{if(token)await api('auth/logout',token,'POST')}catch{setError('Server logout unavailable; session may remain active until expiry.')}finally{await SecureStore.deleteItemAsync('eventpass_token');setToken('');setMember(null)}}
 const input=(hint:string,value:string,update:(x:string)=>void,secret=false)=><TextInput style={s.input} placeholder={hint} placeholderTextColor="#94a3b8" value={value} onChangeText={update} autoCapitalize="none" secureTextEntry={secret}/>;
 const button=(label:string,fn:()=>void,sub=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled:busy}} onPress={fn} disabled={busy} style={({pressed})=>[s.button,sub&&s.subButton,pressed&&(reduceMotion?s.pressedStill:s.pressed),busy&&s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 const surfaceMotion=useRef(new Animated.Value(1)).current;
 const opening=booting||(busy&&!member);
 const surface=opening?'opening':member?tab:'signin';
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
   {!reduceMotion?<ActivityIndicator color={'#8ff0d5'}/>:<View style={s.loadingDot}/>}
  </View>
 </Animated.View>;
 return <View style={s.root}>
  <StatusBar barStyle="light-content"/>
  <View style={s.head}>
   <Pressable style={s.brandRow} accessibilityRole="button" accessibilityLabel="Organiser home" disabled={busy||!member} onPress={()=>{
     setTab('dashboard');scroll.current?.scrollTo({y:0,animated:false});
   }}>
    <Image accessible={false} source={require('./assets/app-icon.png')} style={s.brandMark}/><View style={s.brandCopy}>
    <Text style={s.brand}>Nexx EventPass</Text><Text style={s.headLabel}>Organiser</Text>
   </View></Pressable>
   {member&&<Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={busy} onPress={()=>void logout()} style={s.accountBadge}><Text style={s.headLabel}>Sign out</Text></Pressable>}
  </View>
  <Animated.View style={[{flex:1},surfaceStyle]}>
  <ScrollView ref={scroll} key={member?tab:'signin'} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
 {!member?<View style={s.welcome}>
   <View pointerEvents="none" style={s.welcomeGlow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/>
   <Text style={s.welcomeLabel}>Event studio</Text><Text style={s.welcomeTitle}>Run your events.</Text>
   <Text style={s.welcomeText}>Manage listings, issue tickets and confirm payments.</Text>
   {button('Continue with Google',()=>{void login()})}
  </View>:<>
 <Text style={s.title}>Welcome, {member.full_name}</Text><Text style={s.hint}>{member.email}</Text>
 {inbox.unread>0&&member.role==='organiser'&&button(inbox.unread+' new payment receipt'+(inbox.unread===1?'':'s'),()=>setTab('payments'))}
 {(member.account_status==='pending'||member.requested_role==='organiser')?<View style={s.card}><Text style={s.title}>Approval pending</Text><Text style={s.hint}>Platform Admin must approve this organiser application.</Text></View>:<>{button('Refresh',()=>{void exec(async()=>load(token))},true)}

 {tab==='dashboard'&&<View style={s.card}><Text style={s.title}>Organiser dashboard</Text>
  <Text style={s.hint}>Your events: {events.filter(e=>e.organiser_id===member.id).length} · Published: {events.filter(e=>e.organiser_id===member.id&&e.status==='published').length}</Text>
  <Text style={s.hint}>Selected event: {events.find(e=>e.id===eventId)?.title||'None'}</Text>
  <Text style={s.hint}>Pending payment reviews across your events: {inbox.pending}</Text>
  <Text style={s.hint}>New payment notifications: {inbox.unread}</Text>
  {finances?<View accessibilityLabel="Verified organiser financial totals" style={[s.card,{backgroundColor:'#1d2a49'}]}>
   <Text style={s.hint}>Confirmed collections: ₦{Number(finances.gross_ngn).toLocaleString('en-NG')}</Text>
   <Text style={s.hint}>Platform commissions: ₦{Number(finances.commission_ngn).toLocaleString('en-NG')}</Text>
   <Text style={s.hint}>Organiser net: ₦{Number(finances.organiser_net_ngn).toLocaleString('en-NG')}</Text>
   <Text style={s.hint}>Outstanding commission remittance: ₦{Number(finances.outstanding_ngn).toLocaleString('en-NG')}</Text>
  </View>:<Text accessibilityRole="alert" style={s.hint}>{financeError||'Loading verified financial totals…'}</Text>}
  {button('Refresh dashboard',()=>void exec(async()=>{await Promise.all([refreshInbox(),refreshFinances()])}),true)}
  {button('Manage events',()=>setTab('events'))}{button('Review payments',()=>setTab('payments'),true)}
 </View>}
 {tab==='profile'&&<View style={s.card}><Text style={s.title}>My organiser profile</Text><Text style={s.hint}>Name: {member.full_name}</Text><Text style={s.hint}>Email: {member.email}</Text><Text style={s.hint}>Status: {member.account_status}</Text></View>}
 {events.some(e=>e.organiser_id===member.id)&&<View style={s.card}><Text style={s.hint}>ACTIVE EVENT · Choose an event for tickets, payments and gates</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{events.filter(e=>e.organiser_id===member.id).map(e=><Pressable key={e.id} onPress={()=>{setEventId(e.id);setOrders([]);setMedia([]);setDescription(e.description||'');setCategory(e.category||'Other');setTheme(e.ticket_theme||'aurora');setAdmissionLabel(e.admission_label||'ADMIT ONE');setPosterTemplate(e.poster_template||'none');void exec(async()=>{setOrders((await api('orders?eventId='+e.id,token)).orders||[]);setMedia((await api('events/media?eventId='+e.id,token)).media||[])})}} style={[s.navChip,eventId===e.id&&s.navSelected]}><Text style={s.buttonText}>{e.title}</Text></Pressable>)}</ScrollView></View>}
 {tab==='payments'&&<>
 <Text style={s.title}>Pending payments ({inbox.pending})</Text>
 {button('Refresh pending payments',()=>void exec(async()=>refreshInbox()),true)}
 {inbox.unread>0&&button('Mark notifications read',()=>void exec(async()=>{await api('organiser/payment-inbox',token,'PATCH');await refreshInbox()}),true)}
 {inbox.payments.map(payment=><View style={s.card} key={payment.id}>
  <Text style={s.title}>{payment.event_title}</Text>
  <Text style={s.hint}>{payment.buyer_name} · ₦{Number(payment.amount_ngn).toLocaleString()} · {payment.payment_reference}</Text>
  {payment.receipt_mime?.startsWith('image/')?<>
   {button(previewOrder===payment.id?'Hide submitted receipt':'View submitted receipt',()=>setPreviewOrder(previewOrder===payment.id?'':payment.id),true)}
   {previewOrder===payment.id&&<Image accessibilityLabel="Submitted payment receipt" source={{
    uri:BASE+'/api/orders/receipt?orderId='+encodeURIComponent(payment.id),headers:{Authorization:'Bearer '+token}
   }} style={{width:'100%',height:300}} resizeMode="contain"/>}
  </>:<Text style={s.hint}>View PDF receipts in the organiser web workspace.</Text>}
  {button('Approve verified payment',()=>reviewInbox(payment.id,'approved'))}
  {button('Reject payment',()=>reviewInbox(payment.id,'rejected'),true)}
 </View>)}
 <Text style={s.title}>Your bank details</Text>{input('Bank',bank,setBank)}{input('Account name',accName,setAccName)}{input('Account number',accNo,setAccNo)}
{bankAccounts.map(account=><View key={account.id} style={s.card}><Text style={s.hint}>{account.bank_name} · {account.account_number} · {account.status}</Text>{!!account.review_note&&<Text style={s.hint}>{account.review_note}</Text>}</View>)}
{button('Submit account for review',()=>{void exec(async()=>{
 await api('organiser/payment-account',token,'POST',{bankName:bank,accountName:accName,accountNumber:accNo});
 setBank('');setAccName('');setAccNo('');await load(token);Alert.alert('Bank account submitted','Platform Admin must verify it before use.');
})})}
</>}
{tab==='events'&&<>
<Text style={s.title}>Create a new event</Text><Text style={s.hint}>Create multiple listings; each is reviewed before it appears in User discovery.</Text>
{input('Event title',eventTitle,setEventTitle)}{input('Event venue',venue,setVenue)}{input('Description and experience details',description,setDescription)}
{input('Category (Music / Festival / Business...)',category,setCategory)}
{input('Date (YYYY-MM-DD)',date,setDate)}{input('Time (HH:MM, 24-hour)',time,setTime)}
{input('Price in NGN',price,setPrice)}{input('Capacity',capacity,setCapacity)}{input('Private QR keyword (8+ characters)',keyword,setKeyword,true)}
<Text style={s.title}>Ticket templates</Text><Text style={s.hint}>Choose one of the luxury STJ-inspired masquerade layouts, or another theme. Every issued ticket receives its own real QR.</Text>{theme.startsWith('stj-')&&<View style={{borderWidth:3,borderColor:'#f1c36a',backgroundColor:'#240732',borderRadius:12,flexDirection:'row',overflow:'hidden',marginVertical:12,minHeight:145}}>
 <View style={{flex:3,padding:11,justifyContent:'space-around',alignItems:'center'}}>
  <Text style={{fontSize:27}}>🎭 ✨</Text><Text numberOfLines={2} style={{fontSize:16,color:'#ffe4a3',fontWeight:'900',textAlign:'center'}}>{eventTitle||events.find(e=>e.id===eventId)?.title||'Your Masquerade Event'}</Text>
  <Text style={{fontSize:10,color:'#fff',textAlign:'center'}}>{venue||events.find(e=>e.id===eventId)?.venue||'Your event venue'}</Text>
  <Text style={{fontSize:12,color:'#f9d77b',fontWeight:'900'}}>{admissionLabel}</Text>
 </View><View style={{flex:1,borderLeftColor:'#ffcf74',borderLeftWidth:2,borderStyle:'dashed',alignItems:'center',justifyContent:'center',padding:6}}>
  <Text style={{fontSize:25,color:'#f7d77c'}}>◈</Text><Text style={{fontSize:8,color:'#fff',textAlign:'center'}}>QR GENERATED ON APPROVAL</Text>
 </View></View>}
{input('Admission label (e.g. ADMIT ONE — MASK COMPULSORY)',admissionLabel,setAdmissionLabel)}<ScrollView horizontal contentContainerStyle={{gap:8,paddingBottom:9}}>
{themes.map(([id,name])=><Pressable key={id} onPress={()=>setTheme(id)} style={[s.card,{minWidth:120,backgroundColor:theme===id?'#6240a9':'#273351',borderColor:theme===id?'#49f1d4':'#425173'}]}><Text style={{color:'#fff',fontWeight:'800'}}>{name}</Text><Text style={s.hint}>{theme===id?'✓ Selected':'Preview'}</Text></Pressable>)}</ScrollView>
<Text style={s.title}>Promotional poster collection</Text><Text style={s.hint}>The two portrait layouts promote your event and do not contain an admission QR.</Text>
<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12,marginVertical:13}}>
 {([['stj-apartment-party','Masked Apartment Evening'],['stj-lounge-nights','Lounge Masquerade Night']] as const).map(([id,name])=><Pressable key={id} onPress={()=>setPosterTemplate(posterTemplate===id?'none':id)} style={[s.card,{width:150,height:205,backgroundColor:id==='stj-apartment-party'?'#45124c':'#35072e',borderColor:posterTemplate===id?'#ffd878':'#59466b',borderWidth:2,alignItems:'center',justifyContent:'space-around'}]}>
 <Text style={{fontSize:33}}>🎭</Text><Text style={{color:'#ffe3a0',textAlign:'center',fontWeight:'900',fontSize:14}}>{eventTitle||'Your Event'}</Text><Text style={{color:'#f4d88b',fontSize:10,textAlign:'center'}}>{name}</Text><Text style={{color:'#fff',fontSize:10}}>{posterTemplate===id?'✓ Selected':'Choose poster'}</Text>
 </Pressable>)}
</ScrollView>
{Number(price)>0&&<><Text style={s.hint}>Verified bank account for this event</Text>
 {!verifiedBanks.length&&<Text style={s.hint}>Submit a bank account and wait for Platform Admin verification.</Text>}
 {verifiedBanks.map(account=><Pressable key={account.id} accessibilityRole="radio" accessibilityState={{selected:eventBankId===account.id}} onPress={()=>setEventBankId(account.id)} style={s.card}><Text style={s.hint}>{eventBankId===account.id?'✓ ':''}{account.bank_name} · {account.account_number}</Text></Pressable>)}
</>}
{button('Create event for review',()=>{void exec(async()=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw Error('Use date YYYY-MM-DD and time HH:MM');
 const startsAt=new Date(date+'T'+time+':00');
 if(!Number.isFinite(startsAt.getTime())||startsAt.getTime()<=Date.now())throw Error('Choose a future event date and time');
 const result=await api('events',token,'POST',{title:eventTitle,venue,description,category,ticketTheme:theme,admissionLabel,posterTemplate,startsAt:startsAt.toISOString(),priceNgn:Number(price),paymentAccountId:eventBankId,capacity:Number(capacity),qrKeyword:keyword});
 await load(token);setEventId(result.event.id);setEventTitle('');setKeyword('');
 Alert.alert('Event created','Upload posters and ticket artwork, then wait for Platform Admin verification.');
})})}
<Text style={s.title}>My events</Text>{events.filter(e=>e.organiser_id===member.id).map(e=><Pressable key={e.id} style={[s.card,eventId===e.id&&{borderColor:'#45D6C9'}]} onPress={()=>{setEventId(e.id);setDescription(e.description||'');setCategory(e.category||'Other');setTheme(e.ticket_theme||'aurora');setAdmissionLabel(e.admission_label||'ADMIT ONE');setPosterTemplate(e.poster_template||'none');void exec(async()=>{setOrders((await api('orders?eventId='+e.id,token)).orders||[]);setMedia((await api('events/media?eventId='+e.id,token)).media||[])})}}><Text style={s.title}>{e.title}</Text><Text style={s.hint}>{e.status} · {e.verification_status||'verified'}</Text></Pressable>)}
</>}
{!!eventId&&<>
 {tab==='tickets'&&<>
 <Text style={s.title}>Event media & ticket artwork</Text><Text style={s.hint}>Upload posters, short videos and custom design images for platform review.</Text>
 {button('Upload photo or short video',()=>{void uploadEventFile()})}
 {button('Import custom ticket artwork',()=>{void uploadEventFile('ticket_art')},true)}
 <ScrollView horizontal contentContainerStyle={{gap:12,marginVertical:14}}>{media.map(m=><View key={m.id} style={{width:160}}>{m.media_type==='video'?<Text style={s.hint}>▶ Video uploaded</Text>:<Image source={{uri:BASE+m.url,headers:{Authorization:'Bearer '+token}}} style={{width:150,height:115,borderRadius:10}}/>}<Text style={s.hint}>{m.approved?'Approved':'Pending media review'}</Text></View>)}</ScrollView>
 <Text style={s.title}>Update ticket design</Text>{theme.startsWith('stj-')&&<View style={{borderWidth:3,borderColor:'#f1c36a',backgroundColor:'#240732',borderRadius:12,flexDirection:'row',overflow:'hidden',marginVertical:12,minHeight:145}}>
 <View style={{flex:3,padding:11,justifyContent:'space-around',alignItems:'center'}}>
  <Text style={{fontSize:27}}>🎭 ✨</Text><Text numberOfLines={2} style={{fontSize:16,color:'#ffe4a3',fontWeight:'900',textAlign:'center'}}>{eventTitle||events.find(e=>e.id===eventId)?.title||'Your Masquerade Event'}</Text>
  <Text style={{fontSize:10,color:'#fff',textAlign:'center'}}>{venue||events.find(e=>e.id===eventId)?.venue||'Your event venue'}</Text>
  <Text style={{fontSize:12,color:'#f9d77b',fontWeight:'900'}}>{admissionLabel}</Text>
 </View><View style={{flex:1,borderLeftColor:'#ffcf74',borderLeftWidth:2,borderStyle:'dashed',alignItems:'center',justifyContent:'center',padding:6}}>
  <Text style={{fontSize:25,color:'#f7d77c'}}>◈</Text><Text style={{fontSize:8,color:'#fff',textAlign:'center'}}>QR GENERATED ON APPROVAL</Text>
 </View></View>}
{input('Ticket admission label',admissionLabel,setAdmissionLabel)}<ScrollView horizontal contentContainerStyle={{gap:8}}>{themes.map(([id,name])=><Pressable key={id} onPress={()=>setTheme(id)} style={[s.card,{backgroundColor:theme===id?'#513c83':'#273351'}]}><Text style={s.buttonText}>{name}</Text></Pressable>)}</ScrollView>
 {input('Description',description,setDescription)}{input('Category',category,setCategory)}{button('Save event design',()=>{void saveDesign()})}
<Text style={s.title}>Promotional poster collection</Text><Text style={s.hint}>The two portrait layouts promote your event and do not contain an admission QR.</Text>
<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12,marginVertical:13}}>
 {([['stj-apartment-party','Masked Apartment Evening'],['stj-lounge-nights','Lounge Masquerade Night']] as const).map(([id,name])=><Pressable key={id} onPress={()=>setPosterTemplate(posterTemplate===id?'none':id)} style={[s.card,{width:150,height:205,backgroundColor:id==='stj-apartment-party'?'#45124c':'#35072e',borderColor:posterTemplate===id?'#ffd878':'#59466b',borderWidth:2,alignItems:'center',justifyContent:'space-around'}]}>
 <Text style={{fontSize:33}}>🎭</Text><Text style={{color:'#ffe3a0',textAlign:'center',fontWeight:'900',fontSize:14}}>{eventTitle||'Your Event'}</Text><Text style={{color:'#f4d88b',fontSize:10,textAlign:'center'}}>{name}</Text><Text style={{color:'#fff',fontSize:10}}>{posterTemplate===id?'✓ Selected':'Choose poster'}</Text>
 </Pressable>)}
</ScrollView>
 </>}
 {tab==='payments'&&<>
 <Text style={s.title}>Payment approvals</Text>
 {events.some(event=>event.id===eventId&&event.price_ngn>0)&&<><Text style={s.hint}>Checkout bank account</Text>
 {verifiedBanks.map(account=><Pressable key={account.id} accessibilityRole="radio" accessibilityState={{selected:events.find(event=>event.id===eventId)?.payment_account_id===account.id}}
  onPress={()=>void exec(async()=>{await api('events',token,'PATCH',{action:'payment_account',eventId,paymentAccountId:account.id});await load(token)})} style={s.card}>
   <Text style={s.hint}>{events.find(event=>event.id===eventId)?.payment_account_id===account.id?'✓ ':''}{account.bank_name} · {account.account_number}</Text>
  </Pressable>)}</>}
 {button(events.find(event=>event.id===eventId)?.onsite_payments_enabled?'Disable onsite payments':'Enable onsite payments',()=>{void exec(async()=>{
  const enabled=!events.find(event=>event.id===eventId)?.onsite_payments_enabled;
  await api('finance',token,'PATCH',{action:'onsite',eventId,enabled});
  setEvents(previous=>previous.map(event=>event.id===eventId?{...event,onsite_payments_enabled:enabled}:event));
 })},true)}
 {orders.map(o=><View style={s.card} key={o.id}>
  <Text style={s.hint}>{o.buyer_name||o.buyer_email} · ₦{Number(o.amount_ngn).toLocaleString()} · {o.status}</Text>
  <Text selectable style={s.hint}>Order {o.id}</Text>
  <Text style={s.hint}>{o.payment_method==='onsite'?'Onsite':o.payment_method==='free'?'Free':'Receipt: '+(o.receipt_uploaded_at?'Submitted — view on web':'Missing')}</Text>
  {o.status==='pending'&&(o.payment_method==='onsite'?
   onsiteOrder===o.id?<>{input('Exact amount collected (₦)',collected,setCollected)}{input('Collection reference',collectionRef,setCollectionRef)}
   {button('Confirm collection and issue tickets',()=>{void exec(async()=>{
    await api('review',token,'POST',{orderId:o.id,decision:'approved',collectedAmountNgn:Number(collected),collectionReference:collectionRef});
    setOrders((await api('orders?eventId='+eventId,token)).orders||[]);setOnsiteOrder('');
   })})}</>:button('Record onsite collection',()=>{setCollected('');setCollectionRef('');setOnsiteOrder(o.id)}):
   button(o.payment_method==='free'?'Approve free ticket':'Approve verified transfer',()=>{void exec(async()=>{
    await api('review',token,'POST',{orderId:o.id,decision:'approved'});
    setOrders((await api('orders?eventId='+eventId,token)).orders||[]);
   })}))}
 </View>)}
</>}
{tab==='team'&&<>
{input('Gate operator email',staff,setStaff)}{button('Invite gate operator',()=>{void exec(async()=>{const r=await api('gates',token,'POST',{eventId,email:staff,gateLabel:'Main gate'});await Share.share({message:'Your private Nexx EventPass gate invitation (expires in 72 hours): '+r.invitationLink});Alert.alert('Invitation created','Share the link privately. The invited recipient signs in using Google to accept.')})})}{button('Add existing verified person',()=>{void exec(async()=>{const r=await api('gates',token,'POST',{eventId,email:staff,gateLabel:'Main gate',mode:'add'});Alert.alert('Operator added',r.message);setStaff('')})},true)}</>}
</>}
 </>}
 {button('Sign out',()=>{void logout()},true)}</>}
 {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{busy&&<ActivityIndicator color="#45D6C9"/>}
 </ScrollView>
  </Animated.View>
 {member?.role==='organiser'&&<View style={s.navigation}>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingHorizontal:5}}>
   {([['dashboard','Overview'],['events','Events'],['tickets','Ticket Studio'],['payments','Payments'],['team','Gate Team'],['profile','Profile']] as const).map(([id,label])=>
    <Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:tab===id}} disabled={busy} style={({pressed})=>[s.navChip,tab===id&&s.navSelected,pressed&&(reduceMotion?s.pressedStill:s.pressed)]} onPress={()=>setTab(id)}>
     <Text style={[s.navText,tab===id&&s.navTextCurrent]}>{label}</Text>
    </Pressable>)}
  </ScrollView>
 </View>}
 </View>
}
const s=StyleSheet.create({
 root:{flex:1,backgroundColor:'#0b1020'},
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
 loadingTrack:{minHeight:24,justifyContent:'center'},loadingDot:{width:9,height:9,borderRadius:5,backgroundColor:'#8ff0d5'},
 pressedStill:{opacity:.76},
 welcomeGlow:{position:'absolute',width:212,height:212,borderRadius:106,borderWidth:26,borderColor:'#8ff0d522',right:-68,top:-107},
 welcome:{overflow:'hidden',backgroundColor:'#1e2350',borderRadius:24,borderWidth:1,borderColor:'#634994',padding:24,marginTop:22,gap:13},
 welcomeLabel:{color:'#8ff0d5',fontSize:13,fontWeight:'800',letterSpacing:1.2},
 welcomeTitle:{color:'#fff',fontSize:36,lineHeight:40,fontWeight:'900',letterSpacing:-1.5},
 welcomeText:{color:'#d0d9f2',fontSize:16,lineHeight:24,marginBottom:6},
 navigation:{flexDirection:'row',paddingHorizontal:8,paddingTop:8,paddingBottom:Platform.OS==='ios'?24:10,gap:4,backgroundColor:'#111b32',borderTopWidth:1,borderColor:'#354971'},
 navLink:{flex:1,alignItems:'center',justifyContent:'center',minHeight:49,borderRadius:11,paddingHorizontal:2},
 navChip:{backgroundColor:'#182744',borderWidth:1,borderColor:'#3a5078',borderRadius:12,minHeight:45,justifyContent:'center',paddingHorizontal:12,paddingVertical:8},navSelected:{borderColor:'#8ff0d5',backgroundColor:'#242852'},
 navCurrent:{backgroundColor:'#32265c'},navText:{fontSize:12,fontWeight:'700',color:'#c1cdec'},navTextCurrent:{color:'#8ff0d5'},
});
