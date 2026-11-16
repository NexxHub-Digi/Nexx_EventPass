import { currentUser } from '@/lib/security';
import { db } from '@/lib/db';
import { fail, handleError, ok, payload, str } from '@/lib/http';
export const runtime='nodejs';
export async function POST(req: Request) {
  try {const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const b=await payload(req), id=str(b.orderId,40),decision=str(b.decision,20);
    if(!/^[0-9a-f-]{36}$/i.test(id) || !['approved','rejected'].includes(decision))return fail('Invalid review decision');
    const result=await db().begin(async tx=>{
      const orders=await tx`select o.*,e.organiser_id,e.capacity,e.starts_at,e.status as event_status,a.account_status as organiser_status from ticket_orders o join events e on e.id=o.event_id join app_users a on a.id=e.organiser_id where o.id=${id} for update of o,e`;
      const order=orders[0];if(!order)return {error:'Order not found',status:404};
      if(order.organiser_id!==u.id || u.role!=='organiser')return {error:'Only the owning organiser may review payments',status:403};
      if(order.organiser_status!=='active')return {error:'Organiser account inactive',status:403};
      if(order.status!=='pending')return {error:'Order already reviewed',status:409};
      if(decision==='approved'){
        if(Number(order.amount_ngn)>0 && !order.receipt_data)return {error:'Buyer must upload payment receipt before approval',status:409};
        if(order.event_status!=='published' || new Date(order.starts_at).getTime()<Date.now())return {error:'Event cannot accept new tickets',status:409};
        const counts=await tx`select count(*)::int as issued from tickets where event_id=${order.event_id}`;
        if(Number(counts[0].issued)+Number(order.quantity)>Number(order.capacity))return {error:'Event capacity exceeded',status:409};
      }
      await tx`update ticket_orders set status=${decision}, reviewed_by=${u.id},reviewed_at=now() where id=${id}`;
      const issued=[];
      if(decision==='approved'){
        const design=await tx`select ticket_theme,qr_keyword_ciphertext,
          (select m.id from event_media m where m.event_id=e.id and m.media_type='ticket_art' and m.approved order by m.created_at asc limit 1) as ticket_art_id
          from events e where e.id=${order.event_id}`;
        // Existing legacy events use signed EVP1 tickets; new configured events use encrypted EVP2.
        // Never mark a payment approved without issuing every ticket inside this same transaction.
        for(let i=0;i<Number(order.quantity);i++){
          const ticket=await tx`insert into tickets(event_id,order_id,owner_id)
           values(${order.event_id},${id},${order.buyer_id}) returning id,event_id,status,created_at`;
          await tx`insert into ticket_deliveries(ticket_id,order_id,recipient_id,event_id,ticket_theme,ticket_art_id)
           values(${ticket[0].id},${id},${order.buyer_id},${order.event_id},${design[0].ticket_theme},${design[0].ticket_art_id})`;
          issued.push({id:ticket[0].id});
        }
      }
      return {success:true,decision,issued:issued.length,delivery:'in_app'};
    });
    if('error' in result)return fail(String(result.error),Number(result.status));return ok(result);
  }catch(e){return handleError(e);}
}
