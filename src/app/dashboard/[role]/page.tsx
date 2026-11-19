import {redirect} from 'next/navigation';
import {portalHome} from '@/lib/portal-home';

export default async function Page({params}:{params:Promise<{role:string}>}){
 const {role}=await params;
 if(Object.prototype.hasOwnProperty.call(portalHome,role))redirect(portalHome[role as keyof typeof portalHome]);
 redirect('/login/user');
}
