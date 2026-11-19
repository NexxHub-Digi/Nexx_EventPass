import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
import {categoryIdPattern as uuid} from '@/lib/event-inventory';

export const runtime='nodejs';

export async function GET(){
 try{
  const user=await currentUser();
  if(!user||user.account_status!=='active'||!['organiser','platform_admin'].includes(user.role))return fail('Organiser or Platform Admin required',403);
  const admin=user.role==='platform_admin';
  const accounts=await db()`select a.id,a.organiser_id,a.bank_name,a.account_name,a.account_number,a.status,
    a.created_at,a.reviewed_at,a.review_note,u.full_name as organiser_name
   from organiser_bank_accounts a join app_users u on u.id=a.organiser_id
   where ${admin} or a.organiser_id=${user.id}
   order by (a.status='pending') desc,a.created_at desc`;
  return ok({accounts});
 }catch(error){return handleError(error)}
}

export async function POST(req:Request){
 try{
  const user=await currentUser();
  if(!user||user.role!=='organiser'||user.account_status!=='active')return fail('Active organiser required',403);
  const body=await payload(req);
  const bankName=str(body.bankName,120),accountName=str(body.accountName,140),accountNumber=str(body.accountNumber,20);
  if(!bankName||!accountName||!/^[0-9]{10,12}$/.test(accountNumber))return fail('Valid bank, account name and account number required');
  const [account]=await db()`insert into organiser_bank_accounts(organiser_id,bank_name,account_name,account_number)
    values(${user.id},${bankName},${accountName},${accountNumber}) on conflict do nothing
    returning id,bank_name,account_name,account_number,status`;
  return account?ok({account},201):fail('This account has already been submitted or verified',409);
 }catch(error){return handleError(error)}
}

export async function PATCH(req:Request){
 try{
  const user=await currentUser();
  if(!user||user.role!=='platform_admin'||user.account_status!=='active')return fail('Platform Admin required',403);
  const body=await payload(req);
  const id=str(body.accountId,40),decision=str(body.decision,20),note=str(body.note,500);
  if(!uuid.test(id)||!['verified','rejected'].includes(decision)||decision==='rejected'&&!note)return fail('Choose a valid decision and enter a reason if rejecting');
  return await db().begin(async tx=>{
   const [account]=await tx`update organiser_bank_accounts
     set status=${decision},reviewed_by=${user.id},reviewed_at=now(),review_note=${note}
     where id=${id} and status='pending' returning id,organiser_id,status`;
   if(!account)return fail('Account has already been reviewed or does not exist',409);
   await tx`insert into platform_admin_actions(admin_id,action,details)
     values(${user.id},'bank_account_review',${JSON.stringify({accountId:id,organiserId:account.organiser_id,decision,note})}::jsonb)`;
   return ok({account});
  });
 }catch(error){return handleError(error)}
}
