import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,Alert,ScrollView,Pressable,Text,TextInput,View,StyleSheet,Platform,StatusBar,ActivityIndicator,Image} from 'react-native';
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
 const scroll=useRef<ScrollView>(null);
 const [reduceMotion,setReduceMotion]=useState(true);
 useEffect(()=>{
  let mounted=true;
  void AccessibilityInfo.isReduceMotionEnabled().then(enabled=>{if(mounted)setReduceMotion(enabled)}).catch(()=>{});
  const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
  return ()=>{mounted=false;listener.remove()};
 },[]);
 const [booting,setBooting]=useState(true);
 const [section,setSection]=useState<'organisers'|'accounts'|'support'|'settings'>('organisers');
 const [token,setToken]=useState(''),[member,setMember]=useState<Member|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [events,setEvents]=useState<Event[]>([]),[tickets,setTickets]=useState<Ticket[]>([]),[orders,setOrders]=useState<Order[]>([]),[gates,setGates]=useState<Gate[]>([]),[eventId,setEventId]=useState('');
 const [applicants,setApplicants]=useState<Applicant[]>([]),[organiserEmail,setOrganiserEmail]=useState('');
 const [accounts,setAccounts]=useState<AdminAccount[]>([]),[userSearch,setUserSearch]=useState(''),[selectedAccount,setSelectedAccount]=useState(''),[userName,setUserName]=useState(''),[deactivateReason,setDeactivateReason]=useState('');
 const [cases,setCases]=useState<SupportCase[]>([]),[resolution,setResolution]=useState(''),[settings,setSettings]=useState<Record<string,string>>({});
 const [settingKey,setSettingKey]=useState('support_email'),[settingValue,setSettingValue]=useState('');
 const [bankAccounts,setBankAccounts]=useState<{id:string;bank_name:string;account_name:string;account_number:string;status:string;organiser_name:string}[]>([]);
 const [bankReviewId,setBankReviewId]=useState(''),[bankReviewNote,setBankReviewNote]=useState('');
 async function load(t:string){
 const me=await api('auth/me',t);if(!me.user)throw Error('Please sign in again');
 if(!(PORTAL==='organiser'&&me.user.account_status==='pending') && !(me.portals||[]).includes(PORTAL)){await SecureStore.deleteItemAsync('eventpass_token');setMember(null);setToken('');throw Error('This account is not authorised for this app')}
 setMember(me.user);
 setBankAccounts((await api('organiser/payment-account',t)).accounts||[]);
 if(me.user.account_status==='pending')return;
 const ev=await api('events',t);setEvents(ev.events||[]);
 const [a,people,support,configuration]=await Promise.all([api('platform/organisers',t),api('platform/users',t),api('support/cases',t),api('platform/settings',t)]);
 setApplicants(a.organisers||[]);setAccounts(people.accounts||[]);setCases(support.cases||[]);setSettings(configuration.settings||{});
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
   <Pressable style={s.brandRow} accessibilityRole="button" accessibilityLabel="Platform Admin home" disabled={busy||!member} onPress={()=>{
     setSection('organisers');scroll.current?.scrollTo({y:0,animated:false});
   }}>
    <Image accessible={false} source={require('./assets/app-icon.png')} style={s.brandMark}/><View style={s.brandCopy}>
    <Text style={s.brand}>Nexx EventPass</Text><Text style={s.headLabel}>Platform Admin</Text>
   </View></Pressable>
   {member&&<Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={busy} onPress={()=>void logout()} style={s.accountBadge}><Text style={s.headLabel}>Sign out</Text></Pressable>}
  </View>
  <Animated.View style={[{flex:1},surfaceStyle]}>
  <ScrollView ref={scroll} key={member?section:'signin'} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
 {!member?<View style={s.welcome}>
   <View pointerEvents="none" style={s.welcomeGlow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/>
   <Text style={s.welcomeLabel}>Platform operations</Text><Text style={s.welcomeTitle}>Manage EventPass.</Text>
   <Text style={s.welcomeText}>Review accounts, verify bank details and resolve support cases.</Text>
   {button('Continue with Google',()=>{void login()})}
  </View>:<>
 <Text style={s.title}>Welcome, {member.full_name}</Text><Text style={s.hint}>{member.email}</Text>
 {member.account_status==='pending'?<View style={s.card}><Text style={s.title}>Approval pending</Text><Text style={s.hint}>Platform Admin must approve this organiser application.</Text></View>:<>{button('Refresh',()=>{void exec(async()=>load(token))},true)}
 {section==='organisers'&&<><Text style={s.title}>Organiser management</Text>{input('Existing Google-verified User email',organiserEmail,setOrganiserEmail)}{button('Create organiser',()=>{void exec(async()=>{await api('platform/organisers',token,'POST',{action:'create',email:organiserEmail});await load(token)})})}
<Text style={s.title}>Organiser bank account verification</Text>
<Text style={s.hint}>Independently confirm the beneficiary and account number before verifying.</Text>
{bankAccounts.filter(account=>account.status==='pending').map(account=><View key={account.id} style={s.card}>
 <Text style={s.title}>{account.organiser_name}</Text><Text selectable style={s.hint}>{account.bank_name} · {account.account_name} · {account.account_number}</Text>
 {button('Verify account',()=>{void exec(async()=>{
  await api('organiser/payment-account',token,'PATCH',{accountId:account.id,decision:'verified'});await load(token);
 })})}
 {bankReviewId===account.id?<><TextInput accessibilityLabel="Reason for rejection" placeholder="Reason for rejection" placeholderTextColor="#a4b1c8" style={s.input} value={bankReviewNote} onChangeText={setBankReviewNote}/>
 {button('Confirm rejection',()=>{void exec(async()=>{
  await api('organiser/payment-account',token,'PATCH',{accountId:account.id,decision:'rejected',note:bankReviewNote});setBankReviewId('');await load(token);
 })},true)}</>:button('Reject account',()=>{setBankReviewId(account.id);setBankReviewNote('')},true)}
</View>)}
{applicants.map(a=><View key={a.id} style={s.card}><Text style={s.title}>{a.full_name}</Text><Text style={s.hint}>{a.email} · {a.role} · {a.account_status}</Text>
{a.role==='user'&&a.requested_role==='organiser'&&button('Approve organiser',()=>{void exec(async()=>{await api('platform/organisers',token,'POST',{action:'approve',userId:a.id});await load(token)})})}
{a.role==='organiser'&&a.account_status==='active'&&button('Suspend',()=>{void exec(async()=>{await api('platform/organisers',token,'POST',{action:'suspend',userId:a.id});await load(token)})},true)}
{a.role==='organiser'&&a.account_status==='suspended'&&button('Restore',()=>{void exec(async()=>{await api('platform/organisers',token,'POST',{action:'restore',userId:a.id});await load(token)})})}</View>)}
 </>}
 {section==='accounts'&&<><Text style={s.title}>All users and access</Text><Text style={s.hint}>Search user, organiser and gate identities. Open a profile to see ticket and event counts.</Text>
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
 </>}
 {section==='support'&&<><Text style={s.title}>Organiser support desk</Text>
 {cases.map(c=><View style={s.card} key={c.id}><Text style={{color:'#fff',fontSize:16,fontWeight:'800'}}>{c.subject}</Text>
 <Text style={s.hint}>{c.organiser_name} · {c.status} · {c.priority}</Text><Text style={s.hint}>{c.description}</Text>
 {button('Investigate',()=>{void resolveCase(c.id,'in_progress')},true)}{button('Resolve',()=>{void resolveCase(c.id,'resolved')})}
 </View>)}
 {input('Support case resolution',resolution,setResolution)}
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
 {member&&<View style={s.navigation}>{([['organisers', 'Organisers'], ['accounts', 'Users'], ['support', 'Support'], ['settings', 'Settings']] as const).map(([key,label])=><Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:section===key}} disabled={busy}
  style={({pressed})=>[s.navLink,section===key&&s.navCurrent,pressed&&(reduceMotion?s.pressedStill:s.pressed)]} onPress={()=>setSection(key)}><Text style={[s.navText,section===key&&s.navTextCurrent]}>{label}</Text></Pressable>)}</View>}
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
 loadingTrack:{minHeight:24,justifyContent:'center'},loadingDot:{width:9,height:9,borderRadius:5,backgroundColor:'#9ccfff'},
 pressedStill:{opacity:.76},
 welcomeGlow:{position:'absolute',width:212,height:212,borderRadius:106,borderWidth:26,borderColor:'#9ccfff22',right:-68,top:-107},
 welcome:{overflow:'hidden',backgroundColor:'#1e2350',borderRadius:24,borderWidth:1,borderColor:'#634994',padding:24,marginTop:22,gap:13},
 welcomeLabel:{color:'#9ccfff',fontSize:13,fontWeight:'800',letterSpacing:1.2},
 welcomeTitle:{color:'#fff',fontSize:36,lineHeight:40,fontWeight:'900',letterSpacing:-1.5},
 welcomeText:{color:'#d0d9f2',fontSize:16,lineHeight:24,marginBottom:6},
 navigation:{flexDirection:'row',paddingHorizontal:8,paddingTop:8,paddingBottom:Platform.OS==='ios'?24:10,gap:4,backgroundColor:'#111b32',borderTopWidth:1,borderColor:'#354971'},
 navLink:{flex:1,alignItems:'center',justifyContent:'center',minHeight:49,borderRadius:11,paddingHorizontal:2},
 navCurrent:{backgroundColor:'#32265c'},navText:{fontSize:12,fontWeight:'700',color:'#c1cdec'},navTextCurrent:{color:'#9ccfff'},
});
