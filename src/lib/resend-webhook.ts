import {createHmac,timingSafeEqual} from 'node:crypto';
export const emailEventTypes=['email.sent','email.delivered','email.delivery_delayed','email.bounced','email.failed','email.complained','email.suppressed'] as const;
export type EmailEventType=typeof emailEventTypes[number];
export function verifyResendEvent(raw:Uint8Array,headers:Headers,secret:string,now=Date.now()){
 const id=headers.get('svix-id')||'',timestamp=headers.get('svix-timestamp')||'',signature=headers.get('svix-signature')||'';
 if(!/^msg_[A-Za-z0-9_-]{1,180}$/.test(id)||!/^\d{1,12}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!secret.startsWith('whsec_'))return null;
 const key=Buffer.from(secret.slice(6),'base64');
 if(key.length<16||signature.length>4096)return null;
 const expected=createHmac('sha256',key).update(id+'.'+timestamp+'.').update(raw).digest();
 const valid=signature.split(/\s+/).some(s=>{
  if(!s.startsWith('v1,'))return false;
  const actual=Buffer.from(s.slice(3),'base64');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
 });
 if(!valid)return null;
 let event:unknown;try{event=JSON.parse(Buffer.from(raw).toString('utf8'))}catch{return null}
 if(!event||typeof event!=='object')return null;
 const data=event as {type?:unknown;created_at?:unknown;data?:{email_id?:unknown}};
 if(typeof data.type!=='string')return null;
 if(!(emailEventTypes as readonly string[]).includes(data.type))return {ignored:true as const};
 if(typeof data.data?.email_id!=='string'||!/^[-a-z0-9]{1,100}$/i.test(data.data.email_id)||typeof data.created_at!=='string')return null;
 const date=new Date(data.created_at);if(!Number.isFinite(date.getTime())||date.getTime()>now+300000)return null;
 return {ignored:false as const,id,providerId:data.data.email_id,type:data.type as EmailEventType,occurredAt:date.toISOString()};
}
