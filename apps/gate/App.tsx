import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,AppState,Linking,Alert,ScrollView,Pressable,Text,TextInput,View,StyleSheet,Platform,StatusBar,ActivityIndicator,Image} from 'react-native';
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
 const scroll=useRef<ScrollView>(null);
 const [booting,setBooting]=useState(true);
 const [token,setToken]=useState(''),[member,setMember]=useState<Member|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[orders,setOrders]=useState<Order[]>([]),[gates,setGates]=useState<Gate[]>([]),[eventId,setEventId]=useState('');
 const [code,setCode]=useState(''),[scanning,setScanning]=useState(false),[outcome,setOutcome]=useState(''),[permission,askPermission]=useCameraPermissions();
 const [reduceMotion,setReduceMotion]=useState(true);
 const resultMotion=useRef(new Animated.Value(1)).current;
 useEffect(()=>{
  let mounted=true;
  void AccessibilityInfo.isReduceMotionEnabled().then(enabled=>{if(mounted)setReduceMotion(enabled)}).catch(()=>{});
  const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
  return ()=>{mounted=false;listener.remove()};
 },[]);
 useEffect(()=>{
  if(!outcome||reduceMotion){resultMotion.setValue(1);return}
  resultMotion.setValue(0);
  const animation=Animated.timing(resultMotion,{toValue:1,duration:240,useNativeDriver:true});
  animation.start();
  return ()=>animation.stop();
 },[outcome,reduceMotion,resultMotion]);
 const [cameraError,setCameraError]=useState('');
 const [cameraReady,setCameraReady]=useState(false);
 useEffect(()=>{
  const listener=AppState.addEventListener('change',next=>{if(next!=='active'){setScanning(false);setCameraReady(false)}});
  return ()=>listener.remove();
 },[]);
 const [tab,setTab]=useState<'home'|'scan'|'history'|'profile'>('home');
 const [history,setHistory]=useState<{id:string|number;eventId:string;outcome:string;at:string}[]>([]);
 const [counts,setCounts]=useState({approved:0,denied:0});
 async function refreshHistory(id:string,t=token){if(!id||!t)return;try{const r=await api('gate-history?eventId='+encodeURIComponent(id),t);setHistory((r.scans||[]).map((x:{id:string;outcome:string;created_at:string})=>({id:x.id,eventId:id,outcome:x.outcome,at:new Date(x.created_at).toLocaleTimeString()})));setCounts({approved:r.counts?.approved||0,denied:r.counts?.denied||0})}catch(e){setError((e as Error).message)}}
 const scanLock=useRef(false);
