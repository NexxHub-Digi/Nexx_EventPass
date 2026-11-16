import React,{useEffect,useState} from 'react';
import {Alert,ScrollView,Pressable,Text,TextInput,View,StyleSheet,ActivityIndicator} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import QRCode from 'react-native-qrcode-svg';
import * as DocumentPicker from 'expo-document-picker';
const PORTAL: string="user",TITLE="Nexx EventPass User",BASE=(process.env.EXPO_PUBLIC_API_URL||'https://nexx-eventpass.vercel.app').replace(/\/$/,'');
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
 const [ref,setRef]=useState(''),[qty,setQty]=useState('1'),[proof,setProof]=useState<DocumentPicker.DocumentPickerAsset|null>(null);
 async function load(t:string){
 const me=await api('auth/me',t);if(!me.user)throw Error('Please sign in again');
 if(!(PORTAL==='organiser'&&me.user.account_status==='pending') && !(me.portals||[]).includes(PORTAL)){await SecureStore.deleteItemAsync('eventpass_token');setMember(null);setToken('');throw Error('This account is not authorised for this app')}
 setMember(me.user);
 if(me.user.account_status==='pending')return;
 const ev=await api('events',t);setEvents(ev.events||[]);
 const [ticketResult,orderResult]=await Promise.all([api('tickets',t),api('orders',t)]);setTickets(ticketResult.tickets||[]);setOrders(orderResult.orders||[]);
 }
 useEffect(()=>{SecureStore.getItemAsync('eventpass_token').then(t=>{if(t){setToken(t);load(t).catch(e=>setError((e as Error).message))}}).catch(()=>{})},[]);
 async function exec(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function login(){await exec(async()=>{const d=await api('auth/'+(register?'register':'login'),'','POST',{portal:PORTAL,email,password,fullName:name});await SecureStore.setItemAsync('eventpass_token',d.token);setToken(d.token);setPassword('');await load(d.token)})}
 async function logout(){await SecureStore.deleteItemAsync('eventpass_token');setToken('');setMember(null)}
 const input=(hint:string,value:string,update:(x:string)=>void,secret=false)=><TextInput style={s.input} placeholder={hint} placeholderTextColor="#94a3b8" value={value} onChangeText={update} autoCapitalize="none" secureTextEntry={secret}/>;
 const button=(label:string,fn:()=>void,sub=false)=><Pressable onPress={fn} disabled={busy} style={[s.button,sub&&s.subButton]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 return <View style={s.root}><View style={s.head}><Text style={s.brand}>◈ NEXX <Text style={{color:'#45D6C9'}}>EVENTPASS</Text></Text><Text style={s.hint}>{TITLE}</Text></View><ScrollView contentContainerStyle={s.body}>
 {!member?<><Text style={s.title}>{register?'Create account':'Sign in'}</Text>{register&&input('Full name',name,setName)}{input('Email',email,setEmail)}{input('Password',password,setPassword,true)}{button(register?'Register':'Sign in',()=>{void login()})}{(PORTAL==='user'||PORTAL==='organiser')&&button(register?'Sign in instead':'Create account',()=>setRegister(!register),true)}<Text style={s.hint}>Google OAuth for native apps requires a separate Android/iOS integration. Use web Google sign-in meanwhile.</Text></>:<>
 <Text style={s.title}>Welcome, {member.full_name}</Text><Text style={s.hint}>{member.email}</Text>
 {member.account_status==='pending'?<View style={s.card}><Text style={s.title}>Approval pending</Text><Text style={s.hint}>Platform Admin must approve this organiser application.</Text></View>:<>{button('Refresh',()=>{void exec(async()=>load(token))},true)}
 <Text style={s.title}>Discover events</Text>{events.filter(e=>e.status==='published').map(e=><View key={e.id} style={s.card}><Text style={s.title}>{e.title}</Text><Text style={s.hint}>{e.venue} · {new Date(e.starts_at).toLocaleString()}</Text><Text style={s.title}>₦{Number(e.price_ngn).toLocaleString()}</Text>{button('Request ticket',()=>setEventId(eventId===e.id?'':e.id))}
{eventId===e.id&&<><Text style={s.hint}>Pay to {e.bank_name||'Bank not configured'} — {e.bank_account_name||''} — {e.bank_account_number||''}</Text>{input('Quantity 1–10',qty,setQty)}{input('Transfer reference',ref,setRef)}
{button(proof?'Receipt: '+proof.name:'Select receipt',()=>{void DocumentPicker.getDocumentAsync({type:['image/png','image/jpeg','image/webp','application/pdf']}).then(v=>{if(!v.canceled)setProof(v.assets[0])})},true)}
{button('Submit payment for review',()=>{void exec(async()=>{if(e.price_ngn>0&&!proof)throw Error('Receipt required');const o=await api('orders',token,'POST',{eventId:e.id,quantity:Number(qty),paymentReference:ref});if(proof){const f=new FormData();f.append('orderId',o.order.id);f.append('receipt',{uri:proof.uri,name:proof.name,type:proof.mimeType||'application/pdf'} as unknown as Blob);await api('orders/receipt',token,'POST',f)}setEventId('');setRef('');setProof(null);await load(token);Alert.alert('Submitted','Organiser will review payment')})})}</>}</View>)}
<Text style={s.title}>My tickets</Text>{tickets.map(t=><View key={t.id} style={s.card}><Text style={s.title}>{t.title}</Text>{t.qr&&<View style={{backgroundColor:'#fff',padding:14,alignSelf:'center',marginVertical:14,borderRadius:12}}><QRCode value={t.qr} size={200}/></View>}<Text style={s.hint}>{t.redeemed_at?'Already scanned':t.status}</Text></View>)}
<Text style={s.title}>My orders</Text>{orders.map(o=><View key={o.id} style={s.card}><Text style={s.hint}>{o.event_title} · {o.status} · Receipt {o.receipt_uploaded_at?'submitted':'missing'}</Text></View>)}
 </>}
 {button('Sign out',()=>{void logout()},true)}</>}
 {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{busy&&<ActivityIndicator color="#45D6C9"/>}
 </ScrollView></View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#0B1020'},head:{backgroundColor:'#171F33',paddingHorizontal:22,paddingTop:55,paddingBottom:20},brand:{fontSize:19,fontWeight:'900',color:'#fff'},body:{padding:22,paddingBottom:80},title:{color:'#fff',fontSize:23,fontWeight:'800',marginVertical:13},hint:{color:'#A4B1C8',fontSize:13,lineHeight:21,marginVertical:8},input:{borderWidth:1,borderColor:'#3A4966',backgroundColor:'#222E48',color:'#fff',minHeight:51,borderRadius:11,paddingHorizontal:14,marginVertical:8},button:{padding:15,backgroundColor:'#8B5CF6',borderRadius:10,alignItems:'center',marginVertical:8},subButton:{backgroundColor:'#283650'},buttonText:{color:'#fff',fontWeight:'800'},card:{backgroundColor:'#171F33',padding:17,borderRadius:12,borderWidth:1,borderColor:'#3A4966',marginVertical:9},error:{color:'#FDA4AF',backgroundColor:'#4A2634',padding:13,borderRadius:10,marginVertical:12}});
