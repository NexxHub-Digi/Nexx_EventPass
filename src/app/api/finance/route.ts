import { db } from '@/lib/db';
import { categoryIdPattern as uuid } from '@/lib/event-inventory';
import { fail, handleError, ok, payload, str } from '@/lib/http';
import { currentUser } from '@/lib/security';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const user = await currentUser();
    if (!user || user.account_status !== 'active' || !['organiser','platform_admin'].includes(user.role)) {
      return fail('Organiser or Platform Admin required',403);
    }
    const admin = user.role === 'platform_admin';
    const eventId = new URL(req.url).searchParams.get('eventId');
    if (eventId && !uuid.test(eventId)) return fail('Invalid event');

    const sql = db();
    const payments = await sql`select p.order_id,p.method,p.gross_ngn,p.commission_basis_points,p.commission_ngn,
      p.gross_ngn-p.commission_ngn as organiser_net_ngn,
      p.collection_reference,p.verified_at,e.title as event_title,
      c.received_ngn,c.reference as remittance_reference,c.recorded_at,
      case when c.order_id is null then case when p.commission_ngn=0 then 'not_due' else 'outstanding' end
           when c.received_ngn=p.commission_ngn then 'matched' else 'discrepancy' end as reconciliation_status
      from verified_order_payments p join ticket_orders o on o.id=p.order_id
      join events e on e.id=o.event_id left join commission_reconciliations c on c.order_id=p.order_id
      where (${admin} or e.organiser_id=${user.id}) and (${eventId}::uuid is null or e.id=${eventId})
      order by p.verified_at desc,p.order_id limit 100`;
    const [totals] = await sql`select coalesce(sum(p.gross_ngn),0) as gross_ngn,
      coalesce(sum(p.commission_ngn),0) as commission_ngn,
      coalesce(sum(p.gross_ngn-p.commission_ngn),0) as organiser_net_ngn,
      coalesce(sum(coalesce(c.received_ngn,0)),0) as received_ngn,
      coalesce(sum(greatest(p.commission_ngn-coalesce(c.received_ngn,0),0)),0) as outstanding_ngn,
      count(*) filter(where c.order_id is not null and c.received_ngn<>p.commission_ngn) as discrepancies
      from verified_order_payments p join ticket_orders o on o.id=p.order_id
      join events e on e.id=o.event_id left join commission_reconciliations c on c.order_id=p.order_id
      where (${admin} or e.organiser_id=${user.id}) and (${eventId}::uuid is null or e.id=${eventId})`;
    const [policy] = await sql`select basis_points from platform_commission_policy where singleton`;
    return ok({ payments, totals, basisPoints: policy.basis_points });
  } catch(error) {
    return handleError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await currentUser();
    if (!user || user.account_status !== 'active') return fail('Active account required',403);
    const body = await payload(req);

    if (body.action === 'onsite') {
      const eventId = str(body.eventId,40);
      if (user.role !== 'organiser') return fail('Owning organiser required',403);
      if (!uuid.test(eventId) || typeof body.enabled !== 'boolean') return fail('Choose an event and onsite setting');
      const enabled = body.enabled;
      const [event] = await db()`update events set onsite_payments_enabled=${enabled}
        where id=${eventId} and organiser_id=${user.id} returning id`;
      return event ? ok({ enabled }) : fail('Event not found',404);
    }

    if (user.role !== 'platform_admin') return fail('Platform Admin required',403);
    if (body.action === 'commission') {
      const basisPoints = body.basisPoints;
      if (typeof basisPoints !== 'number' || !Number.isInteger(basisPoints) || basisPoints<0 || basisPoints>10000) {
        return fail('Commission must be between 0 and 10,000 basis points');
      }
      await db().begin(async tx=>{
        const [previous] = await tx`select basis_points from platform_commission_policy where singleton for update`;
        await tx`update platform_commission_policy set basis_points=${basisPoints},updated_by=${user.id},updated_at=now() where singleton`;
        await tx`insert into platform_admin_actions(admin_id,action,details)
          values(${user.id},'commission_policy',${JSON.stringify({previous:previous.basis_points,basisPoints})}::jsonb)`;
      });
      return ok({basisPoints});
    }

    const orderId = str(body.orderId,40);
    const reference = str(body.reference,120);
    const received = body.receivedNgn;
    if (body.action!=='reconcile' || !uuid.test(orderId) || reference.length<5 ||
        typeof received!=='number' || !Number.isInteger(received) || received<0 || received>2147483647) {
      return fail('Enter a verified order, actual amount received and statement reference');
    }
    return await db().begin(async tx=>{
      const [payment] = await tx`select commission_ngn from verified_order_payments where order_id=${orderId} for update`;
      if (!payment) return fail('Verified payment not found',404);
      if (payment.commission_ngn===0) return fail('This payment has no commission due',409);
      const [previous] = await tx`select received_ngn,reference from commission_reconciliations where order_id=${orderId}`;
      await tx`insert into commission_reconciliations(order_id,received_ngn,reference,recorded_by)
        values(${orderId},${received},${reference},${user.id})
        on conflict(order_id) do update set received_ngn=excluded.received_ngn,reference=excluded.reference,
          recorded_by=excluded.recorded_by,recorded_at=now()`;
      const status = received===payment.commission_ngn ? 'matched' : 'discrepancy';
      await tx`insert into ticket_payment_audit(order_id,actor_id,action,details)
        values(${orderId},${user.id},'commission_reconciled',
        ${JSON.stringify({ previous:previous||null, received, reference, expected:payment.commission_ngn, status })}::jsonb)`;
      return ok({status});
    });
  } catch(error) {
    if ((error as {code?:string})?.code==='23505') return fail('That remittance reference is already recorded for another order',409);
    return handleError(error);
  }
}
