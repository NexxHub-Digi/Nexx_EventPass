import React,{useEffect,useRef,useState} from 'react';
import {Alert,ScrollView,Pressable,Text,TextInput,View,StyleSheet,ActivityIndicator} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
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
 const scanLock=useRef(false);
async function verify(v:string){if(scanLock.current)return;scanLock.current=true;setScanning(false);try{await exec(async()=>{if(!eventId)throw Error('Select an event');const r=await api('scan',token,'POST',{eventId,code:v});setOutcome(r.outcome);setCode('')})}finally{scanLock.current=false}}
async function openCamera(){if(!eventId)return;const perm=permission?.granted?permission:await askPermission();if(!perm.granted){Alert.alert('Camera denied','Enable camera access in device settings');return}setScanning(true)}
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
   const result=await WebBrowser.openAuthSessionAsync(BASE+'/api/auth/google?portal='+encodeURIComponent(PORTAL)+'&client=native',redirect);
   if(result.type!=='success')throw Error('Google sign-in was cancelled');
   const code=new URL(result.url).searchParams.get('code');
   if(!code)throw Error('Google did not return a valid sign-in code');
   const data=await api('auth/mobile','','POST',{code,client:PORTAL});
   await SecureStore.setItemAsync('eventpass_token',data.token);
   setToken(data.token);await load(data.token);
 })}
 async function logout(){try{if(token)await api('auth/logout',token,'POST')}catch{setError('Server logout unavailable; session may remain active until expiry.')}finally{await SecureStore.deleteItemAsync('eventpass_token');setToken('');setMember(null)}}
 const input=(hint:string,value:string,update:(x:string)=>void,secret=false)=><TextInput style={s.input} placeholder={hint} placeholderTextColor="#94a3b8" value={value} onChangeText={update} autoCapitalize="none" secureTextEntry={secret}/>;
 const button=(label:string,fn:()=>void,sub=false)=><Pressable onPress={fn} disabled={busy} style={[s.button,sub&&s.subButton]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 return <View style={s.root}><View style={s.head}><Text style={s.brand}>◈ NEXX <Text style={{color:'#45D6C9'}}>EVENTPASS</Text></Text><Text style={s.hint}>{TITLE}</Text></View><ScrollView contentContainerStyle={s.body}>
 {!member?<><Text style={s.title}>Google sign-in</Text>
 <Text style={s.hint}>Your organiser must invite this Google email first. No separate gate account or password needed.</Text>
 {button('Continue with Google',()=>{void login()})}
 </>:<>
 <Text style={s.title}>Welcome, {member.full_name}</Text><Text style={s.hint}>{member.email}</Text>
 {member.account_status==='pending'?<View style={s.card}><Text style={s.title}>Account inactive</Text><Text style={s.hint}>Ask your organiser to invite your verified Google email.</Text></View>:<>
 <Text style={s.title}>Select an assigned event</Text>
 <Text style={s.hint}>Only your organiser's authorised event gates are available.</Text>
 {gates.map(g=><Pressable key={g.event_id} style={[s.card,eventId===g.event_id&&{borderColor:'#45D6C9',backgroundColor:'#163e42'}]} onPress={()=>{setEventId(g.event_id);setOutcome('');setScanning(false)}}>
 <Text style={s.title}>{g.title}</Text><Text style={s.hint}>{g.gate_label} {eventId===g.event_id?' ✓ Selected':''}</Text></Pressable>)}
 {!gates.length&&<View style={s.card}><Text style={s.hint}>No gate assignments yet. Your organiser must add your Google email to an event.</Text></View>}
 {eventId&&<View style={[s.card,{alignItems:'center',paddingVertical:24}]}>
  {!scanning&&button(outcome?'Scan next ticket':'START SCANNER',()=>{void openCamera()})}
  {scanning&&<View style={{height:340,width:'100%',overflow:'hidden',borderRadius:15}}>
   <CameraView facing="back" style={{flex:1}} barcodeScannerSettings={{barcodeTypes:['qr']}}
    onBarcodeScanned={({data})=>{if(scanning&&!scanLock.current){setScanning(false);void verify(data)}}}/>
  </View>}
  {scanning&&button('Stop camera',()=>setScanning(false),true)}
  {!!outcome&&<View accessibilityRole="alert" style={[s.card,{width:'100%',alignItems:'center',backgroundColor:outcome==='approved'?'#124c3f':'#56313a'}]}>
   <Text style={{fontWeight:'900',fontSize:27,color:outcome==='approved'?'#8DFFE3':'#FFB9B9',textAlign:'center'}}>
    {outcome==='approved'?'✓ VALID — ADMIT':outcome==='duplicate'?'ALREADY USED':outcome==='wrong_event'?'WRONG EVENT':'✕ ENTRY REJECTED'}</Text>
   <Text style={s.hint}>{outcome==='approved'?'Genuine ticket, now redeemed.':outcome==='duplicate'?'This pass has already been used.':'Do not admit. Ask the ticket holder to contact the organiser.'}</Text>
  </View>}
 </View>}
 </>}
 {button('Sign out',()=>{void logout()},true)}</>}
 {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{busy&&<ActivityIndicator color="#45D6C9"/>}
 </ScrollView></View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#0B1020'},head:{backgroundColor:'#171F33',paddingHorizontal:22,paddingTop:55,paddingBottom:20},brand:{fontSize:19,fontWeight:'900',color:'#fff'},body:{padding:22,paddingBottom:80},title:{color:'#fff',fontSize:23,fontWeight:'800',marginVertical:13},hint:{color:'#A4B1C8',fontSize:13,lineHeight:21,marginVertical:8},input:{borderWidth:1,borderColor:'#3A4966',backgroundColor:'#222E48',color:'#fff',minHeight:51,borderRadius:11,paddingHorizontal:14,marginVertical:8},button:{padding:15,backgroundColor:'#8B5CF6',borderRadius:10,alignItems:'center',marginVertical:8},subButton:{backgroundColor:'#283650'},buttonText:{color:'#fff',fontWeight:'800'},card:{backgroundColor:'#171F33',padding:17,borderRadius:12,borderWidth:1,borderColor:'#3A4966',marginVertical:9},error:{color:'#FDA4AF',backgroundColor:'#4A2634',padding:13,borderRadius:10,marginVertical:12}});
