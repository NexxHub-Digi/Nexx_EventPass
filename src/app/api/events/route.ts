import { currentUser } from '@/lib/security';
import { encryptOrganiserKeyword } from '@/lib/qr-encryption';
import { db } from '@/lib/db';
import { fail, handleError, ok, payload, positiveInt, str } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const user = await currentUser();
    const events = user ? await db()`select e.id,e.organiser_id,e.title,e.slug,e.venue,e.starts_at,e.ends_at,e.price_ngn,e.capacity,e.status,e.created_at,(e.qr_keyword_ciphertext is not null) as qr_configured,u.full_name as organiser,p.bank_name,p.account_name as bank_account_name,p.account_number as bank_account_number from events e join app_users u on u.id=e.organiser_id left join organiser_payment_accounts p on p.organiser_id=e.organiser_id where (e.status='published' and u.account_status='active') or e.organiser_id=${user.id} or ${user.role==='platform_admin'} order by e.starts_at asc limit 100`
      : await db()`select e.id,e.organiser_id,e.title,e.slug,e.venue,e.starts_at,e.ends_at,e.price_ngn,e.capacity,e.status,e.created_at,(e.qr_keyword_ciphertext is not null) as qr_configured,u.full_name as organiser,p.bank_name,p.account_name as bank_account_name,p.account_number as bank_account_number from events e join app_users u on u.id=e.organiser_id left join organiser_payment_accounts p on p.organiser_id=e.organiser_id where e.status='published' and u.account_status='active' order by e.starts_at asc limit 100`;
    return ok({ events });
  } catch (e) { return handleError(e); }
}
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user || user.account_status!=='active' || !['organiser', 'platform_admin'].includes(user.role)) return fail('Organiser access required', 403);
    const b = await payload(req); const title = str(b.title, 160); const venue = str(b.venue, 250);
    const startsAt = str(b.startsAt, 60); const start = new Date(startsAt);
    const price = Number(b.priceNgn); const capacity = positiveInt(b.capacity, 1000000);
    const keyword = str(b.qrKeyword, 80);
    if (keyword.length < 8) return fail('Choose a private organiser QR keyword of at least 8 characters');
    if (!title || !venue || !Number.isFinite(start.getTime()) || start.getTime()<Date.now() || !Number.isSafeInteger(price) || price<0 || !capacity) return fail('Please provide a future date, valid title, venue, price and capacity');
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)+'-'+crypto.randomUUID().slice(0,8);
    const id = crypto.randomUUID();
    const encryptedKeyword = encryptOrganiserKeyword(id, keyword);
    const events = await db()`insert into events (id,organiser_id,title,slug,venue,starts_at,price_ngn,capacity,status,qr_keyword_ciphertext) values (${id},${user.id},${title},${slug},${venue},${start.toISOString()},${price},${capacity},'published',${encryptedKeyword}) returning id,organiser_id,title,slug,venue,starts_at,price_ngn,capacity,status`;
    return ok({ event:events[0] },201);
  } catch(e){return handleError(e);}
}
