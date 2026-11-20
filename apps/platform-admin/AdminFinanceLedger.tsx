import React,{useCallback,useEffect,useState} from 'react';
import {Alert,Pressable,Text,TextInput,View,StyleSheet} from 'react-native';

type Payment={
 order_id:string;event_title:string;method:string;gross_ngn:number;commission_ngn:number;
 organiser_net_ngn:number;received_ngn:number|null;remittance_reference:string|null;
 reconciliation_status:'not_due'|'outstanding'|'matched'|'discrepancy';
};
type Ledger={payments:Payment[];totals:{gross_ngn:string;organiser_net_ngn:string;commission_ngn:string;received_ngn:string;outstanding_ngn:string;discrepancies:string};basisPoints:number};
const money=(x:string|number)=>'₦'+Number(x).toLocaleString('en-NG');
export default function AdminFinanceLedger({token,apiBase}:{token:string;apiBase:string}){
 const [ledger,setLedger]=useState<Ledger|null>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [rate,setRate]=useState(''),[selected,setSelected]=useState<string|null>(null),[amount,setAmount]=useState(''),[reference,setReference]=useState('');
 const request=useCallback(async(method:'GET'|'PATCH'='GET',body?:object)=>{
  const response=await fetch(apiBase+'/api/finance',{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Finance service unavailable');return data;
 },[apiBase,token]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{const data:Ledger=await request();setLedger(data);setRate((data.basisPoints/100).toFixed(2));}
  catch(e){setError(e instanceof Error?e.message:'Could not load financial ledger');}
  finally{setLoading(false)}
 },[request]);
 useEffect(()=>{void refresh()},[refresh]);
 async function record(body:object,action:string){
  if(saving)return;
  setSaving(true);setError('');setMessage('');
  try{
   const result=await request('PATCH',body);
   setSelected(null);await refresh();
   setMessage(result.status==='discrepancy'?'Discrepancy recorded. Confirm the actual remittance with independent evidence.':action+' saved and audited.');
  }catch(e){setError(e instanceof Error?e.message:'Could not save financial action')}
  finally{setSaving(false)}
 }
 function confirmRate(){
  const value=Number(rate),basisPoints=Math.round(value*100);
  if(!rate.trim()||!Number.isFinite(value)||value<0||value>100||Math.abs(value*100-basisPoints)>0.001){setError('Enter a commission percentage from 0 to 100, with at most two decimal places.');return}
  Alert.alert('Change platform commission?', 'Set '+value.toFixed(2)+'% for future approvals only. Past commission snapshots will not change.',[
   {text:'Cancel',style:'cancel'},{text:'Update rate',onPress:()=>void record({action:'commission',basisPoints},'Commission policy')}
  ]);
 }
 function openSettlement(p:Payment){
  setSelected(prev=>prev===p.order_id?null:p.order_id);
  setAmount(p.received_ngn===null?'':String(p.received_ngn));setReference(p.remittance_reference||'');
 }
 function confirmSettlement(p:Payment){
  const paid=Number(amount);
  if(!amount.trim()||!Number.isSafeInteger(paid)||paid<0){setError('Enter the actual integer naira amount received from the bank statement.');return}
  if(reference.trim().length<5){setError('Provide a real bank/statement reference of at least five characters.');return}
  Alert.alert('Verify commission remittance','Confirm independently received '+money(paid)+' for '+p.event_title+' (expected '+money(p.commission_ngn)+'). A mismatched amount will be recorded as a discrepancy.',[
   {text:'Cancel',style:'cancel'},{text:'Record verified amount',onPress:()=>void record({action:'reconcile',orderId:p.order_id,receivedNgn:paid,reference:reference.trim()},'Remittance')}
  ]);
 }
 const button=(label:string,onPress:()=>void,secondary=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled:saving||loading}} disabled={saving||loading} onPress={onPress} style={[styles.button,secondary&&styles.secondary]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
 return <View style={styles.root}>
  <View style={styles.heading}>
   <View style={{flex:1}}><Text style={styles.title}>Verified collections & commissions</Text><Text style={styles.note}>Read-only ledger amounts come from verified payment records, not unconfirmed orders or offline distribution labels.</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel="Refresh verified finance ledger" disabled={loading||saving} onPress={()=>void refresh()} style={styles.refresh}><Text style={styles.refreshText}>↻</Text></Pressable>
  </View>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!message&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
  {loading&&<Text style={styles.note}>Loading verified financial records…</Text>}
  {ledger&&<>
   <View style={styles.kpis}>
    {([
     ['Verified gross',ledger.totals.gross_ngn],['Organiser net',ledger.totals.organiser_net_ngn],
     ['Platform commissions',ledger.totals.commission_ngn],['Commission received',ledger.totals.received_ngn],
     ['Commission outstanding',ledger.totals.outstanding_ngn]
    ] as const).map(([label,value])=><View key={label} style={styles.kpi}><Text style={styles.kpiLabel}>{label}</Text><Text style={styles.kpiValue} adjustsFontSizeToFit numberOfLines={1}>{money(value)}</Text></View>)}
   </View>
   <Text style={styles.note}>{Number(ledger.totals.discrepancies)} reconciliation discrepancies. Manually logged offline ticket sales are not included in verified collection totals.</Text>
   <View style={styles.card}>
    <Text style={styles.subTitle}>Commission policy</Text>
    <Text style={styles.note}>Applies only to future verified payments. Historical approved orders keep their recorded commission.</Text>
    <TextInput accessibilityLabel="Commission rate percentage" value={rate} onChangeText={setRate} placeholder="e.g. 7.50" placeholderTextColor="#93a6c6" keyboardType="decimal-pad" style={styles.input}/>
    {button('Save future commission rate',confirmRate)}
   </View>
   <Text style={styles.subTitle}>Verified payment ledger ({ledger.payments.length} most recent)</Text>
   {!ledger.payments.length&&<Text style={styles.note}>No verified collections yet. Refund and bank review controls remain available below.</Text>}
   {ledger.payments.map(p=><View key={p.order_id} style={styles.card}>
    <Text style={styles.itemTitle}>{p.event_title}</Text>
    <Text style={styles.note}>{p.method} · {p.reconciliation_status.replaceAll('_',' ')}</Text>
    <Text style={styles.note}>{money(p.gross_ngn)} gross · {money(p.commission_ngn)} commission · {money(p.organiser_net_ngn)} organiser net</Text>
    <Text style={styles.note}>Received: {p.received_ngn===null?'Not recorded':money(p.received_ngn)} · Reference: {p.remittance_reference||'None'}</Text>
    <Text style={styles.ref} selectable>Order {p.order_id}</Text>
    {p.commission_ngn>0&&button(selected===p.order_id?'Cancel reconciliation':'Review commission settlement',()=>openSettlement(p),true)}
    {selected===p.order_id&&<View style={styles.entry}>
     <Text style={styles.subTitle}>Verified bank statement details</Text>
     <TextInput accessibilityLabel={'Amount received for '+p.event_title} placeholder="Actual amount received (₦)" placeholderTextColor="#93a6c6" keyboardType="numeric" value={amount} onChangeText={setAmount} style={styles.input}/>
     <TextInput accessibilityLabel={'Statement reference for '+p.event_title} placeholder="Bank or statement reference" placeholderTextColor="#93a6c6" value={reference} onChangeText={setReference} maxLength={120} style={styles.input}/>
     <Text style={styles.note}>Only confirm after independently checking the statement. A mismatch is an auditable discrepancy, not a matched settlement.</Text>
     {button('Record verified remittance',()=>confirmSettlement(p))}
    </View>}
   </View>)}
  </>}
 </View>;
}
const styles=StyleSheet.create({
 root:{gap:13,marginVertical:13},heading:{flexDirection:'row',alignItems:'center',gap:12},
 title:{color:'#fff',fontSize:20,fontWeight:'900',letterSpacing:-.4},subTitle:{color:'#fff',fontSize:16,fontWeight:'800'},
 note:{color:'#c5d3e9',fontSize:12,lineHeight:19,marginTop:5},
 refresh:{width:45,height:45,borderColor:'#7786af',borderWidth:1,backgroundColor:'#2b3656',borderRadius:12,alignItems:'center',justifyContent:'center'},
 refreshText:{color:'#fff',fontWeight:'900',fontSize:21},
 kpis:{flexDirection:'row',flexWrap:'wrap',gap:9},
 kpi:{width:'48%',backgroundColor:'#1a2945',padding:13,minHeight:96,borderRadius:13,borderWidth:1,borderColor:'#445476',justifyContent:'space-between'},
 kpiLabel:{color:'#b5c6e4',fontSize:11,fontWeight:'700'},kpiValue:{color:'#fff',fontSize:20,fontWeight:'900'},
 card:{backgroundColor:'#15213b',borderRadius:15,padding:15,borderWidth:1,borderColor:'#3d4d6b',gap:9},
 itemTitle:{color:'#fff',fontSize:15,fontWeight:'900'},
 ref:{color:'#95acdb',fontSize:11},input:{backgroundColor:'#101a30',borderColor:'#586991',borderWidth:1,borderRadius:11,minHeight:48,paddingHorizontal:12,color:'#fff'},
 button:{backgroundColor:'#6644bd',borderRadius:12,minHeight:47,alignItems:'center',justifyContent:'center',padding:12},
 secondary:{backgroundColor:'#253755',borderColor:'#53648a',borderWidth:1},
 buttonText:{color:'#fff',fontWeight:'800',fontSize:13,textAlign:'center'},
 entry:{marginTop:10,gap:10,borderTopColor:'#51617c',borderTopWidth:1,paddingTop:14},
 error:{padding:12,backgroundColor:'#58283a',borderRadius:11,color:'#fff0f2'},
 message:{padding:12,backgroundColor:'#1d493d',borderRadius:11,color:'#c5f8e7'}
});
