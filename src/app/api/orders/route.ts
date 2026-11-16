import { currentUser } from '@/lib/security';
import { db } from '@/lib/db';
import { fail, handleError, ok, payload, positiveInt, str } from '@/lib/http';
export const runtime='nodejs';
export async function GET(req: Request) {
  try { const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const url=new URL(req.url); const eventId=url.searchParams.get('eventId');
    if(eventId){ if(u.role!=='organiser'||!/^[0-9a-f-]{36}$/i.test(eventId))return fail('Valid organiser event required',403); const allowed=await db()`select id from events where id=${eventId} and organiser_id=${u.id}`; if(!allowed[0]) return fail('Not authorised',403);
      const orders=await db()`select o.id,o.event_id,o.buyer_id,o.quantity,o.amount_ngn,o.payment_reference,o.status,o.reviewed_at,o.created_at,o.receipt_uploaded_at,u.full_name as buyer_name,u.email as buyer_email,e.title as event_title from ticket_orders o join app_users u on u.id=o.buyer_id join events e on e.id=o.event_id where o.event_id=${eventId} order by o.created_at desc limit 100`;
      return ok({orders}); }
    const orders=await db()`select o.id,o.event_id,o.buyer_id,o.quantity,o.amount_ngn,o.payment_reference,o.status,o.reviewed_at,o.created_at,o.receipt_uploaded_at,e.title as event_title from ticket_orders o join events e on e.id=o.event_id where o.buyer_id=${u.id} order by o.created_at desc limit 100`;
    return ok({orders});
  }catch(e){return handleError(e);}
}
export async function POST(req: Request) {
  try { const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const b=await payload(req);const eventId=str(b.eventId,40),quantity=positiveInt(b.quantity,10),reference=str(b.paymentReference,250);
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(eventId) || !quantity || reference.length<5) return fail('Event, quantity and manual payment reference required');
    const e=await db()`select e.id,e.price_ngn,e.capacity,p.bank_name,p.account_number from events e join app_users a on a.id=e.organiser_id left join organiser_payment_accounts p on p.organiser_id=e.organiser_id where e.id=${eventId} and e.status='published' and e.verification_status='verified' and e.starts_at>now() and a.account_status='active'`;
    if(!e[0])return fail('Event is not available');
    if(Number(e[0].price_ngn)>0 && (!e[0].bank_name || !e[0].account_number))return fail('Organiser has not configured payment instructions',409);
    const orders=await db()`insert into ticket_orders (event_id,buyer_id,quantity,amount_ngn,payment_reference,status) values (${eventId},${u.id},${quantity},${quantity*Number(e[0].price_ngn)},${reference},'pending') returning id,event_id,buyer_id,quantity,amount_ngn,payment_reference,status,created_at`;
    return ok({order:orders[0],message:'Submitted for organiser verification. Not a valid ticket until approved.'},201);
  }catch(e){return handleError(e);}
}
