import { categoryIdPattern as uuid } from '@/lib/event-inventory';
import { currentUser } from '@/lib/security';
import { encryptOrganiserKeyword } from '@/lib/qr-encryption';
import {isMasqueradePoster} from '@/lib/masquerade-templates';
import { db } from '@/lib/db';
import { fail, handleError, ok, payload, positiveInt, str } from '@/lib/http';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  try {
    // Separate current discovery from historical events without deleting records.
    const pastView=new URL(req.url).searchParams.get('view')==='past';
    const user = await currentUser();
    const events = user ? await db()`select e.id,e.organiser_id,e.title,e.slug,e.venue,e.starts_at,e.ends_at,e.price_ngn,e.capacity,e.status,e.created_at,e.description,e.category,e.ticket_theme,e.admission_label,e.poster_template,e.verification_status,e.visibility,e.onsite_payments_enabled,(select m.id from event_media m where m.event_id=e.id and m.media_type='image' and m.approved order by m.created_at asc limit 1) as cover_media_id,(select m.id from event_media m where m.event_id=e.id and m.media_type='video' and m.approved order by m.created_at asc limit 1) as video_media_id,(select m.id from event_media m where m.event_id=e.id and m.media_type='ticket_art' and m.approved order by m.created_at asc limit 1) as ticket_art_id,(e.qr_keyword_ciphertext is not null) as qr_configured,u.full_name as organiser,p.id as payment_account_id,p.bank_name,p.account_name as bank_account_name,p.account_number as bank_account_number from events e join app_users u on u.id=e.organiser_id left join organiser_bank_accounts p on p.id=e.payment_account_id and p.organiser_id=e.organiser_id and p.status='verified' and e.price_ngn>0 where (e.status='published' and e.verification_status='verified' and e.visibility='public' and u.account_status='active' and u.role='organiser' and
       (${pastView}::boolean = (e.starts_at < now() - interval '24 hours'))) or (e.organiser_id=${user.id} and ${user.role==='organiser'&&user.account_status==='active'}) or ${user.role==='platform_admin'&&user.account_status==='active'} order by e.starts_at asc limit 100`
      : await db()`select e.id,e.organiser_id,e.title,e.slug,e.venue,e.starts_at,e.ends_at,e.price_ngn,e.capacity,e.status,e.created_at,e.description,e.category,e.ticket_theme,e.admission_label,e.poster_template,e.verification_status,e.visibility,e.onsite_payments_enabled,(select m.id from event_media m where m.event_id=e.id and m.media_type='image' and m.approved order by m.created_at asc limit 1) as cover_media_id,(select m.id from event_media m where m.event_id=e.id and m.media_type='video' and m.approved order by m.created_at asc limit 1) as video_media_id,(select m.id from event_media m where m.event_id=e.id and m.media_type='ticket_art' and m.approved order by m.created_at asc limit 1) as ticket_art_id,(e.qr_keyword_ciphertext is not null) as qr_configured,u.full_name as organiser,p.id as payment_account_id,p.bank_name,p.account_name as bank_account_name,p.account_number as bank_account_number from events e join app_users u on u.id=e.organiser_id left join organiser_bank_accounts p on p.id=e.payment_account_id and p.organiser_id=e.organiser_id and p.status='verified' and e.price_ngn>0 where e.status='published' and e.verification_status='verified' and e.visibility='public' and u.account_status='active' and u.role='organiser' and
       (${pastView}::boolean = (e.starts_at < now() - interval '24 hours')) order by e.starts_at asc limit 100`;
    return ok({ events });
  } catch (e) { return handleError(e); }
}
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user || user.account_status!=='active' || user.role!=='organiser') return fail('Organiser access required', 403);
    const capability=await db()`select can_create_events from organiser_capabilities where organiser_id=${user.id}`;
    if(capability[0]?.can_create_events===false)return fail('Platform Admin has disabled new event creation for this organiser',403);
    const b = await payload(req); const title = str(b.title, 160); const venue = str(b.venue, 250);
    const startsAt = str(b.startsAt, 60); const start = new Date(startsAt);
    const price = Number(b.priceNgn); const capacity = positiveInt(b.capacity, 1000000);
    const keyword = str(b.qrKeyword, 80);
    const description=str(b.description,2500),category=str(b.category,60)||'Other',ticketTheme=str(b.ticketTheme,32)||'aurora',admissionLabel=str(b.admissionLabel,80)||'ADMIT ONE',posterTemplate=str(b.posterTemplate,40)||'none';
    const visibility=str(b.visibility,16)||'public'; if(!['public','unlisted','private'].includes(visibility))return fail('Invalid event visibility',400);
    const selectedTheme=await db()`select id from ticket_theme_catalog where id=${ticketTheme} and active=true limit 1`;
    if(!selectedTheme[0])return fail('Choose an available ticket theme');
    if(posterTemplate!=='none'&&!isMasqueradePoster(posterTemplate))return fail('Choose an available poster design');
    if (keyword.length < 8) return fail('Choose a private organiser QR keyword of at least 8 characters');
    if (!title || !venue || !Number.isFinite(start.getTime()) || start.getTime()<Date.now() || !Number.isSafeInteger(price) || price<0 || !capacity) return fail('Please provide a future date, valid title, venue, price and capacity');
    const accountId=str(b.paymentAccountId,40);
    if(price>0){
      if(!uuid.test(accountId))return fail('Choose a verified bank account before creating a paid event',409);
      const [account]=await db()`select id from organiser_bank_accounts
        where id=${accountId} and organiser_id=${user.id} and status='verified'`;
      if(!account)return fail('Choose a verified bank account owned by your organiser account',409);
    }
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)+'-'+crypto.randomUUID().slice(0,8);
    const id = crypto.randomUUID();
    const encryptedKeyword = encryptOrganiserKeyword(id, keyword);
    const events = await db()`insert into events (id,organiser_id,title,slug,venue,starts_at,price_ngn,capacity,status,qr_keyword_ciphertext,description,category,ticket_theme,verification_status,admission_label,poster_template,visibility,payment_account_id) values (${id},${user.id},${title},${slug},${venue},${start.toISOString()},${price},${capacity},${visibility==='private'?'published':'draft'},${encryptedKeyword},${description},${category},${ticketTheme},${visibility==='private'?'verified':'pending'},${admissionLabel},${posterTemplate},${visibility},${price>0?accountId:null}) returning id,organiser_id,title,slug,venue,starts_at,price_ngn,capacity,status,description,category,ticket_theme,verification_status,admission_label,poster_template`;
    return ok({ event:events[0] },201);
  } catch(e){return handleError(e);}
}

