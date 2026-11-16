import { NextResponse } from 'next/server';
import { oauthCredentials, portals } from '@/lib/google-oauth';
export const runtime='nodejs';
export function GET(){
 return NextResponse.json({roles:Object.fromEntries(portals.map(p=>[p,Boolean(oauthCredentials(p))]))},{headers:{'Cache-Control':'no-store'}});
}
