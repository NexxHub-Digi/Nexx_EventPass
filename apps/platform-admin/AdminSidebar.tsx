import React from 'react';
import {Pressable,ScrollView,Text,View,StyleSheet} from 'react-native';

export type AdminPage='overview'|'organisers'|'accounts'|'events'|'analytics'|'finance'|'support'|'themes'|'audit'|'settings';
type Props={
 active:AdminPage;onNavigate:(page:AdminPage)=>void;onClose:()=>void;
 operatorName:string;pendingSupport:number;pendingOrganisers:number;pendingRefunds:number;isDrawer?:boolean;
};
const groups:{title:string;items:[AdminPage,string,string][]}[]=[
 {title:'DASHBOARD',items:[['overview','Overview','▦']]},
 {title:'PEOPLE',items:[['organisers','Organisers','◉'],['accounts','Users & access','♙']]},
 {title:'OPERATIONS',items:[['events','Event moderation','◇'],['analytics','Events & analytics','▥'],['finance','Payments & refunds','₦'],['support','Support','♧']]},
 {title:'CONFIGURATION',items:[['themes','Ticket themes','✧'],['audit','Audit logs','≡'],['settings','Settings','⚙']]}
];
export default function AdminSidebar({active,onNavigate,onClose,operatorName,pendingSupport,pendingOrganisers,pendingRefunds,isDrawer=false}:Props){
 const badgeCounts:Partial<Record<AdminPage,number>>={organisers:pendingOrganisers,finance:pendingRefunds,support:pendingSupport};
 return <View style={[styles.shell,isDrawer&&styles.drawer]} accessibilityLabel="Platform Administrator navigation">
  <View style={styles.brand}>
   <View style={styles.logo}><Text style={styles.logoSymbol}>◈</Text></View>
   <View style={{flex:1}}><Text style={styles.brandName}>NEXX EVENTPASS</Text><Text style={styles.brandSub}>Platform Administrator</Text></View>
   {isDrawer&&<Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>}
  </View>
  <ScrollView style={{flex:1}} contentContainerStyle={styles.menu} keyboardShouldPersistTaps="handled">
   {groups.map(group=><View key={group.title} style={styles.group}>
    <Text style={styles.groupTitle}>{group.title}</Text>
    {group.items.map(([key,label,glyph])=>{
     const selected=active===key,count=badgeCounts[key]||0;
     return <Pressable key={key} accessibilityRole="button" accessibilityLabel={'Open '+label} accessibilityState={{selected}} onPress={()=>onNavigate(key)}
      style={({pressed})=>[styles.item,selected&&styles.selected,pressed&&styles.pressed]}>
      <Text style={[styles.icon,selected&&styles.iconSelected]}>{glyph}</Text>
      <Text style={[styles.itemLabel,selected&&styles.labelSelected]} numberOfLines={1}>{label}</Text>
      {count>0&&<View style={styles.counter}><Text style={styles.counterText}>{count>99?'99+':String(count)}</Text></View>}
     </Pressable>;
    })}
   </View>)}
  </ScrollView>
  <View style={styles.footer}><View style={styles.online}/><View style={{flex:1}}><Text style={styles.footerTitle}>Authenticated workspace</Text><Text style={styles.footerName} numberOfLines={1}>{operatorName}</Text></View></View>
 </View>;
}
const styles=StyleSheet.create({
 shell:{width:258,flexShrink:0,height:'100%',backgroundColor:'#111a30',borderRightWidth:1,borderRightColor:'#3d4c6e'},
 drawer:{width:'100%',borderRightWidth:0,borderTopRightRadius:22,borderBottomRightRadius:22,overflow:'hidden'},
 brand:{paddingHorizontal:17,paddingTop:24,paddingBottom:18,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderColor:'#334361'},
 logo:{width:40,height:40,borderRadius:11,backgroundColor:'#48327d',alignItems:'center',justifyContent:'center'},
 logoSymbol:{color:'#f1d08e',fontSize:24},brandName:{color:'#fff',fontWeight:'900',fontSize:12,letterSpacing:1},
 brandSub:{color:'#aebfdb',fontSize:11,marginTop:4},
 close:{height:44,width:44,alignItems:'center',justifyContent:'center',borderRadius:12,borderWidth:1,borderColor:'#4e6082'},
 closeText:{color:'#fff',fontSize:25},
 menu:{padding:13,paddingBottom:30,gap:18},group:{gap:5},groupTitle:{fontSize:10,color:'#a8b7d2',fontWeight:'800',letterSpacing:1.2,paddingHorizontal:12,paddingTop:8,paddingBottom:6},
 item:{minHeight:48,borderRadius:12,flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:12,borderWidth:1,borderColor:'transparent'},
 selected:{backgroundColor:'#35285c',borderColor:'#846bad',borderLeftColor:'#f1d08e',borderLeftWidth:3},
 pressed:{opacity:.78},icon:{minWidth:23,textAlign:'center',fontSize:20,color:'#c2c9e6'},
 iconSelected:{color:'#edcc87'},itemLabel:{flex:1,color:'#c7d4eb',fontSize:13,fontWeight:'700'},
 labelSelected:{color:'#fff',fontWeight:'900'},counter:{backgroundColor:'#edd193',paddingHorizontal:7,paddingVertical:4,borderRadius:99},
 counterText:{color:'#2a2440',fontSize:10,fontWeight:'900'},
 footer:{minHeight:72,flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:1,borderColor:'#3c4b6a',paddingHorizontal:17},
 online:{width:9,height:9,borderRadius:5,backgroundColor:'#78e3c5'},
 footerTitle:{color:'#d7e2f2',fontSize:11,fontWeight:'800'},footerName:{color:'#a8b9d5',fontSize:11,marginTop:4}
});
