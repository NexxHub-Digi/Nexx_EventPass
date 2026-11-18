import {redirect} from 'next/navigation';
import RoleWorkspace from '@/components/RoleWorkspace';
export default async function Page({params}:{params:Promise<{role:string}>}){
 const {role}=await params;
 if(role==='organiser')redirect('/organiser');
 if(role==='gate')redirect('/gate');
 if(role==='platform-admin')redirect('/platform-admin');
 return <RoleWorkspace/>;
}
