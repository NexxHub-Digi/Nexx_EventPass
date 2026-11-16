/** Legacy Expo entry retained to prevent accidental use of outdated registration and gate workflows.
 * Install one of the four independent role apps under apps/user, apps/organiser, apps/gate, or apps/platform-admin instead.
 */
import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
export default function LegacyApp(){
 return <View style={styles.root}><Text style={styles.brand}>◈ NEXX EVENTPASS</Text>
  <Text style={styles.title}>Choose your dedicated application</Text>
  <Text style={styles.body}>This old combined application is retired. Use the User, Event Organiser, Gate Operator, or Platform Admin Expo project. Sign-in and new registrations are Google-only.</Text>
 </View>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#0b1020',justifyContent:'center',padding:30},brand:{fontSize:20,fontWeight:'900',color:'#4ce4c6',marginBottom:30},title:{fontSize:27,fontWeight:'800',color:'white',marginBottom:15},body:{fontSize:16,color:'#bdc6d9',lineHeight:25}});
