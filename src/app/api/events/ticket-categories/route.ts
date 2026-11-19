import { db } from '@/lib/db';
import { availableEventTickets, categoryIdPattern } from '@/lib/event-inventory';
import { fail, handleError, ok, payload, str } from '@/lib/http';
import { offlineAccess } from '@/lib/offline-access';
import { currentUser } from '@/lib/security';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const eventId = new URL(req.url).searchParams.get('eventId') || '';
    if (!categoryIdPattern.test(eventId)) return fail('Invalid event');
    const access = await offlineAccess(eventId, 'view') || await offlineAccess(eventId, 'generate');
    const [event] = await db()`select id,capacity,price_ngn from events
      where id=${eventId} and (${Boolean(access)} or
        (status='published' and verification_status='verified' and visibility='public'
         and exists(select 1 from app_users where id=events.organiser_id and role='organiser' and account_status='active')))`;
    if (!event) return fail('Event not found',404);
    const categories = await db()`select id,name,capacity,coalesce(price_ngn,${event.price_ngn}::integer) as price_ngn from event_ticket_categories where event_id=${eventId} order by name`;
    return ok({categories,generalCapacity:Number(event.capacity)-categories.reduce((sum,row)=>sum+Number(row.capacity),0)});
  } catch(error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user || user.role!=='organiser' || user.account_status!=='active') return fail('Active organiser required',403);
    const body = await payload(req);
    const eventId = str(body.eventId,40);
    const name = str(body.name,60);
    const capacity = Number(body.capacity);
    const price = body.priceNgn ?? null;
    if(price!==null&&(typeof price!=='number'||!Number.isSafeInteger(price)||price<0||price>214748364))return fail('Enter a whole-naira category price or leave it blank');
    if (!categoryIdPattern.test(eventId) || !name || !Number.isSafeInteger(capacity) || capacity<1 || capacity>2147483647) {
      return fail('Enter a category name and positive whole-number capacity');
    }
    return await db().begin(async tx => {
      const [event] = await tx`select id,capacity,price_ngn from events where id=${eventId} and organiser_id=${user.id} for update`;
      if (!event) return fail('Event not found',404);
      if(price!==null&&price>0&&Number(event.price_ngn)===0)return fail('Paid categories require a paid event with a verified bank account',409);
      const general = await availableEventTickets(tx,event.id,Number(event.capacity),null);
      if (!general || general.available<capacity) return fail('Allocation exceeds available General tickets',409);
      const [category] = await tx`insert into event_ticket_categories(event_id,name,capacity,price_ngn)
        values(${event.id},${name},${capacity},${price}) on conflict do nothing returning id,name,capacity,price_ngn`;
      if (!category) return fail('A category with this name already exists',409);
      return ok({category},201);
    });
  } catch(error) {
    return handleError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await currentUser();
    if (!user || user.role!=='organiser' || user.account_status!=='active') return fail('Active organiser required',403);
    const body=await payload(req);
    const eventId=str(body.eventId,40),categoryId=str(body.categoryId,40);
    const price=body.priceNgn;
    if(!categoryIdPattern.test(eventId)||!categoryIdPattern.test(categoryId)||
      (price!==null&&(typeof price!=='number'||!Number.isSafeInteger(price)||price<0||price>214748364))) {
      return fail('Choose a category and enter a whole-naira price or reset to the event price');
    }
    return await db().begin(async tx=>{
      const [event]=await tx`select id,price_ngn from events where id=${eventId} and organiser_id=${user.id} for update`;
      if(!event)return fail('Event not found',404);
      if(price!==null&&price>0&&Number(event.price_ngn)===0)return fail('Paid categories require a paid event with a verified bank account',409);
      const [category]=await tx`update event_ticket_categories set price_ngn=${price}
        where event_id=${eventId} and id=${categoryId} returning id,name,capacity,price_ngn`;
      if(!category)return fail('Ticket category not found',404);
      return ok({category});
    });
  }catch(error){
    return handleError(error);
  }
}
