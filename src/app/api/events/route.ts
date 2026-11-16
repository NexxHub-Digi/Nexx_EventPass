import { currentUser } from '@/lib/security';
import { db } from '@/lib/db';
import { fail, handleError, ok, payload, positiveInt, str } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const user = await currentUser();
    const events = user ? await db()`select e.*, u.full_name as organiser from events e join app_users u on u.id=e.organiser_id where e.status='published' or e.organiser_id=${user.id} order by e.starts_at asc limit 100`
      : await db()`select e.*, u.full_name as organiser from events e join app_users u on u.id=e.organiser_id where e.status='published' order by e.starts_at asc limit 100`;
    return ok({ events });
  } catch (e) { return handleError(e); }
}
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user || !['organiser', 'platform_admin'].includes(user.role)) return fail('Organiser access required', 403);
    const b = await payload(req); const title = str(b.title, 160); const venue = str(b.venue, 250);
    const startsAt = str(b.startsAt, 60); const start = new Date(startsAt);
    const price = Number(b.priceNgn); const capacity = positiveInt(b.capacity, 1000000);
    if (!title || !venue || !Number.isFinite(start.getTime()) || start.getTime()<Date.now() || !Number.isSafeInteger(price) || price<0 || !capacity) return fail('Please provide a future date, valid title, venue, price and capacity');
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)+'-'+crypto.randomUUID().slice(0,8);
    const events = await db()`insert into events (organiser_id,title,slug,venue,starts_at,price_ngn,capacity,status) values (${user.id},${title},${slug},${venue},${start.toISOString()},${price},${capacity},'published') returning *`;
    return ok({ event:events[0] },201);
  } catch(e){return handleError(e);}
}
