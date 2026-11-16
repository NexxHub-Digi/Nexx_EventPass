import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';

export type OAuthPortal = 'user' | 'organiser' | 'gate' | 'platform_admin';
export const portals: OAuthPortal[] = ['user', 'organiser', 'gate', 'platform_admin'];
export const isPortal = (v: string): v is OAuthPortal => portals.includes(v as OAuthPortal);
const envPrefixes: Record<OAuthPortal,string> = {
  user:'GOOGLE_USER', organiser:'GOOGLE_ORGANISER', gate:'GOOGLE_GATE', platform_admin:'GOOGLE_PLATFORM'
};
export function oauthCredentials(portal: OAuthPortal) {
  const prefix=envPrefixes[portal];
  const clientId=process.env[prefix+'_CLIENT_ID'] || (portal==='user'?process.env.GOOGLE_GUEST_CLIENT_ID:undefined) || process.env.GOOGLE_CLIENT_ID;
  const clientSecret=process.env[prefix+'_CLIENT_SECRET'] || (portal==='user'?process.env.GOOGLE_GUEST_CLIENT_SECRET:undefined) || process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? {clientId,clientSecret} : null;
}
export function callbackUrl(origin: string) {
  const base=process.env.NEXT_PUBLIC_SITE_URL || origin;
  return new URL('/api/auth/google/callback',base.endsWith('/')?base:base+'/').toString();
}
export const randomValue=()=>randomBytes(32).toString('base64url');
export const challenge=(value:string)=>createHash('sha256').update(value).digest('base64url');
function stateKey() {
  const key=process.env.AUTH_SECRET;
  if(!key || key.length<32) throw new Error('AUTH_SECRET is not configured');
  return new TextEncoder().encode(key);
}
export type GoogleState={portal:OAuthPortal;intent:'signin'|'link';state:string;nonce:string;verifier:string;subject?:string;returnTo?:string};
export async function sealState(s:GoogleState){
 return new SignJWT({...s}).setProtectedHeader({alg:'HS256'}).setIssuer('nexx-eventpass')
 .setAudience('google-login-state').setIssuedAt().setExpirationTime('10m').sign(stateKey());
}
export async function readState(token:string):Promise<GoogleState>{
 const {payload}=await jwtVerify(token,stateKey(),{issuer:'nexx-eventpass',audience:'google-login-state'});
 if(!isPortal(String(payload.portal)) || !['signin','link'].includes(String(payload.intent)) || 
    typeof payload.state!=='string'||typeof payload.nonce!=='string'||typeof payload.verifier!=='string')
   throw new Error('Invalid Google login state');
 return payload as unknown as GoogleState;
}
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyGoogleIdToken(idToken:string, clientId:string,nonce:string){
 const {payload}=await jwtVerify(idToken,jwks,{issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId});
 if(payload.nonce!==nonce || payload.email_verified!==true || !payload.sub || typeof payload.email!=='string')
  throw new Error('Google email or nonce verification failed');
 return {subject:payload.sub,email:payload.email.toLowerCase(),name:typeof payload.name==='string'?payload.name:payload.email};
}
export function portalDestination(p:OAuthPortal){
 return p==='organiser'?'manage':p==='gate'?'scan':p==='platform_admin'?'platform':'explore';
}
