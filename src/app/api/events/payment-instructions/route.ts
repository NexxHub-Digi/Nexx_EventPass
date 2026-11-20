import { db } from '@/lib/db';
import { categoryIdPattern as uuid } from '@/lib/event-inventory';
import { fail, handleError, ok } from '@/lib/http';

export const runtime='nodejs';

export async function GET(req:Request){
 try{
  const eventId=new URL(req.url).searchParams.get('eventId')||'';
  if(!uuid.test(eventId))return fail('Invalid event');
  const [event]=await db()`select e.price_ngn,e.onsite_payments_enabled,a.id as payment_account_id,
    a.bank_name,a.account_name as bank_account_name,a.account_number as bank_account_number
   from events e join app_users u on u.id=e.organiser_id
   left join organiser_bank_accounts a on a.id=e.payment_account_id and a.organiser_id=e.organiser_id and a.status='verified'
   where e.id=${eventId} and e.status='published' and e.verification_status='verified'
    and e.visibility='public' and u.role='organiser' and u.account_status='active'
    and (e.starts_at>now() or (e.onsite_payments_enabled and e.starts_at>=now()-interval '4 hours'))`;
  if(!event)return fail('This event is no longer accepting reservations',404);
  if(Number(event.price_ngn)>0&&!event.payment_account_id)return fail('Bank account verification is pending. Please check back before paying.',409);
  return ok({payment:event});
 }catch(error){return handleError(error)}
}
