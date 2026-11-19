import React,{useEffect,useState} from 'react';
import {Pressable,Text,TextInput,View,StyleSheet} from 'react-native';

type PreviewMode='ticket'|'qr'|'both';
type Fields={title:string;venue:string;startsAt:string;price:string;organiser:string;admission:string;holder:string;reference:string;notes:string};
type FieldKey=keyof Fields;
const fieldNames:readonly [FieldKey,string][]=[
 ['title','Event title'],['organiser','Presented by'],['venue','Venue'],['startsAt','Date & time'],
 ['price','Price (NGN)'],['admission','Admission label'],['holder','Ticket holder'],
 ['reference','Ticket reference'],['notes','Additional details']
];
const visibleByDefault:Record<FieldKey,boolean>={title:true,venue:true,startsAt:true,price:true,organiser:true,admission:true,holder:false,reference:false,notes:false};
const themeColours:Record<string,string>={aurora:'#244c62',midnight:'#191c38',sunset:'#692c4a',neon:'#2c215f',minimal:'#384660',custom:'#31275b'};
export default function TicketStudioPreview({eventId,title,venue,startsAt,priceNgn,organiser,admissionLabel,theme}:{
 eventId:string;title:string;venue:string;startsAt:string;priceNgn:number;organiser:string;admissionLabel:string;theme:string;
}){
 const [mode,setMode]=useState<PreviewMode>('both');
 const [fields,setFields]=useState<Fields>({title,venue,startsAt,price:String(priceNgn),organiser,admission:admissionLabel,holder:'',reference:'',notes:''});
 const [enabled,setEnabled]=useState<Record<FieldKey,boolean>>({...visibleByDefault});
 useEffect(()=>{
  // Reset temporary editor fields when switching events; never leak previews across organisers.
  setFields({title,venue,startsAt,price:String(priceNgn),organiser,admission:admissionLabel,holder:'',reference:'',notes:''});
  setEnabled({...visibleByDefault});setMode('both');
 },[eventId]);
 useEffect(()=>{setFields(p=>({...p,admission:admissionLabel}))},[admissionLabel]);
 const field=(key:FieldKey)=>(enabled[key]&&fields[key].trim()?fields[key].trim():null);
 const choice=(key:PreviewMode,label:string)=><Pressable key={key} accessibilityRole="button" accessibilityState={{selected:mode===key}}
  onPress={()=>setMode(key)} style={[styles.option,mode===key&&styles.selected]}><Text style={styles.text}>{label}</Text></Pressable>;
 const description='Preview only. Edited text and visibility are temporary and are not saved to issued tickets. Real signed QR codes are created only after authorised fulfilment.';
 return <View style={styles.section} accessibilityLabel="Live ticket studio preview">
  <Text style={styles.heading}>Live sample</Text>
  <Text style={styles.hint}>{description}</Text>
  <View style={styles.options}>{choice('ticket','Designed ticket')}{choice('qr','QR only')}{choice('both','Ticket + QR')}</View>
  {(mode==='ticket'||mode==='both')&&<View style={[styles.ticket,{backgroundColor:themeColours[theme]||'#31275b'}]}>
   <Text style={styles.brand}>NEXX EVENTPASS • TICKET PREVIEW</Text>
   {field('title')&&<Text style={styles.eventTitle}>{field('title')}</Text>}
   {field('venue')&&<Text style={styles.detail}>{field('venue')}</Text>}
   {field('startsAt')&&<Text style={styles.detail}>{new Date(fields.startsAt).toString()==='Invalid Date'?fields.startsAt:new Date(fields.startsAt).toLocaleString('en-NG')}</Text>}
   {field('price')&&<Text style={styles.detail}>₦{Number(fields.price).toLocaleString('en-NG')}</Text>}
   {field('organiser')&&<Text style={styles.detail}>Presented by {field('organiser')}</Text>}
   {field('admission')&&<Text style={styles.admit}>{field('admission')}</Text>}
   {field('holder')&&<Text style={styles.detail}>Holder: {field('holder')}</Text>}
   {field('reference')&&<Text style={styles.detail}>Reference: {field('reference')}</Text>}
   {field('notes')&&<Text style={styles.detail}>{field('notes')}</Text>}
   <Text style={styles.foot}>SAMPLE • NOT VALID FOR ENTRY</Text>
  </View>}
  {(mode==='qr'||mode==='both')&&<View style={styles.qrBlock} accessibilityLabel="QR preview placeholder; no admission credential">
   <Text style={styles.qrTitle}>QR preview placeholder</Text>
   <Text style={styles.qrText}>A unique signed QR will appear on each issued ticket after verified fulfilment.</Text>
   <Text style={styles.foot}>NO REUSABLE OR DEMO ADMISSION CODE</Text>
  </View>}
  <Text style={styles.heading}>Edit preview details</Text>
  <Text style={styles.hint}>Toggle fields on or off, or clear the sample text. These preview changes are not published.</Text>
  {fieldNames.map(([key,label])=><View key={key} style={styles.editRow}>
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:enabled[key]}} accessibilityLabel={'Show '+label}
    onPress={()=>setEnabled(p=>({...p,[key]:!p[key]}))} style={styles.toggle}>
    <Text style={styles.text}>{enabled[key]?'☑':'☐'} {label}</Text>
   </Pressable>
   <TextInput accessibilityLabel={'Preview '+label} placeholder={'Enter '+label.toLowerCase()} placeholderTextColor="#9aaccd"
    value={fields[key]} onChangeText={value=>setFields(p=>({...p,[key]:value}))}
    style={styles.input} multiline={key==='notes'} />
  </View>)}
 </View>;
}
const styles=StyleSheet.create({
 section:{marginVertical:12,padding:14,borderRadius:18,backgroundColor:'#16213a',borderColor:'#405277',borderWidth:1,gap:10},
 heading:{color:'#f8f9ff',fontWeight:'900',fontSize:19,marginTop:6},
 hint:{color:'#c1cde5',fontSize:12,lineHeight:18},
 options:{flexDirection:'row',flexWrap:'wrap',gap:7},
 option:{paddingHorizontal:10,paddingVertical:10,minHeight:44,justifyContent:'center',borderRadius:10,borderWidth:1,borderColor:'#536587',backgroundColor:'#23304b'},
 selected:{borderColor:'#8ff0d5',backgroundColor:'#51408e'},
 text:{color:'#f8f9ff',fontWeight:'700',fontSize:12},
 ticket:{borderWidth:2,borderColor:'#d2b777',borderRadius:14,padding:16,gap:8,minHeight:160},
 brand:{fontSize:10,color:'#a3f4dd',fontWeight:'900',letterSpacing:1},
 eventTitle:{color:'#fff',fontSize:20,fontWeight:'900'},
 detail:{color:'#f3e8ce',fontSize:13},
 admit:{color:'#fff0b8',fontWeight:'900',fontSize:14},
 foot:{color:'#d4d8e7',fontSize:10,fontWeight:'800',marginTop:8},
 qrBlock:{borderRadius:12,padding:16,backgroundColor:'#273656',borderColor:'#7488b0',borderWidth:1,minHeight:102,justifyContent:'center',gap:8},
 qrTitle:{color:'#fff',fontWeight:'900',fontSize:15},
 qrText:{color:'#d6dfef',fontSize:12,lineHeight:17},
 editRow:{gap:7,paddingVertical:5,borderBottomColor:'#324565',borderBottomWidth:1},
 toggle:{minHeight:44,justifyContent:'center'},
 input:{borderRadius:10,backgroundColor:'#101b30',color:'#fff',borderColor:'#455b81',borderWidth:1,minHeight:44,paddingHorizontal:12,paddingVertical:9,fontSize:13}
});
