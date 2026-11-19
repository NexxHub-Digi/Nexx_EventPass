import {db} from '@/lib/db';
import {currentUser} from '@/lib/security';
import {offlineAccess,uuid} from '@/lib/offline-access';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
const permissions=['view','generate','activate','export','distribute','sales','reports','reissue','staff'];

export async function GET(req:Request){
 try{
  const eventId=str(new URL(req.url).searchParams.get('eventId'),40);
  const access=await offlineAccess(eventId,'staff');if(!access)return fail('Staff management permission required',403);
  const team=await db()`select s.id,s.user_id,u.full_name,u.email,s.permissions,s.scope,s.selected_event_ids,s.include_future,s.expires_at,s.revoked_at
    from offline_ticket_staff s join app_users u on u.id=s.user_id
    where s.organiser_id=${access.event.organiser_id} order by s.created_at desc limit 100`;
  return ok({team});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{
  const b=await payload(req),eventId=str(b.eventId,40),email=str(b.email,254).toLowerCase();
  const access=await offlineAccess(eventId,'staff');
  if(!access||access.user.id!==access.event.organiser_id)return fail('Only the owning organiser may assign ticket staff',403);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail('Valid staff email required',400);
  const requested=Array.isArray(b.permissions)?b.permissions:[];
  if(!requested.length||requested.some(x=>!permissions.includes(x)))return fail('Choose valid staff permissions',400);
  const scope=str(b.scope,12)==='all'?'all':'selected';
  const selected=Array.isArray(b.eventIds)?b.eventIds:[];
  if(scope==='selected'&&(!selected.length||selected.some(x=>typeof x!=='string'||!uuid.test(x))))return fail('Choose assigned events',400);
  const future=scope==='all'&&b.includeFuture===true;
  const expires=b.expiresAt?new Date(String(b.expiresAt)):null;
  if(expires&&(!Number.isFinite(expires.getTime())||expires.getTime()<=Date.now()))return fail('Choose a future expiry date',400);
  // Never grant access based on an unverified email or allow cross-organiser assignment.
  const user=await db()`select a.id from app_users a where lower(a.email)=${email} and a.account_status='active'
   and a.role!='platform_admin' and exists(select 1 from oauth_identities o where o.user_id=a.id and o.provider='google' and lower(o.provider_email)=${email}) limit 1`;
  if(!user[0])return fail('Staff must first sign in with the matching Google email before being assigned',409);
  if(user[0].id===access.user.id)return fail('Organiser already has full event access',409);
  if(scope==='selected'){
   const owned=await db()`select id from events where organiser_id=${access.user.id} and id=any(${selected}::uuid[])`;
   if(owned.length!==new Set(selected).size)return fail('Selected events must belong to you',403);
  }
  await db()`insert into offline_ticket_staff(organiser_id,user_id,permissions,scope,selected_event_ids,include_future,expires_at)
    values(${access.user.id},${user[0].id},${requested}::text[],${scope},${selected}::uuid[],${future},${expires?.toISOString()||null})
    on conflict(organiser_id,user_id) do update set permissions=excluded.permissions,scope=excluded.scope,selected_event_ids=excluded.selected_event_ids,
    include_future=excluded.include_future,expires_at=excluded.expires_at,revoked_at=null`;
  return ok({success:true,message:'Verified ticket staff access assigned'});
 }catch(e){return handleError(e)}
}
export async function DELETE(req:Request){
 try{
  const b=await payload(req),eventId=str(b.eventId,40),userId=str(b.userId,40);
  const access=await offlineAccess(eventId,'staff');
  if(!access||access.user.id!==access.event.organiser_id||!uuid.test(userId))return fail('Organiser ownership required',403);
  await db()`update offline_ticket_staff set revoked_at=now() where organiser_id=${access.user.id} and user_id=${userId}`;
  return ok({success:true});
 }catch(e){return handleError(e)}
}
