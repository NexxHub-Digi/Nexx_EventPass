import React,{useEffect,useRef,useState} from 'react';
import {Alert,ScrollView,Pressable,Text,TextInput,View,StyleSheet,ActivityIndicator} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
WebBrowser.maybeCompleteAuthSession();
import {CameraView,useCameraPermissions} from 'expo-camera';
const PORTAL: string="gate",TITLE="Nexx EventPass Gate Operator",BASE=(process.env.EXPO_PUBLIC_API_URL||'https://nexx-eventpass.vercel.app').replace(/\/$/,'');
type Member={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
type Event={id:string;title:string;venue:string;organiser_id:string;starts_at:string;price_ngn:number;status:string;bank_name?:string;bank_account_name?:string;bank_account_number?:string};
type Ticket={id:string;title:string;qr:string|null;status:string;redeemed_at:string|null};
type Order={id:string;event_id:string;event_title?:string;buyer_name?:string;buyer_email?:string;status:string;quantity:number;payment_reference:string;receipt_uploaded_at?:string|null;amount_ngn:number};
type Gate={event_id:string;title:string;gate_label:string};
type Applicant={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
async function api(p:string,t:string,method='GET',data?:unknown){const multi=data instanceof FormData;const r=await fetch(BASE+'/api/'+p,{method,headers:{...(multi?{}:{'Content-Type':'application/json'}),...(t?{Authorization:'Bearer '+t}:{})},body:multi?data: data?JSON.stringify(data):undefined});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v}
export default function App(){
 const [token,setToken]=useState(''),[member,setMember]=useState<Member|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[orders,setOrders]=useState<Order[]>([]),[gates,setGates]=useState<Gate[]>([]),[eventId,setEventId]=useState('');
 const [code,setCode]=useState(''),[scanning,setScanning]=useState(false),[outcome,setOutcome]=useState(''),[permission,askPermission]=useCameraPermissions();
 const [tab,setTab]=useState<'home'|'scan'|'history'|'profile'>('home');
 const [history,setHistory]=useState<{id:number;eventId:string;outcome:string;at:string}[]>([]);
 const scanLock=useRef(false);
async function verify(v:string){if(scanLock.current)return;scanLock.current=true;setScanning(false);try{await exec(async()=>{if(!eventId)throw Error('Select an event');const r=await api('scan',token,'POST',{eventId,code:v});setOutcome(r.outcome);setHistory(h=>[{id:Date.now(),eventId,outcome:r.outcome,at:new Date().toLocaleTimeString()},...h].slice(0,100));setTab('scan');setCode('')})}finally{scanLock.current=false}}
async function openCamera(){if(!eventId)return;const perm=permission?.granted?permission:await askPermission();if(!perm.granted){Alert.alert('Camera denied','Enable camera access in device settings');return}setTab('scan');setScanning(true)}
 async function load(t:string){
 const me=await api('auth/me',t);if(!me.user)throw Error('Please sign in again');
 if(!(PORTAL==='organiser'&&me.user.account_status==='pending') && !(me.portals||[]).includes(PORTAL)){await SecureStore.deleteItemAsync('eventpass_token');setMember(null);setToken('');throw Error('This account is not authorised for this app')}
 setMember(me.user);
 if(me.user.account_status==='pending')return;
 const ev=await api('events',t);setEvents(ev.events||[]);
 const v=await api('gates',t);setGates(v.gates||[]);if((v.gates||[]).length===1)setEventId(v.gates[0].event_id);
 }
 useEffect(()=>{SecureStore.getItemAsync('eventpass_token').then(t=>{if(t){setToken(t);load(t).catch(e=>setError((e as Error).message))}}).catch(()=>{})},[]);
 async function exec(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function login(){await exec(async()=>{
   const redirect='eventpassgate://oauth';
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
 return <View style={s.root}>
 <View style={s.head}><View style={s.headerRow}><View><Text style={s.brand}>◈ NEXX <Text style={{color:'#A78BFA'}}>GATE</Text></Text><Text style={s.hint}>EVENTPASS · ACCESS CONTROL</Text></View><Text style={s.online}>● SECURE</Text></View></View>
 <ScrollView contentContainerStyle={s.body}>
 {!member?<View style={s.hero}><Text style={s.eyebrow}>OPERATOR ACCESS</Text><Text style={s.heroTitle}>Welcome to Nexx Gate</Text><Text style={s.hint}>Sign in with the Google account invited by your event organiser.</Text>{button('Continue with Google',()=>{void login()})}</View>:<>
 {tab==='home'&&<><Text style={s.eyebrow}>OPERATOR WORKSPACE</Text><Text style={s.heroTitle}>Hello, {member.full_name?.split(' ')[0]||'Operator'} 👋</Text><Text style={s.hint}>Select your assigned event to begin secure admissions.</Text>
 <View style={s.metrics}><View style={s.metric}><Text style={s.metricValue}>{history.filter(x=>x.outcome==='approved').length}</Text><Text style={s.hint}>Admitted this session</Text></View><View style={s.metric}><Text style={s.metricValue}>{history.filter(x=>x.outcome!=='approved').length}</Text><Text style={s.hint}>Denied this session</Text></View></View>
 <Text style={s.section}>Assigned events</Text>
 {gates.map(g=><Pressable key={g.event_id} accessibilityRole="button" style={[s.card,eventId===g.event_id&&s.selected]} onPress={()=>{setEventId(g.event_id);setOutcome('');setScanning(false)}}><Text style={s.eventTitle}>{g.title}</Text><Text style={s.hint}>⌖ {g.gate_label}</Text><Text style={s.eventStatus}>{eventId===g.event_id?'✓ ACTIVE EVENT':'Tap to select event'}</Text></Pressable>)}
 {!gates.length&&<View style={s.card}><Text style={s.hint}>No active gate assignments. Ask your organiser to invite your verified Google account.</Text></View>}
 {eventId&&button('▣  OPEN QR SCANNER',()=>{void openCamera()})}</>}
 {tab==='scan'&&<><Text style={s.eyebrow}>LIVE VERIFICATION</Text><Text style={s.heroTitle}>Ticket scanner</Text><Text style={s.hint}>{gates.find(g=>g.event_id===eventId)?.title||'Select an assigned event first'}</Text>
 {!eventId?<>{button('Choose an event',()=>setTab('home'))}</>:<View style={s.scanCard}>
 {scanning?<View style={s.camera}><CameraView facing="back" style={{flex:1}} barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={({data})=>{if(scanning&&!scanLock.current){setScanning(false);void verify(data)}}}/><View pointerEvents="none" style={s.scanFrame}/></View>:<View style={s.scanPlaceholder}><Text style={s.scanIcon}>▣</Text><Text style={s.eventTitle}>Ready to verify</Text><Text style={s.hint}>Position the attendee's QR code inside the camera frame.</Text></View>}
 {button(scanning?'STOP CAMERA':outcome?'SCAN NEXT TICKET':'START SCANNING',()=>{if(scanning)setScanning(false);else void openCamera()})}
 </View>}
 {!!outcome&&<View accessibilityRole="alert" style={[s.result,{borderColor:outcome==='approved'?'#22C55E':outcome==='duplicate'?'#F59E0B':'#EF4444'}]}><Text style={[s.resultTitle,{color:outcome==='approved'?'#4ADE80':outcome==='duplicate'?'#FBBF24':'#F87171'}]}>{outcome==='approved'?'✓ ENTRY APPROVED':outcome==='duplicate'?'⚠ ALREADY USED':outcome==='wrong_event'?'✕ WRONG EVENT':'✕ ENTRY DENIED'}</Text><Text style={s.hint}>{outcome==='approved'?'Ticket redeemed. Admit this attendee.':'Do not admit. Contact the event organiser if assistance is required.'}</Text></View>}</>}
 {tab==='history'&&<><Text style={s.eyebrow}>THIS DEVICE SESSION</Text><Text style={s.heroTitle}>Scan history</Text><Text style={s.hint}>Recent results from this app session. This is not the server-wide audit log.</Text>{history.length===0?<View style={s.card}><Text style={s.hint}>No tickets scanned in this session.</Text></View>:history.map(h=><View key={h.id} style={s.card}><Text style={s.eventTitle}>{h.outcome==='approved'?'✓ Approved':h.outcome==='duplicate'?'⚠ Duplicate':'✕ Rejected'}</Text><Text style={s.hint}>{gates.find(g=>g.event_id===h.eventId)?.title||'Assigned event'} · {h.at}</Text></View>)}</>}
 {tab==='profile'&&<><Text style={s.eyebrow}>ACCOUNT</Text><Text style={s.heroTitle}>Operator profile</Text><View style={s.card}><Text style={s.eventTitle}>{member.full_name}</Text><Text style={s.hint}>{member.email}</Text><Text style={s.hint}>Assigned events: {gates.length}</Text></View>{button('Sign out',()=>{void logout()},true)}</>}
 </>}
 {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{busy&&<ActivityIndicator color="#A78BFA"/>}
 </ScrollView>
 {member&&<View style={s.nav}>{([['home','⌂','Home'],['scan','▣','Scan'],['history','◷','History'],['profile','◉','Profile']] as const).map(([id,icon,label])=><Pressable key={id} accessibilityRole="button" accessibilityLabel={label} onPress={()=>{setScanning(false);setTab(id)}} style={s.navItem}><Text style={[s.navIcon,tab===id&&s.navActive]}>{icon}</Text><Text style={[s.navLabel,tab===id&&s.navActive]}>{label}</Text></Pressable>)}</View>}
 </View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#0B1020'},head:{backgroundColor:'#171F33',paddingHorizontal:22,paddingTop:55,paddingBottom:20},brand:{fontSize:19,fontWeight:'900',color:'#fff'},body:{padding:22,paddingBottom:80},title:{color:'#fff',fontSize:23,fontWeight:'800',marginVertical:13},hint:{color:'#A4B1C8',fontSize:13,lineHeight:21,marginVertical:8},input:{borderWidth:1,borderColor:'#3A4966',backgroundColor:'#222E48',color:'#fff',minHeight:51,borderRadius:11,paddingHorizontal:14,marginVertical:8},button:{padding:15,backgroundColor:'#8B5CF6',borderRadius:10,alignItems:'center',marginVertical:8},subButton:{backgroundColor:'#283650'},buttonText:{color:'#fff',fontWeight:'800'},card:{backgroundColor:'#171F33',padding:17,borderRadius:12,borderWidth:1,borderColor:'#3A4966',marginVertical:9},error:{color:'#FDA4AF',backgroundColor:'#4A2634',padding:13,borderRadius:10,marginVertical:12}});

const extra=StyleSheet.create({headerRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},online:{color:'#4ADE80',fontSize:10,fontWeight:'800'},eyebrow:{color:'#A78BFA',fontSize:11,fontWeight:'900',letterSpacing:2,marginTop:12},heroTitle:{fontSize:30,fontWeight:'900',color:'#fff',marginTop:12,marginBottom:4},hero:{backgroundColor:'#171F33',borderRadius:20,padding:22,marginTop:35},metrics:{flexDirection:'row',gap:12,marginVertical:20},metric:{flex:1,backgroundColor:'#171F33',padding:16,borderRadius:16},metricValue:{fontSize:28,color:'#fff',fontWeight:'900'},section:{fontSize:19,color:'#fff',fontWeight:'800',marginTop:12},selected:{borderColor:'#A78BFA',backgroundColor:'#272143'},eventTitle:{color:'#fff',fontSize:17,fontWeight:'800'},eventStatus:{color:'#A78BFA',fontSize:12,fontWeight:'800',marginTop:8},scanCard:{backgroundColor:'#171F33',borderRadius:20,padding:16,marginTop:20},camera:{height:360,borderRadius:16,overflow:'hidden',position:'relative'},scanFrame:{position:'absolute',top:60,bottom:60,left:35,right:35,borderColor:'#A78BFA',borderWidth:3,borderRadius:20},scanPlaceholder:{height:260,alignItems:'center',justifyContent:'center',padding:20},scanIcon:{fontSize:90,color:'#A78BFA'},result:{borderWidth:2,borderRadius:16,padding:20,marginTop:18,alignItems:'center'},resultTitle:{fontSize:22,fontWeight:'900',textAlign:'center'},nav:{flexDirection:'row',backgroundColor:'#171F33',borderTopWidth:1,borderColor:'#303A53',paddingBottom:18,paddingTop:12},navItem:{flex:1,alignItems:'center',gap:4},navIcon:{fontSize:24,color:'#8290AA'},navLabel:{fontSize:11,color:'#8290AA'},navActive:{color:'#A78BFA',fontWeight:'900'}});
Object.assign(s,extra);