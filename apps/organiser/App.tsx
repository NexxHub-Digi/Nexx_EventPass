import React,{useEffect,useState} from 'react';
import {Alert,Share,ScrollView,Pressable,Text,TextInput,View,StyleSheet,ActivityIndicator,Image} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
WebBrowser.maybeCompleteAuthSession();

const PORTAL: string="organiser",TITLE="Nexx EventPass Event Organiser",BASE=(process.env.EXPO_PUBLIC_API_URL||'https://nexx-eventpass.vercel.app').replace(/\/$/,'');
type Member={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
type Event={id:string;title:string;venue:string;organiser_id:string;starts_at:string;price_ngn:number;status:string;description?:string;category?:string;ticket_theme?:string;verification_status?:string;bank_name?:string;bank_account_name?:string;bank_account_number?:string};
type Ticket={id:string;title:string;qr:string|null;status:string;redeemed_at:string|null};
type Order={id:string;event_id:string;event_title?:string;buyer_name?:string;buyer_email?:string;status:string;quantity:number;payment_reference:string;receipt_uploaded_at?:string|null;amount_ngn:number};
type Gate={event_id:string;title:string;gate_label:string};
type Applicant={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
async function api(p:string,t:string,method='GET',data?:unknown){const multi=data instanceof FormData;const r=await fetch(BASE+'/api/'+p,{method,headers:{...(multi?{}:{'Content-Type':'application/json'}),...(t?{Authorization:'Bearer '+t}:{})},body:multi?data: data?JSON.stringify(data):undefined});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v}
export default function App(){
 const [token,setToken]=useState(''),[member,setMember]=useState<Member|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[orders,setOrders]=useState<Order[]>([]),[gates,setGates]=useState<Gate[]>([]),[eventId,setEventId]=useState('');
 const [bank,setBank]=useState(''),[accName,setAccName]=useState(''),[accNo,setAccNo]=useState(''),[eventTitle,setEventTitle]=useState(''),[venue,setVenue]=useState(''),[date,setDate]=useState(''),[time,setTime]=useState('19:00'),[price,setPrice]=useState('5000'),[capacity,setCapacity]=useState('100'),[keyword,setKeyword]=useState(''),[staff,setStaff]=useState('');
 const [description,setDescription]=useState(''),[category,setCategory]=useState('Music'),[theme,setTheme]=useState('aurora'),[media,setMedia]=useState<{id:string;media_type:string;url:string;approved:boolean}[]>([]);
 const themes=[['aurora','Aurora Glow'],['midnight','Midnight Gold'],['sunset','Sunset Social'],['neon','Neon Pulse'],['minimal','Minimal Ivory'],['custom','Custom Artwork']];
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
   await api('events',token,'PATCH',{eventId,description,category,ticketTheme:theme});
   await load(token);Alert.alert('Design saved','Updates are waiting for verification');
  });
 }
 async function load(t:string){
 const me=await api('auth/me',t);if(!me.user)throw Error('Please sign in again');
 if(!(PORTAL==='organiser'&&(me.user.requested_role==='organiser'||me.user.account_status==='pending')) && !(me.portals||[]).includes(PORTAL)){await SecureStore.deleteItemAsync('eventpass_token');setMember(null);setToken('');throw Error('This account is not authorised for this app')}
 setMember(me.user);
 if(me.user.account_status==='pending'||me.user.requested_role==='organiser')return;
 const ev=await api('events',t);setEvents(ev.events||[]);
 const b=await api('organiser/payment-account',t);setBank(b.account?.bank_name||'');setAccName(b.account?.account_name||'');setAccNo(b.account?.account_number||'');
 }
 useEffect(()=>{SecureStore.getItemAsync('eventpass_token').then(t=>{if(t){setToken(t);load(t).catch(e=>setError((e as Error).message))}}).catch(()=>{})},[]);
 async function exec(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function login(){await exec(async()=>{
   const redirect='eventpassorganiser://oauth';
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
 <Text style={s.hint}>Apply with Google. You can create and publish events after Platform Admin verification.</Text>
 {button('Continue with Google',()=>{void login()})}
 </>:<>
 <Text style={s.title}>Welcome, {member.full_name}</Text><Text style={s.hint}>{member.email}</Text>
 {(member.account_status==='pending'||member.requested_role==='organiser')?<View style={s.card}><Text style={s.title}>Approval pending</Text><Text style={s.hint}>Platform Admin must approve this organiser application.</Text></View>:<>{button('Refresh',()=>{void exec(async()=>load(token))},true)}
 <Text style={s.title}>Your bank details</Text>{input('Bank',bank,setBank)}{input('Account name',accName,setAccName)}{input('Account number',accNo,setAccNo)}
{button('Save details',()=>{void exec(async()=>{await api('organiser/payment-account',token,'POST',{bankName:bank,accountName:accName,accountNumber:accNo});Alert.alert('Saved')})})}
<Text style={s.title}>Create a new event</Text><Text style={s.hint}>Create multiple listings; each is reviewed before it appears in User discovery.</Text>
{input('Event title',eventTitle,setEventTitle)}{input('Event venue',venue,setVenue)}{input('Description and experience details',description,setDescription)}
{input('Category (Music / Festival / Business...)',category,setCategory)}
{input('Date (YYYY-MM-DD)',date,setDate)}{input('Time (HH:MM, 24-hour)',time,setTime)}
{input('Price in NGN',price,setPrice)}{input('Capacity',capacity,setCapacity)}{input('Private QR keyword (8+ characters)',keyword,setKeyword,true)}
<Text style={s.title}>Ticket themes</Text><ScrollView horizontal contentContainerStyle={{gap:8,paddingBottom:9}}>
{themes.map(([id,name])=><Pressable key={id} onPress={()=>setTheme(id)} style={[s.card,{minWidth:120,backgroundColor:theme===id?'#6240a9':'#273351',borderColor:theme===id?'#49f1d4':'#425173'}]}><Text style={{color:'#fff',fontWeight:'800'}}>{name}</Text><Text style={s.hint}>{theme===id?'✓ Selected':'Preview'}</Text></Pressable>)}</ScrollView>
{button('Create event for review',()=>{void exec(async()=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))throw Error('Use date YYYY-MM-DD and time HH:MM');
 const startsAt=new Date(date+'T'+time+':00');
 if(!Number.isFinite(startsAt.getTime())||startsAt.getTime()<=Date.now())throw Error('Choose a future event date and time');
 const result=await api('events',token,'POST',{title:eventTitle,venue,description,category,ticketTheme:theme,startsAt:startsAt.toISOString(),priceNgn:Number(price),capacity:Number(capacity),qrKeyword:keyword});
 await load(token);setEventId(result.event.id);setEventTitle('');setKeyword('');
 Alert.alert('Event created','Upload posters and ticket artwork, then wait for Platform Admin verification.');
})})}
<Text style={s.title}>My events</Text>{events.filter(e=>e.organiser_id===member.id).map(e=><Pressable key={e.id} style={[s.card,eventId===e.id&&{borderColor:'#45D6C9'}]} onPress={()=>{setEventId(e.id);setDescription(e.description||'');setCategory(e.category||'Other');setTheme(e.ticket_theme||'aurora');void exec(async()=>{setOrders((await api('orders?eventId='+e.id,token)).orders||[]);setMedia((await api('events/media?eventId='+e.id,token)).media||[])})}}><Text style={s.title}>{e.title}</Text><Text style={s.hint}>{e.status} · {e.verification_status||'verified'}</Text></Pressable>)}
{!!eventId&&<>
 <Text style={s.title}>Event media & ticket artwork</Text><Text style={s.hint}>Upload posters, short videos and custom design images for platform review.</Text>
 {button('Upload photo or short video',()=>{void uploadEventFile()})}
 {button('Import custom ticket artwork',()=>{void uploadEventFile('ticket_art')},true)}
 <ScrollView horizontal contentContainerStyle={{gap:12,marginVertical:14}}>{media.map(m=><View key={m.id} style={{width:160}}>{m.media_type==='video'?<Text style={s.hint}>▶ Video uploaded</Text>:<Image source={{uri:BASE+m.url}} style={{width:150,height:115,borderRadius:10}}/>}<Text style={s.hint}>{m.approved?'Approved':'Pending media review'}</Text></View>)}</ScrollView>
 <Text style={s.title}>Update ticket design</Text><ScrollView horizontal contentContainerStyle={{gap:8}}>{themes.map(([id,name])=><Pressable key={id} onPress={()=>setTheme(id)} style={[s.card,{backgroundColor:theme===id?'#513c83':'#273351'}]}><Text style={s.buttonText}>{name}</Text></Pressable>)}</ScrollView>
 {input('Description',description,setDescription)}{input('Category',category,setCategory)}{button('Save event design',()=>{void saveDesign()})}
 <Text style={s.title}>Manual payment approval</Text>{orders.map(o=><View style={s.card} key={o.id}><Text style={s.hint}>{o.buyer_name||o.buyer_email} · ₦{Number(o.amount_ngn).toLocaleString()} · {o.status}</Text><Text style={s.hint}>Receipt: {o.receipt_uploaded_at?'Submitted — view on web':'Missing'}</Text>{o.status==='pending'&&button('Approve verified transfer',()=>{void exec(async()=>{await api('review',token,'POST',{orderId:o.id,decision:'approved'});setOrders((await api('orders?eventId='+eventId,token)).orders||[])})})}</View>)}
{input('Gate operator email',staff,setStaff)}{button('Invite gate operator',()=>{void exec(async()=>{const r=await api('gates',token,'POST',{eventId,email:staff,gateLabel:'Main gate'});await Share.share({message:'Your private Nexx EventPass gate invitation (expires in 72 hours): '+r.invitationLink});Alert.alert('Invitation created','Share the link privately. The invited recipient signs in using Google to accept.')})})}{button('Add existing verified person',()=>{void exec(async()=>{const r=await api('gates',token,'POST',{eventId,email:staff,gateLabel:'Main gate',mode:'add'});Alert.alert('Operator added',r.message);setStaff('')})},true)}</>}
 </>}
 {button('Sign out',()=>{void logout()},true)}</>}
 {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{busy&&<ActivityIndicator color="#45D6C9"/>}
 </ScrollView></View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#0B1020'},head:{backgroundColor:'#171F33',paddingHorizontal:22,paddingTop:55,paddingBottom:20},brand:{fontSize:19,fontWeight:'900',color:'#fff'},body:{padding:22,paddingBottom:80},title:{color:'#fff',fontSize:23,fontWeight:'800',marginVertical:13},hint:{color:'#A4B1C8',fontSize:13,lineHeight:21,marginVertical:8},input:{borderWidth:1,borderColor:'#3A4966',backgroundColor:'#222E48',color:'#fff',minHeight:51,borderRadius:11,paddingHorizontal:14,marginVertical:8},button:{padding:15,backgroundColor:'#8B5CF6',borderRadius:10,alignItems:'center',marginVertical:8},subButton:{backgroundColor:'#283650'},buttonText:{color:'#fff',fontWeight:'800'},card:{backgroundColor:'#171F33',padding:17,borderRadius:12,borderWidth:1,borderColor:'#3A4966',marginVertical:9},error:{color:'#FDA4AF',backgroundColor:'#4A2634',padding:13,borderRadius:10,marginVertical:12}});
