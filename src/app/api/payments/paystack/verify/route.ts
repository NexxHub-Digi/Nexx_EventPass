import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {reconcilePaystackReference} from '@/lib/paystack-fulfilment';
import {fail,handleError,ok} from '@/lib/http';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const user=await currentUser();if(!user||user.account_status!=='active')return fail('Sign in required',401);
  const reference=new URL(req.url).searchParams.get('reference')||'';
  if(!/^EP-[a-f0-9-]{36}$/i.test(reference))return fail('Invalid reference',400);
  const [payment]=await db()`select buyer_id from paystack_payments where reference=${reference}`;
  if(!payment||payment.buyer_id!==user.id)return fail('Payment not found',404);
  return ok({reference,...await reconcilePaystackReference(reference),mode:'test'});
 }catch(error){return handleError(error)}
}
