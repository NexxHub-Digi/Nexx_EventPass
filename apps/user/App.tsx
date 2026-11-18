import React,{useEffect,useState} from 'react';
import {Alert,ScrollView,Pressable,Text,TextInput,View,StyleSheet,ActivityIndicator,Image,Linking} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
WebBrowser.maybeCompleteAuthSession();
import QRCode from 'react-native-qrcode-svg';
import * as DocumentPicker from 'expo-document-picker';
const PORTAL: string="user",TITLE="Nexx EventPass User",BASE=(process.env.EXPO_PUBLIC_API_URL||'https://nexx-eventpass.vercel.app').replace(/\/$/,'');
type Member={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
type Event={id:string;title:string;venue:string;organiser_id:string;starts_at:string;price_ngn:number;status:string;description?:string;category?:string;ticket_theme?:string;cover_media_id?:string|null;video_media_id?:string|null;bank_name?:string;bank_account_name?:string;bank_account_number?:string};
type Ticket={id:string;title:string;qr:string|null;status:string;redeemed_at:string|null;ticket_theme?:string;ticket_art_id?:string|null};
type Order={id:string;event_id:string;event_title?:string;buyer_name?:string;buyer_email?:string;status:string;quantity:number;payment_reference:string;receipt_uploaded_at?:string|null;amount_ngn:number;reservation_expires_at?:string;refund_status?:string};
type Gate={event_id:string;title:string;gate_label:string};
type Applicant={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
async function api(p:string,t:string,method='GET',data?:unknown){const multi=data instanceof FormData;const r=await fetch(BASE+'/api/'+p,{method,headers:{...(multi?{}:{'Content-Type':'application/json'}),...(t?{Authorization:'Bearer '+t}:{})},body:multi?data: data?JSON.stringify(data):undefined});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v}
export default function App(){
 const [token,setToken]=useState(''),[member,setMember]=useState<Member|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[orders,setOrders]=useState<Order[]>([]),[gates,setGates]=useState<Gate[]>([]),[eventId,setEventId]=useState('');
 const [ref,setRef]=useState(''),[qty,setQty]=useState('1'),[proof,setProof]=useState<DocumentPicker.DocumentPickerAsset|null>(null);
 const [query,setQuery]=useState(''),[category,setCategory]=useState('All'),[gallery,setGallery]=useState<{id:string;media_type:string;url:string}[]>([]);
 const [palette,setPalette]=useState<Record<string,string>>({});
 async function load(t:string){
 const me=await api('auth/me',t);if(!me.user)throw Error('Please sign in again');
 if(!(PORTAL==='organiser'&&me.user.account_status==='pending') && !(me.portals||[]).includes(PORTAL)){await SecureStore.deleteItemAsync('eventpass_token');setMember(null);setToken('');throw Error('This account is not authorised for this app')}
 setMember(me.user);
 if(me.user.account_status==='pending')return;
 const ev=await api('events',t);setEvents(ev.events||[]);
 const [ticketResult,orderResult,themesResult]=await Promise.all([api('tickets',t),api('orders',t),api('ticket-themes',t)]);
 setTickets(ticketResult.tickets||[]);setOrders(orderResult.orders||[]);
 setPalette(Object.fromEntries((themesResult.themes||[]).map((x:{id:string;color_a:string})=>[x.id,x.color_a])));
 }
 useEffect(()=>{SecureStore.getItemAsync('eventpass_token').then(t=>{if(t){setToken(t);load(t).catch(e=>setError((e as Error).message))}}).catch(()=>{})},[]);
 useEffect(()=>{if(!token||!member||member.account_status!=='active')return;
  const id=setInterval(()=>{api('tickets',token).then(v=>setTickets(v.tickets||[])).catch(()=>{})},12000);
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
 const button=(label:string,fn:()=>void,sub=false)=><Pressable onPress={fn} disabled={busy} style={[s.button,sub&&s.subButton]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 return <View style={s.root}><View style={s.head}><Text style={s.brand}>◈ NEXX <Text style={{color:'#45D6C9'}}>EVENTPASS</Text></Text><Text style={s.hint}>{TITLE}</Text></View><ScrollView contentContainerStyle={s.body}>
 {!member?<><Text style={s.title}>Google sign-in</Text>
 <Text style={s.hint}>Browse events and collect tickets using your Google identity.</Text>
 {button('Continue with Google',()=>{void login()})}
 </>:<>
 <Text style={s.title}>Welcome, {member.full_name}</Text><Text style={s.hint}>{member.email}</Text>
 {member.account_status==='pending'?<View style={s.card}><Text style={s.title}>Approval pending</Text><Text style={s.hint}>Platform Admin must approve this organiser application.</Text></View>:<>{button('Refresh',()=>{void exec(async()=>load(token))},true)}
 <View style={{padding:19,borderRadius:17,backgroundColor:'#27275b',marginBottom:16}}>
 <Text style={{color:'#6AF5D2',fontSize:11,letterSpacing:1.6,fontWeight:'800'}}>NEXX EVENTPASS DISCOVERY</Text>
 <Text style={{fontSize:29,fontWeight:'900',color:'#fff',marginTop:9}}>Your next experience awaits.</Text>
 <Text style={s.hint}>Discover verified events, videos and tickets from organisers near and far.</Text>
</View>
{input('Search events, venues, experiences...',query,setQuery)}
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:12}} contentContainerStyle={{gap:9}}>
 {['All',...new Set(events.map(e=>e.category||'Other'))].map(c=><Pressable key={c} style={[s.button,{marginVertical:0,paddingHorizontal:17},category!==c&&s.subButton]} onPress={()=>setCategory(c)}><Text style={s.buttonText}>{c}</Text></Pressable>)}
</ScrollView>
{events.filter(e=>e.status==='published'&&(category==='All'||(e.category||'Other')===category)&&[e.title,e.venue,e.description||''].join(' ').toLowerCase().includes(query.toLowerCase())).map(e=><View key={e.id} style={[s.card,{overflow:'hidden',padding:0}]}>
 {e.cover_media_id?<Image source={{uri:BASE+'/api/events/media?id='+e.cover_media_id}} style={{height:210,width:'100%'}} resizeMode="cover"/>:
 <View style={{height:145,backgroundColor:'#50368d',padding:24,justifyContent:'center'}}><Text style={{fontSize:38,color:'#fff'}}>◈</Text><Text style={s.title}>{e.title}</Text></View>}
 <View style={{padding:18}}><Text style={{color:'#6AF5D2',fontSize:12,fontWeight:'800'}}>{e.category||'Event'} · {new Date(e.starts_at).toLocaleString()}</Text>
 <Text style={s.title}>{e.title}</Text><Text style={s.hint}>{e.venue}</Text><Text style={s.hint}>{e.description||'Explore this event and available tickets.'}</Text>
 <Text style={{color:'#8AFFE7',fontSize:20,fontWeight:'800'}}>₦{Number(e.price_ngn).toLocaleString()}</Text>
 {e.video_media_id&&button('Watch event preview video',()=>{void Linking.openURL(BASE+'/api/events/media?id='+e.video_media_id)},true)}
 {button(eventId===e.id?'Close event':'Explore tickets',()=>{if(eventId===e.id){setEventId('');setGallery([])}else{setEventId(e.id);void api('events/media?eventId='+e.id,token).then(r=>setGallery(r.media||[])).catch(()=>setGallery([]))}})}
 {eventId===e.id&&<>
  <Text style={s.title}>Event gallery</Text>
  <ScrollView horizontal contentContainerStyle={{gap:10,marginVertical:10}}>{gallery.map(m=><Pressable key={m.id} onPress={()=>{if(m.media_type==='video')void Linking.openURL(BASE+m.url)}}>
   {m.media_type==='video'?<View style={{width:150,height:115,backgroundColor:'#493b7f',justifyContent:'center',alignItems:'center'}}><Text style={{color:'#fff'}}>▶ Play video</Text></View>:
   <Image source={{uri:BASE+m.url}} style={{width:150,height:115,borderRadius:10}}/>}</Pressable>)}</ScrollView>
  {e.price_ngn>0?<Text style={s.hint}>Bank transfer: {e.bank_name||'Not configured'} — {e.bank_account_name||''} — {e.bank_account_number||''}</Text>:<Text style={s.hint}>Free ticket (organiser approval required)</Text>}
  {input('Number of tickets',qty,setQty)}
  {e.price_ngn>0&&<>{input('Bank transfer reference',ref,setRef)}
  {button(proof?'Receipt: '+proof.name:'Select payment receipt',()=>{void DocumentPicker.getDocumentAsync({type:['image/png','image/jpeg','image/webp','application/pdf']}).then(v=>{if(!v.canceled)setProof(v.assets[0])})},true)}</>}
  {button('Request tickets',()=>{void exec(async()=>{if(e.price_ngn>0&&!proof)throw Error('Receipt required for paid tickets');const o=await api('orders',token,'POST',{eventId:e.id,quantity:Number(qty),paymentReference:e.price_ngn>0?ref:'FREE-TICKET'});if(proof&&e.price_ngn>0){const form=new FormData();form.append('orderId',o.order.id);form.append('receipt',{uri:proof.uri,name:proof.name,type:proof.mimeType||'application/pdf'} as unknown as Blob);await api('orders/receipt',token,'POST',form)}setEventId('');setRef('');setProof(null);await load(token);Alert.alert('Request submitted','Your organiser will review the ticket request.')})})}
 </>}</View></View>)}
{!events.length&&<Text style={s.hint}>No verified events yet. Check again after organisers publish new experiences.</Text>}
<Text style={s.title}>My ticket wallet</Text>{tickets.map(t=><View key={t.id} style={[s.card,{backgroundColor:palette[t.ticket_theme||'aurora']||'#1c4e72'}]}>{t.ticket_art_id&&<Image source={{uri:BASE+'/api/events/media?id='+t.ticket_art_id}} style={{height:140,borderRadius:9,marginBottom:10}}/>}<Text style={s.title}>{t.title}</Text>{t.qr&&<View style={{backgroundColor:'#fff',padding:14,alignSelf:'center',marginVertical:14,borderRadius:12}}><QRCode value={t.qr} size={200}/></View>}<Text style={s.hint}>{t.redeemed_at?'Already scanned':t.status}</Text></View>)}
<Text style={s.title}>My orders</Text>{orders.map(o=><View key={o.id} style={s.card}><Text style={{color:'#fff',fontWeight:'800'}}>{o.event_title}</Text>
 <Text style={s.hint}>{o.status} · ₦{Number(o.amount_ngn).toLocaleString()} · Receipt {o.receipt_uploaded_at?'submitted':'missing'}</Text>
 {o.status==='pending'&&o.reservation_expires_at&&<Text style={[s.hint,{color:new Date(o.reservation_expires_at).getTime()<=Date.now()?'#FDA4AF':'#68EBD1'}]}>
 {new Date(o.reservation_expires_at).getTime()<=Date.now()?'Reservation expired. Contact organiser if money was sent.':'Reserved until '+new Date(o.reservation_expires_at).toLocaleString()}</Text>}
 {o.refund_status&&o.refund_status!=='not_required'&&<Text style={s.hint}>Refund: {o.refund_status.replaceAll('_',' ')}</Text>}
 </View>)}
 </>}
 {button('Sign out',()=>{void logout()},true)}</>}
 {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{busy&&<ActivityIndicator color="#45D6C9"/>}
 </ScrollView></View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#0B1020'},head:{backgroundColor:'#171F33',paddingHorizontal:22,paddingTop:55,paddingBottom:20},brand:{fontSize:19,fontWeight:'900',color:'#fff'},body:{padding:22,paddingBottom:80},title:{color:'#fff',fontSize:23,fontWeight:'800',marginVertical:13},hint:{color:'#A4B1C8',fontSize:13,lineHeight:21,marginVertical:8},input:{borderWidth:1,borderColor:'#3A4966',backgroundColor:'#222E48',color:'#fff',minHeight:51,borderRadius:11,paddingHorizontal:14,marginVertical:8},button:{padding:15,backgroundColor:'#8B5CF6',borderRadius:10,alignItems:'center',marginVertical:8},subButton:{backgroundColor:'#283650'},buttonText:{color:'#fff',fontWeight:'800'},card:{backgroundColor:'#171F33',padding:17,borderRadius:12,borderWidth:1,borderColor:'#3A4966',marginVertical:9},error:{color:'#FDA4AF',backgroundColor:'#4A2634',padding:13,borderRadius:10,marginVertical:12}});
