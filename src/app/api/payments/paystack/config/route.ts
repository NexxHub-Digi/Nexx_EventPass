import {db} from '@/lib/db';
import {paystackTestEnabled} from '@/lib/paystack';
import {fail,handleError,ok} from '@/lib/http';
import {categoryIdPattern as uuid} from '@/lib/event-inventory';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const eventId=new URL(req.url).searchParams.get('eventId')||'';
  if(!uuid.test(eventId))return fail('Select a valid event',400);
  const [event]=await db()`select e.id,(e.status='published' and e.verification_status='verified'
   and e.visibility='public' and e.price_ngn>0 and owner.role='organiser' and owner.account_status='active'
   and p.verified_at is not null) as eligible
   from events e join app_users owner on owner.id=e.organiser_id
   left join paystack_organiser_accounts p on p.organiser_id=e.organiser_id
   where e.id=${eventId}`;
  return ok({enabled:paystackTestEnabled()&&Boolean(event?.eligible),mode:'test',livePayments:false});
 }catch(error){return handleError(error)}
}
