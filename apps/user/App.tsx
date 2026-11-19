import React,{useEffect,useRef,useState} from 'react';
import {Alert,ScrollView,Pressable,Text,TextInput,View,StyleSheet,Platform,StatusBar,ActivityIndicator,Image,Linking} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
WebBrowser.maybeCompleteAuthSession();
import QRCode from 'react-native-qrcode-svg';
import * as DocumentPicker from 'expo-document-picker';
const PORTAL: string="user",TITLE="Nexx EventPass User",BASE=(process.env.EXPO_PUBLIC_API_URL||'https://nexx-eventpass.vercel.app').replace(/\/$/,'');
type Member={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
type Event={visibility?:string;onsite_payments_enabled?:boolean;id:string;title:string;venue:string;organiser_id:string;starts_at:string;price_ngn:number;status:string;description?:string;category?:string;ticket_theme?:string;cover_media_id?:string|null;video_media_id?:string|null;bank_name?:string;bank_account_name?:string;bank_account_number?:string};
type Ticket={id:string;title:string;qr:string|null;status:string;redeemed_at:string|null;ticket_theme?:string;ticket_art_id?:string|null};
type Order={payment_method?:'manual'|'onsite'|'free';id:string;event_id:string;event_title?:string;buyer_name?:string;buyer_email?:string;status:string;quantity:number;payment_reference:string;receipt_uploaded_at?:string|null;amount_ngn:number;reservation_expires_at?:string;refund_status?:string};
type Gate={event_id:string;title:string;gate_label:string};
type Applicant={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
async function api(p:string,t:string,method='GET',data?:unknown){const multi=data instanceof FormData;const r=await fetch(BASE+'/api/'+p,{method,headers:{...(multi?{}:{'Content-Type':'application/json'}),...(t?{Authorization:'Bearer '+t}:{})},body:multi?data: data?JSON.stringify(data):undefined});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v}
export default function App(){
 const scroll=useRef<ScrollView>(null);
 const [booting,setBooting]=useState(true);
 const [section,setSection]=useState<'discover'|'tickets'|'orders'|'profile'>('discover');
 const [token,setToken]=useState(''),[member,setMember]=useState<Member|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[orders,setOrders]=useState<Order[]>([]),[gates,setGates]=useState<Gate[]>([]),[eventId,setEventId]=useState('');
 const [ref,setRef]=useState(''),[qty,setQty]=useState('1'),[proof,setProof]=useState<DocumentPicker.DocumentPickerAsset|null>(null);
 const [query,setQuery]=useState(''),[category,setCategory]=useState('All'),[gallery,setGallery]=useState<{id:string;media_type:string;url:string}[]>([]);
 const [inventory,setInventory]=useState<{eventId:string;categories:{id:string;name:string}[];generalCapacity:number;payment:{payment_account_id:string|null;bank_name:string;bank_account_name:string;bank_account_number:string;onsite_payments_enabled:boolean}}|null>(null);
 const [onsite,setOnsite]=useState(false);
 const [ticketCategoryId,setTicketCategoryId]=useState('');
 useEffect(()=>{
  if(!eventId)return;
  let current=true;
  setTicketCategoryId('');setOnsite(false);
  void Promise.all([api('events/ticket-categories?eventId='+encodeURIComponent(eventId),token),
   api('events/payment-instructions?eventId='+encodeURIComponent(eventId),token)]).then(([data,payment])=>{
   if(!current)return;
   setInventory({eventId,categories:data.categories,generalCapacity:data.generalCapacity,payment:payment.payment});
   if(data.generalCapacity===0)setTicketCategoryId(data.categories[0]?.id||'');
  }).catch(error=>{if(current)setError(error instanceof Error?error.message:'Could not load ticket categories')});
  return ()=>{current=false};
 },[eventId,token]);
 const [paymentCases,setPaymentCases]=useState<{payment_order_id:string;status:string;resolution:string}[]>([]);
 const [supportOrder,setSupportOrder]=useState(''),[supportDescription,setSupportDescription]=useState('');
 async function refreshPaymentCases(t=token){
  setPaymentCases((await api('support/cases?scope=payment',t)).cases||[]);
 }
 const [palette,setPalette]=useState<Record<string,string>>({});
 async function load(t:string){
 const me=await api('auth/me',t);if(!me.user)throw Error('Please sign in again');
 if(!(PORTAL==='organiser'&&me.user.account_status==='pending') && !(me.portals||[]).includes(PORTAL)){await SecureStore.deleteItemAsync('eventpass_token');setMember(null);setToken('');throw Error('This account is not authorised for this app')}
 setMember(me.user);
 if(me.user.account_status==='pending')return;
 const ev=await api('events',t);setEvents(ev.events||[]);
 const [ticketResult,orderResult,themesResult]=await Promise.all([api('tickets',t),api('orders',t),api('ticket-themes',t)]);
 setTickets(ticketResult.tickets||[]);setOrders(orderResult.orders||[]);await refreshPaymentCases(t);
 setPalette(Object.fromEntries((themesResult.themes||[]).map((x:{id:string;color_a:string})=>[x.id,x.color_a])));
 }
 useEffect(()=>{
  let mounted=true;
  void SecureStore.getItemAsync('eventpass_token').then(async t=>{if(t&&mounted){setToken(t);await load(t)}})
   .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Could not open your session')})
   .finally(()=>{if(mounted)setBooting(false)});
  return ()=>{mounted=false};
 },[]);
 useEffect(()=>{if(!token||!member||member.account_status!=='active')return;
  const id=setInterval(()=>{
   void Promise.all([api('tickets',token),api('orders',token),refreshPaymentCases()]).then(([wallet,list])=>{
    setTickets(wallet.tickets||[]);setOrders(list.orders||[]);
   }).catch(()=>{});
  },15000);
  return ()=>clearInterval(id);
 },[token,member?.id,member?.account_status]);
 async function exec(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function login(){await exec(async()=>{
   const redirect='eventpassuser://oauth';
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
 const button=(label:string,fn:()=>void,sub=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled:busy}} onPress={fn} disabled={busy} style={({pressed})=>[s.button,sub&&s.subButton,pressed&&s.pressed,busy&&s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 if(booting||(busy&&!member))return <View style={{flex:1,backgroundColor:'#0b1020',justifyContent:'center',alignItems:'center',gap:14}} accessibilityLiveRegion="polite">
  <Image accessible={false} source={require('./assets/app-icon.png')} style={{width:72,height:72,borderRadius:18}}/>
  <Text style={{color:'#f8faff',fontWeight:'800',fontSize:22}}>Nexx EventPass</Text>
  <Text style={{color:'#ced8f0'}}>{booting?'Opening EventPass…':'Connecting to Google…'}</Text>
  <ActivityIndicator color="#a98cff"/>
 </View>;
 return <View style={s.root}>
  <StatusBar barStyle="light-content"/>
  <View style={s.head}>
   <Pressable style={s.brandRow} accessibilityRole="button" accessibilityLabel="User home" disabled={busy||!member} onPress={()=>{
     setSection('discover');scroll.current?.scrollTo({y:0,animated:false});
   }}>
    <Image accessible={false} source={require('./assets/app-icon.png')} style={s.brandMark}/><View style={s.brandCopy}>
    <Text style={s.brand}>Nexx EventPass</Text><Text style={s.headLabel}>User</Text>
   </View></Pressable>
   {member&&<Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={busy} onPress={()=>void logout()} style={s.accountBadge}><Text style={s.headLabel}>Sign out</Text></Pressable>}
  </View>
  <ScrollView ref={scroll} key={member?section:'signin'} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
 {!member?<View style={s.welcome}>
   <Text style={s.welcomeLabel}>Discover events</Text><Text style={s.welcomeTitle}>Find your next experience.</Text>
   <Text style={s.welcomeText}>Explore verified events, reserve tickets and open your QR passes.</Text>
   {button('Continue with Google',()=>{void login()})}
  </View>:<>
 <Text style={s.title}>Welcome, {member.full_name}</Text><Text style={s.hint}>{member.email}</Text>
 {member.account_status==='pending'?<View style={s.card}><Text style={s.title}>Approval pending</Text><Text style={s.hint}>Platform Admin must approve this organiser application.</Text></View>:<>{button('Refresh',()=>{void exec(async()=>load(token))},true)}
 {section==='discover'&&<>
<View style={{borderRadius:20,backgroundColor:'#27275b',marginBottom:16,overflow:'hidden'}}>
 <Image source={require('./assets/discover-venue.webp')} style={{width:'100%',height:150}} resizeMode="cover"/><View style={{padding:19}}>
 <Text style={{color:'#6AF5D2',fontSize:11,letterSpacing:1.6,fontWeight:'800'}}>NEXX EVENTPASS DISCOVERY</Text>
 <Text style={{fontSize:29,fontWeight:'900',color:'#fff',marginTop:9}}>Your next experience awaits.</Text>
 <Text style={s.hint}>Discover verified events, videos and tickets from organisers near and far.</Text>
</View></View>
{input('Search events, venues, experiences...',query,setQuery)}
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:12}} contentContainerStyle={{gap:9}}>
 {['All',...new Set(events.map(e=>e.category||'Other'))].map(c=><Pressable key={c} style={[s.button,{marginVertical:0,paddingHorizontal:17},category!==c&&s.subButton]} onPress={()=>setCategory(c)}><Text style={s.buttonText}>{c}</Text></Pressable>)}
</ScrollView>
{events.filter(e=>e.status==='published'&&e.visibility==='public'&&(category==='All'||(e.category||'Other')===category)&&[e.title,e.venue,e.description||''].join(' ').toLowerCase().includes(query.toLowerCase())).map(e=><View key={e.id} style={[s.card,{overflow:'hidden',padding:0}]}>
 {e.cover_media_id?<Image source={{uri:BASE+'/api/events/media?id='+e.cover_media_id}} style={{height:210,width:'100%'}} resizeMode="cover"/>:
 <View style={{height:145,backgroundColor:'#50368d',padding:24,justifyContent:'center'}}><Text style={{fontSize:38,color:'#fff'}}>◈</Text><Text style={s.title}>{e.title}</Text></View>}
 <View style={{padding:18}}><Text style={{color:'#6AF5D2',fontSize:12,fontWeight:'800'}}>{e.category||'Event'} · {new Date(e.starts_at).toLocaleString()}</Text>
 <Text style={s.title}>{e.title}</Text><Text style={s.hint}>{e.venue}</Text><Text style={s.hint}>{e.description||'Explore this event and available tickets.'}</Text>
 <Text style={{color:'#8AFFE7',fontSize:20,fontWeight:'800'}}>₦{Number(e.price_ngn).toLocaleString()}</Text>
 {e.video_media_id&&button('Watch event preview video',()=>{void Linking.openURL(BASE+'/api/events/media?id='+e.video_media_id)},true)}
 {button(eventId===e.id?'Close event':'Explore tickets',()=>{if(eventId===e.id){setEventId('');setGallery([]);setInventory(null)}else{setInventory(null);setEventId(e.id);void api('events/media?eventId='+e.id,token).then(r=>setGallery(r.media||[])).catch(()=>setGallery([]))}})}
 {eventId===e.id&&<>
  <Text style={s.title}>Event gallery</Text>
  <ScrollView horizontal contentContainerStyle={{gap:10,marginVertical:10}}>{gallery.map(m=><Pressable key={m.id} onPress={()=>{if(m.media_type==='video')void Linking.openURL(BASE+m.url)}}>
   {m.media_type==='video'?<View style={{width:150,height:115,backgroundColor:'#493b7f',justifyContent:'center',alignItems:'center'}}><Text style={{color:'#fff'}}>▶ Play video</Text></View>:
   <Image source={{uri:BASE+m.url}} style={{width:150,height:115,borderRadius:10}}/>}</Pressable>)}</ScrollView>
  {e.price_ngn>0&&inventory?.eventId===e.id&&inventory.payment.onsite_payments_enabled&&button(onsite?'Switch to bank transfer':'Pay onsite instead',()=>setOnsite(!onsite),true)}
  {e.price_ngn>0&&<Text style={s.hint}>Paystack setup pending</Text>}
  {e.price_ngn>0?(onsite?<Text style={s.hint}>Pay onsite before expiry. Show the organiser your order from My orders.</Text>:<Text selectable style={s.hint}>{inventory?.eventId===e.id?'Bank transfer: '+inventory.payment.bank_name+' · '+inventory.payment.bank_account_name+' · '+inventory.payment.bank_account_number:'Verified bank details are unavailable until checkout loads.'}</Text>):<Text style={s.hint}>Free ticket (organiser approval required)</Text>}
  {inventory?.eventId===e.id&&inventory.categories.length>0&&<View>
   <Text style={s.hint}>Ticket category</Text>
   {(inventory.generalCapacity>0?[{id:'',name:'General'},...inventory.categories]:inventory.categories).map(item=>
    <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{selected:ticketCategoryId===item.id}}
     onPress={()=>setTicketCategoryId(item.id)} style={[s.card,{backgroundColor:ticketCategoryId===item.id?'#50368d':'#1d2440'}]}>
     <Text style={{color:'#fff'}}>{item.name}</Text>
    </Pressable>)}
  </View>}
  {input('Number of tickets',qty,setQty)}
  {e.price_ngn>0&&!onsite&&<>{input('Bank transfer reference',ref,setRef)}
  {button(proof?'Receipt: '+proof.name:'Select payment receipt',()=>{void DocumentPicker.getDocumentAsync({type:['image/png','image/jpeg','image/webp','application/pdf']}).then(v=>{if(!v.canceled)setProof(v.assets[0])})},true)}</>}
  {button('Request tickets',()=>{void exec(async()=>{if(inventory?.eventId!==e.id)throw Error('Ticket categories are unavailable. Reopen the event and try again.');if(e.price_ngn>0&&!onsite&&!proof)throw Error('Receipt required for paid tickets');const o=await api('orders',token,'POST',{eventId:e.id,quantity:Number(qty),ticketCategoryId,paymentAccountId:inventory.payment.payment_account_id,paymentMethod:onsite?'onsite':'manual',paymentReference:e.price_ngn>0?ref:'FREE-TICKET'});if(proof&&e.price_ngn>0&&!onsite){const form=new FormData();form.append('orderId',o.order.id);form.append('receipt',{uri:proof.uri,name:proof.name,type:proof.mimeType||'application/pdf'} as unknown as Blob);await api('orders/receipt',token,'POST',form)}setEventId('');setRef('');setProof(null);setSection('orders');await load(token);Alert.alert('Request submitted','Your organiser will review the ticket request.')})})}
 </>}</View></View>)}
{!events.length&&<Text style={s.hint}>No verified events yet. Check again after organisers publish new experiences.</Text>}
</>}
{section==='tickets'&&<><Text style={s.title}>My ticket wallet</Text>{!tickets.length&&<Text style={s.hint}>Your approved passes appear here.</Text>}{tickets.map(t=><View key={t.id} style={[s.card,{backgroundColor:palette[t.ticket_theme||'aurora']||'#1c4e72'}]}>{t.ticket_art_id&&<Image source={{uri:BASE+'/api/events/media?id='+t.ticket_art_id}} style={{height:140,borderRadius:9,marginBottom:10}}/>}<Text style={s.title}>{t.title}</Text>{t.qr&&<View style={{backgroundColor:'#fff',padding:14,alignSelf:'center',marginVertical:14,borderRadius:12}}><QRCode value={t.qr} size={200}/></View>}<Text style={s.hint}>{t.redeemed_at?'Already scanned':t.status}</Text></View>)}
</>}
{section==='orders'&&<><Text style={s.title}>My orders</Text>{!orders.length&&<Text style={s.hint}>Your reservations appear here.</Text>}{orders.map(o=><View key={o.id} style={s.card}><Text style={{color:'#fff',fontWeight:'800'}}>{o.event_title}</Text>
 <Text style={s.hint}>{o.status} · ₦{Number(o.amount_ngn).toLocaleString()} · {o.payment_method==='onsite'?'Onsite':o.payment_method==='free'?'Free':'Receipt '+(o.receipt_uploaded_at?'submitted':'missing')}</Text>
 {o.status==='pending'&&o.payment_method==='onsite'&&<Text selectable style={s.hint}>Show this order onsite: {o.id}</Text>}
 {o.status==='pending'&&o.reservation_expires_at&&<Text style={[s.hint,{color:new Date(o.reservation_expires_at).getTime()<=Date.now()?'#FDA4AF':'#68EBD1'}]}>
 {new Date(o.reservation_expires_at).getTime()<=Date.now()?'Reservation expired. Contact organiser if money was sent.':'Reserved until '+new Date(o.reservation_expires_at).toLocaleString()}</Text>}
 {o.status==='rejected'&&o.receipt_uploaded_at&&(()=>{
  const request=paymentCases.find(item=>item.payment_order_id===o.id);
  if(request)return <Text style={s.hint}>Support: {request.status.replaceAll('_',' ')}{request.resolution?' · '+request.resolution:''}</Text>;
  if(supportOrder!==o.id)return button('Request payment support',()=>{setSupportOrder(o.id);setSupportDescription('')},true);
  return <><TextInput accessibilityLabel="Tell support what happened" placeholder="Tell support what happened" placeholderTextColor="#a4b1c8" multiline style={s.input} value={supportDescription} onChangeText={setSupportDescription}/>
   <Text style={s.hint}>Your existing receipt is included with the case.</Text>
   {button('Send to support',()=>void exec(async()=>{
    await api('support/cases',token,'POST',{orderId:o.id,description:supportDescription});
    await refreshPaymentCases();setSupportOrder('');
   }))}
   {button('Cancel',()=>setSupportOrder(''),true)}
  </>;
 })()}
 {o.refund_status&&o.refund_status!=='not_required'&&<Text style={s.hint}>Refund: {o.refund_status.replaceAll('_',' ')}</Text>}
 </View>)}
 </>}
 {section==='profile'&&<View style={s.card}><Text style={s.title}>Your account</Text><Text style={s.hint}>{member.email}</Text>{button('Sign out',()=>void logout(),true)}</View>}
 </>}
 </>}
 {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{busy&&<ActivityIndicator color="#45D6C9"/>}
 </ScrollView>
 {member&&<View style={s.navigation}>{([['discover', 'Discover'], ['tickets', 'Tickets'], ['orders', 'Orders'], ['profile', 'Profile']] as const).map(([key,label])=><Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:section===key}} disabled={busy}
  style={[s.navLink,section===key&&s.navCurrent]} onPress={()=>setSection(key)}><Text style={[s.navText,section===key&&s.navTextCurrent]}>{label}</Text></Pressable>)}</View>}
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
 welcome:{backgroundColor:'#1e2350',borderRadius:24,borderWidth:1,borderColor:'#634994',padding:24,marginTop:22,gap:13},
 welcomeLabel:{color:'#bca1ff',fontSize:13,fontWeight:'800',letterSpacing:1.2},
 welcomeTitle:{color:'#fff',fontSize:36,lineHeight:40,fontWeight:'900',letterSpacing:-1.5},
 welcomeText:{color:'#d0d9f2',fontSize:16,lineHeight:24,marginBottom:6},
 navigation:{flexDirection:'row',paddingHorizontal:8,paddingTop:8,paddingBottom:Platform.OS==='ios'?24:10,gap:4,backgroundColor:'#111b32',borderTopWidth:1,borderColor:'#354971'},
 navLink:{flex:1,alignItems:'center',justifyContent:'center',minHeight:49,borderRadius:11,paddingHorizontal:2},
 navCurrent:{backgroundColor:'#32265c'},navText:{fontSize:12,fontWeight:'700',color:'#c1cdec'},navTextCurrent:{color:'#bca1ff'},
});
