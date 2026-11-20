import React from 'react';
import {Pressable,Text,View,StyleSheet,useWindowDimensions} from 'react-native';
type Section='organisers'|'accounts'|'events'|'analytics'|'finance'|'support'|'themes'|'audit'|'settings';
type Props={fullName:string;summary:Record<string,number>;pendingOrganisers:number;pendingEvents:number;pendingRefunds:number;pendingSupport:number;pendingBanks:number;recentActions:{id:string;action:string;created_at:string;performed_by:string;target_email?:string|null}[];onNavigate:(section:Section)=>void;onRefresh:()=>void;busy:boolean};
const featuredKeys=['organisers','events','tickets','admissions','orders','revenue'];
const financialMetricLabels:Record<string,string>={
 verified_collections_ngn:'Verified collections',verified_commissions_ngn:'Verified platform commissions',
 commission_outstanding_ngn:'Outstanding commission remittance',manual_offline_sales_ngn:'Manually recorded offline sales',
 refund_review_exposure_ngn:'Unresolved refund exposure'
};
function displayName(key:string){return financialMetricLabels[key]||key.replace(/_/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase())}
function formatMetric(key:string,value:number){return key.endsWith('_ngn')?'₦'+Number(value).toLocaleString('en-NG'):Number(value).toLocaleString('en-NG')}
export default function PlatformOverview({fullName,summary,pendingOrganisers,pendingEvents,pendingRefunds,pendingSupport,pendingBanks,recentActions,onNavigate,onRefresh,busy}:Props){
 const {width}=useWindowDimensions();
 const columns=width<380?2:width<780?2:3;
 const statEntries=Object.entries(summary).sort(([a],[b])=>{
  const rank=(key:string)=>{const i=featuredKeys.findIndex(fragment=>key.toLowerCase().includes(fragment));return i<0?100:i};
  return rank(a)-rank(b);
 });
 return <View style={styles.container}>
  <View style={styles.hero}>
   <View style={styles.heroAccent}/>
   <Text style={styles.overline}>NEXX EVENTPASS / COMMAND CENTRE</Text>
   <Text style={styles.heroTitle}>Platform overview</Text>
   <Text style={styles.heroText}>Welcome back, {fullName}. Review the platform at a glance and open the operation that needs attention.</Text>
   <View style={styles.heroFooter}><Text style={styles.live}>●  Database-backed metrics</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Refresh platform overview" accessibilityState={{disabled:busy}} disabled={busy} style={styles.refresh} onPress={onRefresh}><Text style={styles.refreshText}>↻ Refresh</Text></Pressable>
   </View>
  </View>
  <Text style={styles.sectionTitle}>Operations requiring attention</Text>
  <View style={styles.alerts}>
   {([['Pending organiser reviews',pendingOrganisers,'organisers'],['Events needing review',pendingEvents,'events'],['Payment exceptions',pendingRefunds,'finance'],['Support needing action',pendingSupport,'support'],['Bank verification requests',pendingBanks,'organisers']] as const).map(([title,count,target])=>
    <Pressable key={target} accessibilityRole="button" accessibilityLabel={title+', '+count+', open '+target} style={styles.alertRow} onPress={()=>onNavigate(target)}>
     <View style={styles.alertLeft}><Text style={styles.alertCount}>{count}</Text><Text style={styles.alertLabel}>{title}</Text></View>
     <Text style={styles.chevron}>›</Text>
    </Pressable>)}
  </View>
  <Text style={styles.sectionTitle}>Platform performance</Text>
  <Text style={styles.caption}>Database-backed totals. Verified collections exclude unconfirmed payments; manually recorded offline sales do not imply money received. Unresolved refund exposure is a review amount, not an authorised payout.</Text>
  {statEntries.length===0?<View style={styles.empty}><Text style={styles.caption}>Platform metrics are unavailable. Use Refresh to try again.</Text></View>:
   <View style={styles.stats}>{statEntries.map(([key,value])=><View key={key} style={[styles.metric,{width:`${100/columns-2}%`}]}>
    <Text style={styles.metricLabel}>{displayName(key)}</Text>
    <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{formatMetric(key,value)}</Text>
    <View style={styles.metricAccent}/>
   </View>)}</View>}
  <View style={styles.recentHead}>
   <Text style={styles.sectionTitle}>Recent administrator activity</Text>
   <Pressable accessibilityRole="button" accessibilityLabel="Open full administrator audit log" onPress={()=>onNavigate('audit')} style={styles.auditButton}><Text style={styles.auditText}>Open audit log ›</Text></Pressable>
  </View>
  {recentActions.length===0?<Text style={styles.caption}>No administrator actions have been recorded yet.</Text>:
   recentActions.slice(0,5).map(item=><View style={styles.recentRow} key={item.id}>
    <View style={styles.activityDot}/><View style={{flex:1}}>
     <Text style={styles.activityName}>{item.action.replaceAll('_',' ')}</Text>
     <Text style={styles.caption}>{item.target_email||'Platform operation'} · {item.performed_by}</Text>
     <Text style={styles.activityDate}>{new Date(item.created_at).toLocaleString('en-NG')}</Text>
    </View>
   </View>)}
 </View>
}
const styles=StyleSheet.create({
 container:{gap:12,paddingBottom:10},hero:{backgroundColor:'#211c45',padding:22,borderRadius:22,overflow:'hidden',borderColor:'#5e5796',borderWidth:1,gap:9,marginBottom:10},
 heroAccent:{height:3,position:'absolute',left:0,right:0,top:0,backgroundColor:'#d5b77e'},overline:{fontSize:10,letterSpacing:1.4,fontWeight:'900',color:'#d8c5ff'},
 heroTitle:{fontSize:29,color:'#fff',fontWeight:'900',letterSpacing:-.7},heroText:{color:'#cbd5eb',fontSize:14,lineHeight:21},
 heroFooter:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:8},
 live:{color:'#8ee5ce',fontSize:12,fontWeight:'700'},refresh:{minHeight:44,minWidth:100,justifyContent:'center',alignItems:'center',paddingHorizontal:13,borderRadius:12,borderColor:'#9b87de',borderWidth:1,backgroundColor:'#443774'},refreshText:{color:'#fff',fontWeight:'800'},
 sectionTitle:{color:'#faf9ff',fontSize:19,fontWeight:'900',marginTop:10,letterSpacing:-.3},
 alerts:{backgroundColor:'#152039',borderWidth:1,borderColor:'#344762',borderRadius:17,paddingHorizontal:14},
 alertRow:{minHeight:62,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomColor:'#35425c',borderBottomWidth:1,paddingVertical:7},
 alertLeft:{flexDirection:'row',alignItems:'center',gap:12,flex:1},alertCount:{fontSize:19,fontWeight:'900',minWidth:32,textAlign:'center',color:'#f2d39c'},
 alertLabel:{fontSize:13,color:'#e4e9f5',fontWeight:'700',flexShrink:1},chevron:{fontSize:25,color:'#b6a9e9'},
 caption:{color:'#b6c6e1',fontSize:12,lineHeight:18},empty:{padding:16,backgroundColor:'#152039',borderRadius:14},
 stats:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:9},
 metric:{backgroundColor:'#1b2946',borderWidth:1,borderColor:'#405475',borderRadius:16,padding:13,minHeight:112,justifyContent:'space-between',gap:7},
 metricLabel:{color:'#c6d2e5',fontSize:11,fontWeight:'700'},metricValue:{color:'#fff',fontSize:24,fontWeight:'900'},
 metricAccent:{backgroundColor:'#b6a0ee',width:34,height:3,borderRadius:3},
 recentHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:10},
 auditButton:{minHeight:44,justifyContent:'center',paddingHorizontal:12,borderRadius:12,borderColor:'#667db4',borderWidth:1,backgroundColor:'#253457'},
 auditText:{color:'#dcf1eb',fontWeight:'800',fontSize:12},
 recentRow:{flexDirection:'row',gap:12,alignItems:'flex-start',padding:14,borderColor:'#3d4e71',borderWidth:1,borderRadius:14,backgroundColor:'#182541'},
 activityDot:{width:9,height:9,marginTop:6,borderRadius:6,backgroundColor:'#d8bf84'},
 activityName:{color:'#fff',fontWeight:'800',fontSize:13,textTransform:'capitalize'},
 activityDate:{color:'#9caece',fontSize:11,marginTop:4}
});
