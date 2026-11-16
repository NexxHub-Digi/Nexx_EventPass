import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/security';
import { callbackUrl, challenge, isPortal, oauthCredentials, randomValue, sealState } from '@/lib/google-oauth';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
 const portal=req.nextUrl.searchParams.get('portal')||'guest';
 const intent=req.nextUrl.searchParams.get('intent')==='link'?'link':'signin';
 if(!isPortal(portal)) return NextResponse.json({error:'Invalid portal'},{status:400});
 const config=oauthCredentials(portal);
 if(!config) return NextResponse.json({error:'Google sign-in is not configured for this interface'},{status:503});
 const user=intent==='link'?await currentUser():null;
 if(intent==='link'&&!user) return NextResponse.json({error:'Sign in with your existing account first'},{status:401});
 const state=randomValue(),nonce=randomValue(),verifier=randomValue();
 const token=await sealState({portal,intent,state,nonce,verifier,...(user?{subject:user.id}:{})});
 const uri=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 uri.searchParams.set('client_id',config.clientId);
 uri.searchParams.set('redirect_uri',callbackUrl(req.nextUrl.origin));
 uri.searchParams.set('response_type','code');
 uri.searchParams.set('scope','openid email profile');
 uri.searchParams.set('state',state);
 uri.searchParams.set('nonce',nonce);
 uri.searchParams.set('code_challenge',challenge(verifier));
 uri.searchParams.set('code_challenge_method','S256');
 uri.searchParams.set('prompt','select_account');
 const res=NextResponse.redirect(uri);
 res.cookies.set('eventpass_google_state',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600});
 return res;
}
