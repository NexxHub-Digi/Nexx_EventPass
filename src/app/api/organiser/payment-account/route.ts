import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
 try{const u=await currentUser();if(!u||u.account_status!=='active'||!['organiser','platform_admin'].includes(u.role))return fail('Active organiser required',403);
  const rows=await db()`select bank_name,account_name,account_number,updated_at from organiser_payment_accounts where organiser_id=${u.id}`;
  return ok({account:rows[0]||null});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{const u=await currentUser();if(!u||u.role!=='organiser'||u.account_status!=='active')return fail('Active organiser required',403);
  const b=await payload(req),bankName=str(b.bankName,120),accountName=str(b.accountName,140),accountNumber=str(b.accountNumber,20);
  if(!bankName||!accountName||!/^[0-9]{10,12}$/.test(accountNumber))return fail('Valid bank, account name and number required',400);
  await db()`insert into organiser_payment_accounts(organiser_id,bank_name,account_name,account_number)
  values(${u.id},${bankName},${accountName},${accountNumber}) on conflict(organiser_id)
  do update set bank_name=excluded.bank_name,account_name=excluded.account_name,account_number=excluded.account_number,updated_at=now()`;
  return ok({success:true});
 }catch(e){return handleError(e)}
}
