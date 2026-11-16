import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {
 metadataBase:new URL('https://nexx-eventpass.vercel.app'),
 title:{default:'Nexx EventPass',template:'%s | Nexx EventPass'},
 description:'Create events, manually verify ticket payments and manage secure, single-use QR admission.',
 applicationName:'Nexx EventPass',
 icons:{icon:'/brand/eventpass-mark.svg'},
 openGraph:{type:'website',siteName:'Nexx EventPass',title:'Nexx EventPass — Events Made Simple. Entry Made Secure.',description:'Event ticketing and secure entry verification.'},
 twitter:{card:'summary_large_image',title:'Nexx EventPass',description:'Events Made Simple. Entry Made Secure.'}
};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
