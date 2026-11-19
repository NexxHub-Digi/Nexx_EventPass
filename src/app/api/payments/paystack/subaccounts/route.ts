import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {paystackApi,paystackTestEnabled} from '@/lib/paystack';
import {fail,handleError,ok,payload,str} from '@/lib/http';
import {categoryIdPattern as uuid} from '@/lib/event-inventory';
export const runtime='nodejs';
export async function GET(){
 try{
  const user=await currentUser();
  if(!user||user.account_status!=='active'||!['organiser','platform_admin'].includes(user.role))
   return fail('Organiser or Platform Admin required',403);
  const accounts=await db()`select p.organiser_id,p.subaccount_code,p.provider_account_name,p.provider_account_number,
   p.verified_at,a.full_name as organiser_name from paystack_organiser_accounts p
   join app_users a on a.id=p.organiser_id where ${user.role==='platform_admin'} or p.organiser_id=${user.id}
   order by p.verified_at desc limit 100`;
  return ok({accounts,configured:paystackTestEnabled(),mode:'test'});
 }catch(error){return handleError(error)}
}
export async function POST(req:Request){
 try{
  const admin=await currentUser();
  if(!admin||admin.role!=='platform_admin'||admin.account_status!=='active')return fail('Platform Admin only',403);
  if(!paystackTestEnabled())return fail('Paystack test mode is not configured',503);
  const body=await payload(req),organiserId=str(body.organiserId,40),code=str(body.subaccountCode,100);
  const note=str(body.verificationNote,500);
  if(!uuid.test(organiserId)||!/^ACCT_[A-Za-z0-9]+$/.test(code)||note.length<12||body.ownershipConfirmed!==true)
   return fail('Confirm the verified organiser, subaccount and settlement-account ownership',400);
  // Fetch from Paystack with the platform's secret. Never trust a client-supplied settlement account.
  const provider=await paystackApi<{subaccount_code:string;domain:string;active:boolean;
   account_number:string;account_name:string;currency:string}>('/subaccount/'+encodeURIComponent(code));
  if(provider.subaccount_code!==code||provider.domain!=='test'||provider.currency!=='NGN'||!provider.active||
    !/^[0-9]{10,12}$/.test(String(provider.account_number)))
    return fail('The Paystack subaccount is not an active NGN test account',409);
  const result=await db().begin(async tx=>{
   const [organiser]=await tx`select id from app_users where id=${organiserId} and role='organiser'
     and account_status='active' for update`;
   if(!organiser)return {error:'Active organiser required',status:409};
   const [bank]=await tx`select id from organiser_bank_accounts where organiser_id=${organiserId}
    and status='verified' and account_number=${String(provider.account_number)} limit 1`;
   if(!bank)return {error:'The Paystack settlement account must match an independently verified organiser bank account',status:409};
   const [account]=await tx`insert into paystack_organiser_accounts
    (organiser_id,subaccount_code,provider_account_name,provider_account_number,verified_by,verification_note)
    values(${organiserId},${code},${String(provider.account_name||'')},${String(provider.account_number)},${admin.id},${note})
    on conflict(organiser_id) do update set subaccount_code=excluded.subaccount_code,
     provider_account_name=excluded.provider_account_name,provider_account_number=excluded.provider_account_number,
     verified_by=excluded.verified_by,verified_at=now(),verification_note=excluded.verification_note
    returning organiser_id,subaccount_code,verified_at`;
   await tx`insert into platform_admin_actions(admin_id,action,details)
    values(${admin.id},'verify_paystack_subaccount',${JSON.stringify({organiserId,subaccountCode:code,note})}::jsonb)`;
   return {account};
  });
  return 'error' in result?fail(String(result.error),Number(result.status)):ok(result,201);
 }catch(error){return handleError(error)}
}
