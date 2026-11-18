import { colors } from '../shared/theme';
import React,{useEffect,useState} from 'react';
import {Alert,ScrollView,Pressable,Text,TextInput,View,StyleSheet,ActivityIndicator} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
WebBrowser.maybeCompleteAuthSession();

const PORTAL: string="platform_admin",TITLE="Nexx EventPass Platform Admin",BASE=(process.env.EXPO_PUBLIC_API_URL||'https://nexx-eventpass.vercel.app').replace(/\/$/,'');
type Member={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
type Event={id:string;title:string;venue:string;organiser_id:string;starts_at:string;price_ngn:number;status:string;bank_name?:string;bank_account_name?:string;bank_account_number?:string};
type Ticket={id:string;title:string;qr:string|null;status:string;redeemed_at:string|null};
type Order={id:string;event_id:string;event_title?:string;buyer_name?:string;buyer_email?:string;status:string;quantity:number;payment_reference:string;receipt_uploaded_at?:string|null;amount_ngn:number};
type Gate={event_id:string;title:string;gate_label:string};
type Applicant={id:string;email:string;full_name:string;role:string;account_status:string;requested_role?:string|null};
type AdminAccount={id:string;email:string;full_name:string;role:string;account_status:string;google_verified:boolean;ticket_count:number;order_count:number;event_count:number;gate_event_count:number};
type SupportCase={id:string;subject:string;description:string;organiser_name:string;status:string;priority:string;resolution:string};
async function api(p:string,t:string,method='GET',data?:unknown){const multi=data instanceof FormData;const r=await fetch(BASE+'/api/'+p,{method,headers:{...(multi?{}:{'Content-Type':'application/json'}),...(t?{Authorization:'Bearer '+t}:{})},body:multi?data: data?JSON.stringify(data):undefined});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v}
export default function App(){
 const [token,setToken]=useState(''),[member,setMember]=useState<Member|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[orders,setOrders]=useState<Order[]>([]),[gates,setGates]=useState<Gate[]>([]),[eventId,setEventId]=useState('');
 const [applicants,setApplicants]=useState<Applicant[]>([]),[organiserEmail,setOrganiserEmail]=useState('');
 const [accounts,setAccounts]=useState<AdminAccount[]>([]),[userSearch,setUserSearch]=useState(''),[selectedAccount,setSelectedAccount]=useState(''),[userName,setUserName]=useState(''),[deactivateReason,setDeactivateReason]=useState('');
 const [cases,setCases]=useState<SupportCase[]>([]),[resolution,setResolution]=useState(''),[settings,setSettings]=useState<Record<string,string>>({});
 const [settingKey,setSettingKey]=useState('support_email'),[settingValue,setSettingValue]=useState('');
 async function load(t:string){
 const me=await api('auth/me',t);if(!me.user)throw Error('Please sign in again');
 if(!(PORTAL==='organiser'&&me.user.account_status==='pending') && !(me.portals||[]).includes(PORTAL)){await SecureStore.deleteItemAsync('eventpass_token');setMember(null);setToken('');throw Error('This account is not authorised for this app')}
 setMember(me.user);
 if(me.user.account_status==='pending')return;
 const ev=await api('events',t);setEvents(ev.events||[]);
 const [a,people,support,configuration]=await Promise.all([api('platform/organisers',t),api('platform/users',t),api('support/cases',t),api('platform/settings',t)]);
 setApplicants(a.organisers||[]);setAccounts(people.accounts||[]);setCases(support.cases||[]);setSettings(configuration.settings||{});
 }
 useEffect(()=>{SecureStore.getItemAsync('eventpass_token').then(t=>{if(t){setToken(t);load(t).catch(e=>setError((e as Error).message))}}).catch(()=>{})},[]);
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
   setToken(data.token);await load(data.token);
 })}
 async function searchUsers(){await exec(async()=>{const r=await api('platform/users?q='+encodeURIComponent(userSearch),token);setAccounts(r.accounts||[])})}
 async function changeAccount(action:'configure'|'suspend'|'restore'|'deactivate'){await exec(async()=>{
  if(!selectedAccount)throw Error('Select an account');
  if(action==='deactivate'&&!deactivateReason.trim())throw Error('Provide a deactivation reason');
  await api('platform/users',token,'PATCH',{action,userId:selectedAccount,fullName:userName,reason:deactivateReason});
  const r=await api('platform/users?q='+encodeURIComponent(userSearch),token);setAccounts(r.accounts||[]);
  Alert.alert('Account updated','Change recorded in platform audit.');
 })}
 async function resolveCase(id:string,status:'in_progress'|'resolved'){await exec(async()=>{
  await api('support/cases',token,'PATCH',{id,status,priority:'normal',resolution});
  setCases((await api('support/cases',token)).cases||[]);Alert.alert('Support case',status);
 })}
 async function saveSetting(){await exec(async()=>{await api('platform/settings',token,'PATCH',{key:settingKey,value:settingValue});setSettings({...settings,[settingKey]:settingValue});Alert.alert('Configuration saved')})}
 async function logout(){try{if(token)await api('auth/logout',token,'POST')}catch{setError('Server logout unavailable; session may remain active until expiry.')}finally{await SecureStore.deleteItemAsync('eventpass_token');setToken('');setMember(null)}}
 const input=(hint:string,value:string,update:(x:string)=>void,secret=false)=><TextInput style={s.input} placeholder={hint} placeholderTextColor="#94a3b8" value={value} onChangeText={update} autoCapitalize="none" secureTextEntry={secret}/>;
 const button=(label:string,fn:()=>void,sub=false)=><Pressable onPress={fn} disabled={busy} style={[s.button,sub&&s.subButton]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 return <View style={s.root}><View style={s.head}><Text style={s.brand}>◈ NEXX <Text style={{color:'#45D6C9'}}>EVENTPASS</Text></Text><Text style={s.hint}>{TITLE}</Text></View><ScrollView contentContainerStyle={s.body}>
 {!member?<><Text style={s.title}>Google sign-in</Text>
 <Text style={s.hint}>Only approved Platform Administrators can sign in.</Text>
 {button('Continue with Google',()=>{void login()})}
 </>:<>
 <Text style={s.title}>Welcome, {member.full_name}</Text><Text style={s.hint}>{member.email}</Text>
 {member.account_status==='pending'?<View style={s.card}><Text style={s.title}>Approval pending</Text><Text style={s.hint}>Platform Admin must approve this organiser application.</Text></View>:<>{button('Refresh',()=>{void exec(async()=>load(token))},true)}
 <Text style={s.title}>Organiser management</Text>{input('Existing Google-verified User email',organiserEmail,setOrganiserEmail)}{button('Create organiser',()=>{void exec(async()=>{await api('platform/organisers',token,'POST',{action:'create',email:organiserEmail});await load(token)})})}
{applicants.map(a=><View key={a.id} style={s.card}><Text style={s.title}>{a.full_name}</Text><Text style={s.hint}>{a.email} · {a.role} · {a.account_status}</Text>
{a.role==='user'&&a.requested_role==='organiser'&&button('Approve organiser',()=>{void exec(async()=>{await api('platform/organisers',token,'POST',{action:'approve',userId:a.id});await load(token)})})}
{a.role==='organiser'&&a.account_status==='active'&&button('Suspend',()=>{void exec(async()=>{await api('platform/organisers',token,'POST',{action:'suspend',userId:a.id});await load(token)})},true)}
{a.role==='organiser'&&a.account_status==='suspended'&&button('Restore',()=>{void exec(async()=>{await api('platform/organisers',token,'POST',{action:'restore',userId:a.id});await load(token)})})}</View>)}
 <Text style={s.title}>All users and access</Text><Text style={s.hint}>Search user, organiser and gate identities. Open a profile to see ticket and event counts.</Text>
 {input('Search account by email or name',userSearch,setUserSearch)}
 {button('Search accounts',()=>{void searchUsers()},true)}
 {accounts.map(a=><View key={a.id} style={s.card}>
  <Text style={{color:'#fff',fontWeight:'800',fontSize:16}}>{a.full_name}</Text><Text style={s.hint}>{a.email} · {a.role} · {a.account_status}</Text>
  <Text style={s.hint}>{a.ticket_count} tickets · {a.order_count} orders · {a.event_count} hosted events · {a.gate_event_count} gates</Text>
  {button('Open user profile',()=>{setSelectedAccount(a.id);setUserName(a.full_name)},true)}
  {selectedAccount===a.id&&a.role!=='platform_admin'&&<>
   {input('Name',userName,setUserName)}{button('Save profile',()=>{void changeAccount('configure')})}
   {a.account_status==='active'?button('Suspend account',()=>{void changeAccount('suspend')},true):button('Restore account',()=>{void changeAccount('restore')})}
   {input('Deactivation reason',deactivateReason,setDeactivateReason)}
   {button('Deactivate (keep audit records)',()=>{void Alert.alert('Deactivate','Keep paid ticket and admission records?',[
    {text:'Cancel',style:'cancel'},{text:'Deactivate',style:'destructive',onPress:()=>{void changeAccount('deactivate')}}])},true)}
  </>}
 </View>)}
 <Text style={s.title}>Organiser support desk</Text>
 {cases.map(c=><View style={s.card} key={c.id}><Text style={{color:'#fff',fontSize:16,fontWeight:'800'}}>{c.subject}</Text>
 <Text style={s.hint}>{c.organiser_name} · {c.status} · {c.priority}</Text><Text style={s.hint}>{c.description}</Text>
 {button('Investigate',()=>{void resolveCase(c.id,'in_progress')},true)}{button('Resolve',()=>{void resolveCase(c.id,'resolved')})}
 </View>)}
 {input('Support case resolution',resolution,setResolution)}
 <Text style={s.title}>Platform settings</Text>
 <Text style={s.hint}>Supported settings: support_email, organiser_approval_policy, event_verification_policy, help_text. Secrets are configured only on the server.</Text>
 {input('Setting key',settingKey,setSettingKey)}{input('Setting value',settingValue,setSettingValue)}
 {button('Save setting',()=>{void saveSetting()})}
 </>}
 {button('Sign out',()=>{void logout()},true)}</>}
 {!!error&&<Text style={s.error} accessibilityRole="alert">{error}</Text>}{busy&&<ActivityIndicator color="#45D6C9"/>}
 </ScrollView></View>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:colors.background},head:{backgroundColor:colors.surface,paddingHorizontal:22,paddingTop:55,paddingBottom:20},brand:{fontSize:19,fontWeight:'900',color:'#fff'},body:{padding:22,paddingBottom:80},title:{color:'#fff',fontSize:23,fontWeight:'800',marginVertical:13},hint:{color:colors.textMuted,fontSize:13,lineHeight:21,marginVertical:8},input:{borderWidth:1,borderColor:colors.border,backgroundColor:'#222E48',color:'#fff',minHeight:51,borderRadius:11,paddingHorizontal:14,marginVertical:8},button:{padding:15,backgroundColor:colors.secondary,borderRadius:10,alignItems:'center',marginVertical:8},subButton:{backgroundColor:'#283650'},buttonText:{color:'#fff',fontWeight:'800'},card:{backgroundColor:colors.surface,padding:17,borderRadius:12,borderWidth:1,borderColor:colors.border,marginVertical:9},error:{color:'#FDA4AF',backgroundColor:'#4A2634',padding:13,borderRadius:10,marginVertical:12}});
