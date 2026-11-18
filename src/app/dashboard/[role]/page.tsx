import {redirect} from 'next/navigation';
export default async function Page({params}:{params:Promise<{role:string}>}){
 const {role}=await params;
 if(role==='user')redirect('/');
 if(role==='organiser')redirect('/organiser');
 if(role==='gate')redirect('/gate');
 if(role==='platform-admin')redirect('/platform-admin');
 redirect('/login/user');
}
