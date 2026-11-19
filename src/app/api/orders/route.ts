import { currentUser } from '@/lib/security';
import { db } from '@/lib/db';
import { fail, handleError, ok, payload, positiveInt, str } from '@/lib/http';
export const runtime='nodejs';
export async function GET(req: Request) {
  try { const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const url=new URL(req.url); const eventId=url.searchParams.get('eventId');
    if(eventId){ if(u.role!=='organiser'||!/^[0-9a-f-]{36}$/i.test(eventId))return fail('Valid organiser event required',403); const allowed=await db()`select id from events where id=${eventId} and organiser_id=${u.id}`; if(!allowed[0]) return fail('Not authorised',403);
      const orders=await db()`select o.id,o.event_id,o.buyer_id,o.quantity,o.amount_ngn,o.payment_reference,o.status,o.reviewed_at,o.created_at,o.receipt_uploaded_at,o.reservation_expires_at,o.refund_status,o.refund_note,u.full_name as buyer_name,u.email as buyer_email,e.title as event_title from ticket_orders o join app_users u on u.id=o.buyer_id join events e on e.id=o.event_id where o.event_id=${eventId} order by o.created_at desc limit 100`;
      return ok({orders}); }
    const orders=await db()`select o.id,o.event_id,o.buyer_id,o.quantity,o.amount_ngn,o.payment_reference,o.status,o.reviewed_at,o.created_at,o.receipt_uploaded_at,o.reservation_expires_at,o.refund_status,o.refund_note,e.title as event_title from ticket_orders o join events e on e.id=o.event_id where o.buyer_id=${u.id} order by o.created_at desc limit 100`;
    return ok({orders});
  }catch(e){return handleError(e);}
}
export async function POST(req: Request) {
  try { const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const b=await payload(req);const eventId=str(b.eventId,40),quantity=positiveInt(b.quantity,10),reference=str(b.paymentReference,250);
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(eventId) || !quantity || reference.length<5) return fail('Event, quantity and manual payment reference required');
    const result=await db().begin(async tx=>{
      // Lock this event before reserving inventory, preventing two simultaneous
      // buyers from taking its final available tickets.
      const rows=await tx`select e.id,e.price_ngn,e.capacity,p.bank_name,p.account_number
       from events e join app_users a on a.id=e.organiser_id
       left join organiser_payment_accounts p on p.organiser_id=e.organiser_id
       where e.id=${eventId} and e.status='published' and e.verification_status='verified'
        and e.visibility='public' and e.starts_at>now() and a.role='organiser' and a.account_status='active' for update of e`;
      const e=rows[0];if(!e)return {error:'Event is not available',status:400};
      if(Number(e.price_ngn)>0&&(!e.bank_name||!e.account_number))return {error:'Organiser has not configured payment instructions',status:409};
      const used=await tx`select
       (select count(*)::int from tickets where event_id=${eventId} and status='issued') +
       (select count(*)::int from offline_tickets where event_id=${eventId} and status='issued') as issued,
       (select coalesce(sum(quantity),0)::int from ticket_orders where event_id=${eventId}
         and status='pending' and reservation_expires_at>now()) as reserved`;
      const available=Number(e.capacity)-Number(used[0].issued)-Number(used[0].reserved);
      if(available<quantity)return {error:'Insufficient tickets remaining. Reduce quantity or choose another event.',status:409,available:Math.max(0,available)};
      const orders=await tx`insert into ticket_orders
       (event_id,buyer_id,quantity,amount_ngn,payment_reference,status,reservation_expires_at)
       values (${eventId},${u.id},${quantity},${quantity*Number(e.price_ngn)},${reference},'pending',now()+interval '45 minutes')
       returning id,event_id,buyer_id,quantity,amount_ngn,payment_reference,status,reservation_expires_at,created_at`;
      return {order:orders[0],available:available-quantity};
    });
    if('error' in result)return fail(String(result.error),Number(result.status));
    return ok({...result,message:'Tickets reserved for 45 minutes. Submit receipt before expiry; organiser confirms settled funds before QR release.'},201);
  }catch(e){return handleError(e);}
}