async function verify(v:string){if(scanLock.current)return;scanLock.current=true;setOutcome('');setScanning(false);try{await exec(async()=>{if(!eventId)throw Error('Select an event');let r;try{r=await api('scan',token,'POST',{eventId,code:v.trim()})}catch(error){throw Error('Could not verify ticket. Do not admit. '+(error instanceof Error?error.message:''))}setOutcome(r.outcome);setHistory(h=>[{id:Date.now(),eventId,outcome:r.outcome,at:new Date().toLocaleTimeString()},...h].slice(0,100));setTab('scan');await refreshHistory(eventId);setCode('')})}finally{scanLock.current=false}}
async function openCamera(){if(!eventId||scanLock.current)return;setTab('scan');setOutcome('');setCameraError('');setCameraReady(false);await exec(async()=>{
 const perm=permission?.granted?permission:await askPermission();
 if(!perm.granted){
  setCameraError(perm.canAskAgain?'Camera permission was declined. Try again or enter the ticket code.':'Camera permission is blocked. Enable it in Settings or enter the ticket code.');
  return;
 }
 setScanning(true);
})}
 async function load(t:string){
 const me=await api('auth/me',t);if(!me.user)throw Error('Please sign in again');
 if(!(PORTAL==='organiser'&&me.user.account_status==='pending') && !(me.portals||[]).includes(PORTAL)){await SecureStore.deleteItemAsync('eventpass_token');setMember(null);setToken('');throw Error('This account is not authorised for this app')}
 setMember(me.user);
 if(me.user.account_status==='pending')return;
 const ev=await api('events',t);setEvents(ev.events||[]);
 const v=await api('gates',t);setGates(v.gates||[]);if((v.gates||[]).length===1){setTab('scan');setEventId(v.gates[0].event_id);await refreshHistory(v.gates[0].event_id,t)}
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
   <Pressable style={s.brandRow} accessibilityRole="button" accessibilityLabel="Gate Operator home" disabled={busy||!member} onPress={()=>{
     setScanning(false);setCameraReady(false);setCameraError('');setCode('');setOutcome('');setTab('home');scroll.current?.scrollTo({y:0,animated:false});
   }}>
    <Image accessible={false} source={require('./assets/app-icon.png')} style={s.brandMark}/><View style={s.brandCopy}>
    <Text style={s.brand}>Nexx EventPass</Text><Text style={s.headLabel}>Gate Operator</Text>
   </View></Pressable>
   {member&&<Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={busy} onPress={()=>void logout()} style={s.accountBadge}><Text style={s.headLabel}>Sign out</Text></Pressable>}
  </View>
  <ScrollView ref={scroll} key={member?tab:'signin'} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
 {!member?<View style={s.welcome}>
   <Text style={s.welcomeLabel}>Gate operations</Text><Text style={s.welcomeTitle}>Ready for entry.</Text>
   <Text style={s.welcomeText}>Select an assigned event, scan a ticket and see the admission decision.</Text>
   {button('Continue with Google',()=>{void login()})}
   <Text style={s.hint}>Sign in with the Google account invited by your organiser.</Text>
  </View>:<>
 {tab==='home'&&<><Text style={s.eyebrow}>OPERATOR WORKSPACE</Text><Text style={s.heroTitle}>Hello, {member.full_name?.split(' ')[0]||'Operator'} 👋</Text><Text style={s.hint}>Select your assigned event to begin secure admissions.</Text>
 <View style={s.metrics}><View style={s.metric}><Text style={s.metricValue}>{counts.approved}</Text><Text style={s.hint}>Approved scans</Text></View><View style={s.metric}><Text style={s.metricValue}>{counts.denied}</Text><Text style={s.hint}>Denied scans</Text></View></View>
 <Text style={s.section}>Assigned events</Text>
 {gates.map(g=><Pressable key={g.event_id} accessibilityRole="button" disabled={busy} accessibilityState={{selected:eventId===g.event_id}} style={[s.card,eventId===g.event_id&&s.selected]} onPress={()=>{setEventId(g.event_id);setOutcome('');setScanning(false);setHistory([]);setCounts({approved:0,denied:0});void refreshHistory(g.event_id)}}><Text style={s.eventTitle}>{g.title}</Text><Text style={s.hint}>⌖ {g.gate_label}</Text><Text style={s.eventStatus}>{eventId===g.event_id?'✓ ACTIVE EVENT':'Tap to select event'}</Text></Pressable>)}
 {!gates.length&&<View style={s.card}><Text style={s.hint}>No active gate assignments. Ask your organiser to invite your verified Google account.</Text></View>}
 {eventId&&button('Open QR scanner',()=>{setTab('scan')})}</>}
 {tab==='scan'&&<><Text style={s.eyebrow}>LIVE VERIFICATION</Text><Text style={s.heroTitle}>Ticket scanner</Text><Text style={s.hint}>{gates.find(g=>g.event_id===eventId)?.title||'Select an assigned event first'}</Text>
 {!eventId?<>{button('Choose an event',()=>setTab('home'))}</>:<View style={s.scanCard}>
 {scanning?<View style={s.camera}><CameraView facing="back" style={{flex:1}} onCameraReady={()=>setCameraReady(true)} onMountError={()=>{
  setCameraReady(false);setScanning(false);setCameraError('Camera could not start. Check permissions or enter the ticket code.');
 }} barcodeScannerSettings={{barcodeTypes:['qr']}} onBarcodeScanned={cameraReady?({data})=>{if(scanning&&!scanLock.current){setScanning(false);void verify(data)}}:undefined}/><View pointerEvents="none" style={s.scanFrame}/></View>:<View style={s.scanPlaceholder}><Text style={s.scanIcon}>▣</Text><Text style={s.eventTitle}>Ready to verify</Text><Text style={s.hint}>Position the attendee's QR code inside the camera frame.</Text></View>}
 {scanning&&!cameraReady&&<Text accessibilityLiveRegion="polite" style={s.hint}>Starting camera…</Text>}
 {!!cameraError&&<><Text accessibilityRole="alert" style={s.error}>{cameraError}</Text>
 {permission?.canAskAgain===false&&Platform.OS!=='web'&&button('Open device settings',()=>{void Linking.openSettings().catch(()=>setCameraError('Open Settings and allow camera access for EventPass.'))},true)}</>}
 {!scanning&&<>{input('Ticket code',code,setCode)}{!!code.trim()&&button('Verify ticket code',()=>{void verify(code)},true)}</>}
 {button(scanning?'Stop camera':outcome?'Scan next ticket':'Start camera',()=>{if(scanning){setScanning(false);setCameraReady(false)}else void openCamera()})}
 </View>}
 {!!outcome&&<Animated.View accessibilityRole="alert" style={[s.result,{opacity:resultMotion,transform:[{translateY:resultMotion.interpolate({inputRange:[0,1],outputRange:[8,0]})}]},{borderColor:outcome==='approved'?'#22C55E':outcome==='duplicate'?'#F59E0B':'#EF4444'}]}><Text style={[s.resultTitle,{color:outcome==='approved'?'#4ADE80':outcome==='duplicate'?'#FBBF24':'#F87171'}]}>{outcome==='approved'?'✓ ENTRY APPROVED':outcome==='duplicate'?'⚠ ALREADY USED':outcome==='wrong_event'?'✕ WRONG EVENT':'✕ ENTRY DENIED'}</Text><Text style={s.hint}>{outcome==='approved'?'Ticket redeemed. Admit this attendee.':'Do not admit. Contact the event organiser if assistance is required.'}</Text></Animated.View>}</>}
 {tab==='history'&&<><Text style={s.eyebrow}>SERVER AUDIT HISTORY</Text><Text style={s.heroTitle}>Scan history</Text><Text style={s.hint}>Your last 100 scans for the selected event, stored in Neon.</Text>{history.length===0?<View style={s.card}><Text style={s.hint}>No tickets scanned in this session.</Text></View>:history.map(h=><View key={h.id} style={s.card}><Text style={s.eventTitle}>{h.outcome==='approved'?'✓ Approved':h.outcome==='duplicate'?'⚠ Duplicate':'✕ Rejected'}</Text><Text style={s.hint}>{gates.find(g=>g.event_id===h.eventId)?.title||'Assigned event'} · {h.at}</Text></View>)}</>}
 {tab==='profile'&&<><Text style={s.eyebrow}>ACCOUNT</Text><Text style={s.heroTitle}>Operator profile</Text><View style={s.card}><Text style={s.eventTitle}>{member.full_name}</Text><Text style={s.hint}>{member.email}</Text><Text style={s.hint}>Assigned events: {gates.length}</Text></View>{button('Sign out',()=>{void logout()},true)}</>}
 </>}
 {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{busy&&<ActivityIndicator color="#A78BFA"/>}
 </ScrollView>
 {member&&<View style={s.nav}>{([['home','⌂','Home'],['scan','▣','Scan'],['history','◷','History'],['profile','◉','Profile']] as const).map(([id,icon,label])=><Pressable key={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:tab===id}} disabled={busy} onPress={()=>{setScanning(false);setTab(id)}} style={s.navItem}><Text style={[s.navIcon,tab===id&&s.navActive]}>{icon}</Text><Text style={[s.navLabel,tab===id&&s.navActive]}>{label}</Text></Pressable>)}</View>}
 </View>
}
const s: Record<string,any>=StyleSheet.create({
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
 welcomeLabel:{color:'#c5acff',fontSize:13,fontWeight:'800',letterSpacing:1.2},
 welcomeTitle:{color:'#fff',fontSize:36,lineHeight:40,fontWeight:'900',letterSpacing:-1.5},
 welcomeText:{color:'#d0d9f2',fontSize:16,lineHeight:24,marginBottom:6},
 navigation:{flexDirection:'row',paddingHorizontal:8,paddingTop:8,paddingBottom:Platform.OS==='ios'?24:10,gap:4,backgroundColor:'#111b32',borderTopWidth:1,borderColor:'#354971'},
 navLink:{flex:1,alignItems:'center',justifyContent:'center',minHeight:49,borderRadius:11,paddingHorizontal:2},
 navCurrent:{backgroundColor:'#32265c'},navText:{fontSize:12,fontWeight:'700',color:'#c1cdec'},navTextCurrent:{color:'#c5acff'},
});

const extra=StyleSheet.create({headerRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},online:{color:'#4ADE80',fontSize:10,fontWeight:'800'},eyebrow:{color:'#A78BFA',fontSize:11,fontWeight:'900',letterSpacing:2,marginTop:12},heroTitle:{fontSize:30,fontWeight:'900',color:'#fff',marginTop:12,marginBottom:4},hero:{backgroundColor:'#171F33',borderRadius:20,padding:22,marginTop:35},metrics:{flexDirection:'row',gap:12,marginVertical:20},metric:{flex:1,backgroundColor:'#171F33',padding:16,borderRadius:16},metricValue:{fontSize:28,color:'#fff',fontWeight:'900'},section:{fontSize:19,color:'#fff',fontWeight:'800',marginTop:12},selected:{borderColor:'#A78BFA',backgroundColor:'#272143'},eventTitle:{color:'#fff',fontSize:17,fontWeight:'800'},eventStatus:{color:'#A78BFA',fontSize:12,fontWeight:'800',marginTop:8},scanCard:{backgroundColor:'#171F33',borderRadius:20,padding:16,marginTop:20},camera:{height:360,borderRadius:16,overflow:'hidden',position:'relative'},scanFrame:{position:'absolute',top:60,bottom:60,left:35,right:35,borderColor:'#A78BFA',borderWidth:3,borderRadius:20},scanPlaceholder:{height:260,alignItems:'center',justifyContent:'center',padding:20},scanIcon:{fontSize:90,color:'#A78BFA'},result:{borderWidth:2,borderRadius:16,padding:20,marginTop:18,alignItems:'center'},resultTitle:{fontSize:22,fontWeight:'900',textAlign:'center'},nav:{flexDirection:'row',backgroundColor:'#171F33',borderTopWidth:1,borderColor:'#303A53',paddingBottom:18,paddingTop:12},navItem:{flex:1,alignItems:'center',gap:4},navIcon:{fontSize:24,color:'#8290AA'},navLabel:{fontSize:11,color:'#8290AA'},navActive:{color:'#A78BFA',fontWeight:'900'}});
Object.assign(s,extra);