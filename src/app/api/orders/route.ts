import { currentUser } from '@/lib/security';
import { availableEventTickets, categoryIdPattern } from '@/lib/event-inventory';
import { db } from '@/lib/db';
import {paystackTestEnabled} from '@/lib/paystack';
import { fail, handleError, ok, payload, positiveInt, str } from '@/lib/http';
export const runtime='nodejs';
export async function GET(req: Request) {
  try { const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const url=new URL(req.url); const eventId=url.searchParams.get('eventId');
    if(eventId){ if(u.role!=='organiser'||!/^[0-9a-f-]{36}$/i.test(eventId))return fail('Valid organiser event required',403); const allowed=await db()`select id from events where id=${eventId} and organiser_id=${u.id}`; if(!allowed[0]) return fail('Not authorised',403);
      const orders=await db()`select o.id,o.event_id,o.buyer_id,o.quantity,o.amount_ngn,o.unit_price_ngn,o.payment_reference,o.payment_method,o.payment_account_id,o.status,o.reviewed_at,o.created_at,o.receipt_uploaded_at,o.reservation_expires_at,o.refund_status,o.refund_note,u.full_name as buyer_name,u.email as buyer_email,e.title as event_title,e.starts_at as event_starts_at from ticket_orders o join app_users u on u.id=o.buyer_id join events e on e.id=o.event_id where o.event_id=${eventId} order by o.created_at desc limit 100`;
      return ok({orders}); }
    const orders=await db()`select o.id,o.event_id,o.buyer_id,o.quantity,o.amount_ngn,o.unit_price_ngn,o.payment_reference,o.payment_method,o.payment_account_id,o.status,o.reviewed_at,o.created_at,o.receipt_uploaded_at,o.reservation_expires_at,o.refund_status,o.refund_note,e.title as event_title,e.starts_at as event_starts_at from ticket_orders o join events e on e.id=o.event_id where o.buyer_id=${u.id} order by o.created_at desc limit 100`;
    return ok({orders});
  }catch(e){return handleError(e);}
}
export async function POST(req: Request) {
  try { const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const b=await payload(req);const eventId=str(b.eventId,40),quantity=positiveInt(b.quantity,10),reference=str(b.paymentReference,250);
    const method=str(b.paymentMethod,12)||'manual';
    if(!['manual','onsite','paystack'].includes(method)||method==='paystack'&&!paystackTestEnabled())return fail('Payment method is unavailable');
    const reservationKey=str(b.reservationKey,40).toLowerCase()||null;
    if(reservationKey&&!categoryIdPattern.test(reservationKey))return fail('Invalid reservation key');
    const paymentAccountId=str(b.paymentAccountId,40).toLowerCase();
    const categoryId=str(b.ticketCategoryId,40).toLowerCase()||null;
    if(categoryId&&!categoryIdPattern.test(categoryId))return fail('Invalid ticket category');
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(eventId) || !quantity) return fail('A valid event and ticket quantity are required');
    const result=await db().begin(async tx=>{
      if(reservationKey){
       // Serialize this buyer/key across events before inspecting inventory.
       await tx`select pg_advisory_xact_lock(hashtextextended(${u.id+':'+reservationKey},0))`;
       const [prior]=await tx`select id,event_id,buyer_id,ticket_category_id,quantity,amount_ngn,unit_price_ngn,payment_reference,
         payment_method,payment_account_id,status,reservation_expires_at,created_at
         from ticket_orders where buyer_id=${u.id} and reservation_key=${reservationKey}`;
       if(prior){
        const same=prior.event_id===eventId.toLowerCase()&&Number(prior.quantity)===quantity&&prior.ticket_category_id===categoryId&&(b.unitPriceNgn===undefined||prior.unit_price_ngn===b.unitPriceNgn)&&
         (prior.payment_method==='free'||(prior.payment_method===method&&(method==='onsite'||method==='paystack'||
          (prior.payment_account_id===paymentAccountId&&prior.payment_reference===reference))));
        return same?{order:prior,replayed:true}:{error:'This reservation key already belongs to another checkout. Open My orders.',status:409};
       }
      }
      // Lock this event before reserving inventory, preventing two simultaneous
      // buyers from taking its final available tickets.
      const rows=await tx`select e.id,e.price_ngn,e.capacity,e.onsite_payments_enabled,p.id as payment_account_id,
       ps.subaccount_code as paystack_subaccount_code
       from events e join app_users a on a.id=e.organiser_id
       left join organiser_bank_accounts p on p.id=e.payment_account_id and p.organiser_id=e.organiser_id and p.status='verified'
       left join paystack_organiser_accounts ps on ps.organiser_id=e.organiser_id
       where e.id=${eventId} and e.status='published' and e.verification_status='verified'
        and e.visibility='public'
        and (e.starts_at>now() or (${method==='onsite'} and coalesce(e.ends_at,e.starts_at+interval '24 hours')>now())) and a.role='organiser' and a.account_status='active' for update of e`;
      const e=rows[0];if(!e)return {error:'Event is not available',status:400};
      const inventory=await availableEventTickets(tx,e.id,Number(e.capacity),categoryId);
      if(!inventory)return {error:'Ticket category is not available for this event',status:400};
      const unitPrice=inventory.categoryPrice??Number(e.price_ngn);
      if((b.unitPriceNgn!==undefined||unitPrice!==Number(e.price_ngn))&&b.unitPriceNgn!==unitPrice)
       return {error:'Ticket price has changed. Reopen checkout and review the total before paying.',status:409};
      if(unitPrice*quantity>2147483647)return {error:'Order total exceeds the supported amount',status:400};
      if(unitPrice>0&&method==='manual'&&reference.length<5)return {error:'A payment reference is required for bank transfer reservations',status:400};
      if(unitPrice>0&&method==='onsite'&&!e.onsite_payments_enabled)return {error:'Onsite payments are not enabled for this event',status:409};
      if(unitPrice>0&&method==='paystack'&&!e.paystack_subaccount_code)return {error:'Verified Paystack subaccount is required for gateway checkout',status:409};
      if(unitPrice>0&&method==='manual'&&!e.payment_account_id)return {error:'Verified bank details are required before this event can accept paid orders',status:409};
      if(unitPrice>0&&method==='manual'&&paymentAccountId!==e.payment_account_id)
        return {error:'Refresh checkout to confirm the current verified bank details. If you already paid, contact the organiser before paying again.',status:409};
      const {available}=inventory;
      if(available<quantity)return {error:'Insufficient tickets remaining. Reduce quantity or choose another event.',status:409,available};
      const paymentMethod=unitPrice===0?'free':method;
      const orders=await tx`insert into ticket_orders
       (event_id,buyer_id,quantity,amount_ngn,payment_reference,status,reservation_expires_at,ticket_category_id,payment_method,payment_account_id,reservation_key,unit_price_ngn)
       values (${eventId},${u.id},${quantity},${quantity*unitPrice},${paymentMethod==='onsite'?'ONSITE':paymentMethod==='paystack'?'PAYSTACK-PENDING':paymentMethod==='free'?'FREE':reference},'pending',now()+interval '45 minutes',${categoryId},${paymentMethod},${paymentMethod==='manual'?e.payment_account_id:null},${reservationKey},${unitPrice})
       returning id,event_id,buyer_id,ticket_category_id,quantity,amount_ngn,unit_price_ngn,payment_reference,payment_method,status,reservation_expires_at,created_at`;
      return {order:orders[0],available:available-quantity};
    });
    if('error' in result)return fail(String(result.error),Number(result.status));
    return ok({...result,message:result.order.payment_method==='paystack'?'Tickets reserved for 45 minutes. Continue to Paystack test checkout; your QR is issued only after verified payment.':result.order.payment_method==='onsite'?'Show this reservation to the organiser and pay onsite within 45 minutes. Tickets are released after collection is confirmed.':
      'Tickets reserved for 45 minutes. The organiser reviews the reservation before QR release.'},result.replayed?200:201);
  }catch(e){return handleError(e);}
}