export async function PATCH(req:Request){
 try{
  const u=await currentUser();if(!u||u.account_status!=='active'||u.role!=='organiser')return fail('Active organiser required',403);
  const capability=await db()`select can_create_events from organiser_capabilities where organiser_id=${u.id}`;
  if(capability[0]?.can_create_events===false)return fail('Organiser event editing is restricted',403);
  const b=await payload(req),eventId=str(b.eventId,40),description=str(b.description,2500),category=str(b.category,60)||'Other',
  ticketTheme=str(b.ticketTheme,32)||'aurora',admissionLabel=str(b.admissionLabel,80)||'ADMIT ONE',posterTemplate=str(b.posterTemplate,40)||'none';
  if(!/^[0-9a-f-]{36}$/i.test(eventId))return fail('Invalid event');
  if(b.action==='payment_account'){
   const accountId=str(b.paymentAccountId,40);
   if(!uuid.test(accountId))return fail('Choose a verified bank account');
   const [event]=await db()`update events e set payment_account_id=a.id
     from organiser_bank_accounts a where e.id=${eventId} and e.organiser_id=${u.id} and e.price_ngn>0
       and a.organiser_id=e.organiser_id and a.id=${accountId} and a.status='verified' returning e.id`;
   return event?ok({message:'Verified bank account assigned to event'}):fail('Choose a verified account for one of your paid events',409);
  }
  const selectedTheme=await db()`select id from ticket_theme_catalog where id=${ticketTheme} and active=true limit 1`;
  if(!selectedTheme[0])return fail('Invalid or inactive ticket theme');
  if(posterTemplate!=='none'&&!isMasqueradePoster(posterTemplate))return fail('Invalid poster design');
  const result=await db().begin(async tx=>{
   const owned=await tx`select id from events where id=${eventId} and organiser_id=${u.id} for update`;
   if(!owned[0])return fail('Event not found or not owned by you',404);
   const [usage]=await tx`select
    (exists(select 1 from tickets where event_id=${eventId}) or
     exists(select 1 from offline_tickets where event_id=${eventId} and status='issued') or
     exists(select 1 from ticket_orders where event_id=${eventId} and status='pending' and reservation_expires_at>now())) as in_use`;
   if(usage.in_use)return fail('This event has issued tickets or active reservations. Contact Platform Admin to change a live event.',409);
   const [event]=await tx`update events set description=${description},category=${category},
    ticket_theme=${ticketTheme},admission_label=${admissionLabel},poster_template=${posterTemplate},
    verification_status='pending',status='draft'
    where id=${eventId} returning id,description,category,ticket_theme,admission_label,poster_template`;
   return ok({event,message:'Changes are pending Platform Admin review before they appear publicly.'});
  });
  return result;
 }catch(e){return handleError(e)}
}
