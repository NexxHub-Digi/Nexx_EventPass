import { currentUser } from '@/lib/security';
import { db } from '@/lib/db';
import { fail, handleError, ok, payload, str } from '@/lib/http';
export const runtime='nodejs';
export async function POST(req: Request) {
  try {const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const b=await payload(req), id=str(b.orderId,40),decision=str(b.decision,20);
    if(!id || !['approved','rejected'].includes(decision))return fail('Invalid review decision');
    const result=await db().begin(async tx=>{
      const orders=await tx`select o.*,e.organiser_id,e.capacity,e.starts_at,e.status as event_status from ticket_orders o join events e on e.id=o.event_id where o.id=${id} for update of o,e`;
      const order=orders[0];if(!order)return {error:'Order not found',status:404};
      if(order.organiser_id!==u.id && u.role!=='platform_admin')return {error:'Not permitted',status:403};
      if(order.status!=='pending')return {error:'Order already reviewed',status:409};
      if(decision==='approved'){
        if(order.event_status!=='published' || new Date(order.starts_at).getTime()<Date.now())return {error:'Event cannot accept new tickets',status:409};
        const counts=await tx`select count(*)::int as issued from tickets where event_id=${order.event_id}`;
        if(Number(counts[0].issued)+Number(order.quantity)>Number(order.capacity))return {error:'Event capacity exceeded',status:409};
      }
      await tx`update ticket_orders set status=${decision}, reviewed_by=${u.id},reviewed_at=now() where id=${id}`;
      if(decision==='approved')for(let i=0;i<Number(order.quantity);i++)await tx`insert into tickets(event_id,order_id,owner_id) values(${order.event_id},${id},${order.buyer_id})`;
      return {success:true,decision};
    });
    if('error' in result)return fail(String(result.error),Number(result.status));return ok(result);
  }catch(e){return handleError(e);}
}
