import React from 'react';
import {Pressable,ScrollView,Text,View,StyleSheet} from 'react-native';

export type OrganiserPage='dashboard'|'events'|'tickets'|'payments'|'team'|'profile';
type Props={active:OrganiserPage;onSelect:(tab:OrganiserPage)=>void;onClose:()=>void;name:string;pendingPayments:number;eventCount:number;drawer?:boolean};
const nav:[OrganiserPage,string,string][]=[
 ['dashboard','Dashboard','▦'],['events','My events','◇'],['tickets','Ticket Studio','✧'],
 ['payments','Payments & finance','₦'],['team','Gate team','♙'],['profile','My profile','◉']
];
export default function OrganiserSidebar({active,onSelect,onClose,name,pendingPayments,eventCount,drawer=false}:Props){
 return <View style={styles.root} accessibilityLabel="Organiser workspace menu">
  <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>◈</Text></View>
   <View style={{flex:1}}><Text style={styles.brandName}>NEXX EVENTPASS</Text><Text style={styles.brandRole}>Organiser workspace</Text></View>
   {drawer&&<Pressable accessibilityRole="button" accessibilityLabel="Close organiser menu" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>}
  </View>
  <ScrollView style={{flex:1}} contentContainerStyle={styles.menu} keyboardShouldPersistTaps="handled">
   <Text style={styles.caption}>WORKSPACE</Text>
   {nav.map(([tab,label,glyph])=><Pressable key={tab} accessibilityRole="button" accessibilityLabel={'Open '+label} accessibilityState={{selected:active===tab}}
    style={({pressed})=>[styles.item,active===tab&&styles.selected,pressed&&{opacity:.8}]} onPress={()=>onSelect(tab)}>
    <Text style={[styles.glyph,active===tab&&{color:'#f1d28a'}]}>{glyph}</Text>
    <Text style={[styles.label,active===tab&&{color:'#fff'}]}>{label}</Text>
    {tab==='payments'&&pendingPayments>0&&<View style={styles.count}><Text style={styles.countText}>{pendingPayments>99?'99+':pendingPayments}</Text></View>}
    {tab==='events'&&eventCount>0&&<Text style={styles.mutedCount}>{eventCount}</Text>}
   </Pressable>)}
  </ScrollView>
  <View style={styles.footer}><View style={styles.online}/><View style={{flex:1}}><Text style={styles.footerLabel}>Organiser account</Text><Text style={styles.footerName} numberOfLines={1}>{name}</Text></View></View>
 </View>
}
const styles=StyleSheet.create({
 root:{width:'100%',flex:1,backgroundColor:'#111a30',borderRightColor:'#384866',borderRightWidth:1},
 brand:{paddingHorizontal:16,paddingVertical:23,flexDirection:'row',alignItems:'center',gap:10,borderBottomColor:'#34415c',borderBottomWidth:1},
 logo:{width:40,height:40,borderRadius:12,backgroundColor:'#41346f',justifyContent:'center',alignItems:'center'},
 logoText:{color:'#eac985',fontSize:23},brandName:{color:'#fff',fontSize:12,fontWeight:'900',letterSpacing:1},
 brandRole:{color:'#b6c4dc',fontSize:11,marginTop:4},
 close:{width:42,height:42,borderWidth:1,borderColor:'#596585',borderRadius:12,justifyContent:'center',alignItems:'center'},
 closeText:{color:'#fff',fontSize:24},menu:{padding:14,gap:7},
 caption:{fontSize:10,color:'#a9b9d4',fontWeight:'900',letterSpacing:1.3,paddingHorizontal:10,marginBottom:8},
 item:{minHeight:48,flexDirection:'row',alignItems:'center',gap:11,borderRadius:12,paddingHorizontal:12,borderWidth:1,borderColor:'transparent'},
 selected:{backgroundColor:'#35295c',borderColor:'#927bbd',borderLeftWidth:3,borderLeftColor:'#eac985'},
 glyph:{minWidth:24,fontSize:20,color:'#aabbd6',textAlign:'center'},
 label:{color:'#c5d2e8',fontSize:13,fontWeight:'800',flex:1},
 count:{backgroundColor:'#ecd18b',borderRadius:18,minWidth:24,paddingHorizontal:5,paddingVertical:3,alignItems:'center'},
 countText:{fontSize:10,fontWeight:'900',color:'#25203c'},mutedCount:{color:'#a8b8d7',fontSize:11,fontWeight:'800'},
 footer:{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderTopWidth:1,borderColor:'#354460'},
 online:{width:9,height:9,borderRadius:5,backgroundColor:'#7ce8c7'},
 footerLabel:{color:'#e1eafb',fontSize:11,fontWeight:'800'},footerName:{color:'#a9b8d1',fontSize:11,marginTop:3}
});
