import {createHmac,timingSafeEqual} from 'node:crypto';

const apiOrigin='https://api.paystack.co';
export function paystackTestEnabled():boolean {
 return /^sk_test_[A-Za-z0-9_]+$/.test(process.env.PAYSTACK_SECRET_KEY||'');
}
export function paystackKey():string {
 const key=process.env.PAYSTACK_SECRET_KEY||'';
 if(!paystackTestEnabled())throw Error('Paystack test mode is not configured. Live charges are disabled.');
 return key;
}
export function commissionKobo(grossNgn:number,basisPoints:number):number {
 if(!Number.isSafeInteger(grossNgn)||grossNgn<=0||!Number.isInteger(basisPoints)||basisPoints<0||basisPoints>10000)
  throw Error('Invalid Paystack commission');
 // Keep the ledger in whole NGN, exactly matching verified_order_payments.commission_ngn.
 return Math.round(grossNgn*basisPoints/10000)*100;
}
export async function paystackApi<T>(path:string,method='GET',body?:unknown):Promise<T>{
 if(!/^\/(?:transaction\/(?:initialize|verify\/[A-Za-z0-9.=_-]+)|subaccount\/[A-Za-z0-9_]+|refund(?:\/[A-Za-z0-9_-]+)?)$/.test(path))
  throw Error('Unsupported Paystack API operation');
 const response=await fetch(apiOrigin+path,{method,headers:{
  Authorization:'Bearer '+paystackKey(),'Content-Type':'application/json'
 },body:body===undefined?undefined:JSON.stringify(body),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 const result=await response.json() as {status?:boolean;data?:T};
 if(!response.ok||result?.status!==true||!result.data)throw Error('Paystack provider request failed');
 return result.data;
}
export function validPaystackWebhook(raw:Buffer,modern:string|null,legacy:string|null):boolean {
 if(raw.length===0||raw.length>1000000)return false;
 if(modern){
  const secret=process.env.PAYSTACK_WEBHOOK_SECRET||'';
  const parts=modern.split(',').map(part=>part.trim());
  const stampText=parts.find(part=>part.startsWith('t='))?.slice(2)||'';
  const stamp=Number(stampText);
  if(!secret.startsWith('whsec_')||!/^\d{9,12}$/.test(stampText)||
     !Number.isSafeInteger(stamp)||Math.abs(Date.now()/1000-stamp)>300)return false;
  const signature=createHmac('sha512',secret).update(String(stamp)+'.').update(raw).digest();
  return parts.some(part=>{
   const match=part.match(/^v1=whk_[A-Za-z0-9_-]+:([0-9a-f]{128})$/);
   return Boolean(match&&timingSafeEqual(signature,Buffer.from(match[1],'hex')));
  });
 }
 if(!legacy||!/^[0-9a-f]{128}$/.test(legacy)||!paystackTestEnabled())return false;
 const expected=createHmac('sha512',paystackKey()).update(raw).digest();
 return timingSafeEqual(expected,Buffer.from(legacy,'hex'));
}
export type VerifiedPaystackCharge={
 reference:string;status:string;amount:number;currency:string;domain:string;
 id:string|number;paid_at?:string|null;metadata?:unknown;
};
export function validPaystackCharge(charge:VerifiedPaystackCharge,reference:string,amountKobo:number){
 return charge.reference===reference&&charge.status==='success'&&charge.domain==='test'&&
  charge.currency==='NGN'&&typeof charge.amount==='number'&&charge.amount===amountKobo&&Number.isSafeInteger(charge.amount)&&charge.amount>0&&
  (typeof charge.id==='string'||(typeof charge.id==='number'&&Number.isSafeInteger(charge.id)))&&/^[1-9][0-9]{0,19}$/.test(String(charge.id));
}

/** Terminal or supervised refund states must never be overwritten by a late charge replay. */
export function isPaystackRefundState(status:string):status is 'refund_pending'|'refunded'|'refund_failed' {
 return ['refund_pending','refunded','refund_failed'].includes(status);
}