export async function PATCH(req: Request) {
  try {
    const user = await currentUser();
    if (!user || user.account_status !== 'active') return fail('Active account required',403);
    const body = await payload(req);
    const orderId = str(body.orderId,40);
    if (body.action !== 'cancel' || !categoryIdPattern.test(orderId)) return fail('Select a reservation to cancel');
    return await db().begin(async tx => {
      const [order] = await tx`select id,status,receipt_uploaded_at,reservation_expires_at>now() as unexpired
        from ticket_orders where id=${orderId} and buyer_id=${user.id} for update`;
      if (!order) return fail('Reservation not found',404);
      if (order.status==='cancelled') return ok({status:'cancelled'});
      if (order.status!=='pending'||!order.unexpired||order.receipt_uploaded_at) {
        return fail('Only an unpaid, active reservation can be cancelled. Contact the organiser if you sent money.',409);
      }
      const [gateway]=await tx`select id from paystack_payments where order_id=${orderId}`;
      if(gateway)return fail('Paystack checkout was initiated. Verify payment or contact support before cancellation.',409);
      await tx`update ticket_orders set status='cancelled' where id=${orderId}`;
      await tx`insert into ticket_payment_audit(order_id,actor_id,action,details)
        values(${orderId},${user.id},'reservation_cancelled','{}'::jsonb)`;
      return ok({status:'cancelled'});
    });
  } catch (error) {
    return handleError(error);
  }
}
