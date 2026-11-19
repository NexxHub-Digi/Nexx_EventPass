import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok,handleError,payload,str} from '@/lib/http';
export const runtime='nodejs';
const uuid=(id:string)=>/^[0-9a-f-]{36}$/i.test(id);
async function admin(){const u=await currentUser();return u?.role==='platform_admin'&&u.account_status==='active'?u:null}
export async function GET(){
 try{
  const u=await admin();if(!u)return fail('Platform Administrator only',403);
  const events=await db()`select e.id,e.title,e.venue,e.description,e.category,e.ticket_theme,e.starts_at,e.status,e.verification_status,
   e.organiser_id,owner.full_name as organiser_name,owner.email as organiser_email,
   (select count(*)::int from event_media m where m.event_id=e.id and not m.approved) as pending_media
   from events e join app_users owner on owner.id=e.organiser_id
   where e.verification_status!='verified' or exists(select 1 from event_media m where m.event_id=e.id and not m.approved)
   order by e.created_at desc limit 150`;
  const media=await db()`select m.id,m.event_id,m.media_type,m.mime_type,m.file_name,m.approved
   from event_media m join events e on e.id=m.event_id where not m.approved
   order by m.created_at desc limit 200`;
  return ok({events,media:media.map(x=>({...x,url:'/api/events/media?id='+x.id}))});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{
  const u=await admin();if(!u)return fail('Platform Administrator only',403);
  const b=await payload(req),action=str(b.action,32),eventId=str(b.eventId,40),mediaId=str(b.mediaId,40);
  if(!uuid(eventId)||!['verify','reject','approve_media','reject_media'].includes(action))return fail('Invalid review action');
  const owned=await db()`select e.id,e.status,e.starts_at,owner.role as owner_role,owner.account_status from events e
   join app_users owner on owner.id=e.organiser_id where e.id=${eventId}`;
  if(!owned[0])return fail('Event not found',404);
  if(action==='verify'){
   if(owned[0].account_status!=='active'||owned[0].owner_role!=='organiser')return fail('Assign the event to an active organiser before publishing',409);
   if(new Date(owned[0].starts_at).getTime()<=Date.now())return fail('Cannot verify a past event',409);
   const pending=await db()`select count(*)::int as count from event_media where event_id=${eventId} and approved=false`;
   if(Number(pending[0]?.count)>0)return fail('Review every pending media asset before verifying the event',409);
   const published=await db().begin(async tx=>{
    const [event]=await tx`select e.price_ngn,a.status as bank_status from events e
      left join organiser_bank_accounts a on a.id=e.payment_account_id and a.organiser_id=e.organiser_id
      where e.id=${eventId} for update of e`;
    if(!event||(Number(event.price_ngn)>0&&event.bank_status!=='verified'))return false;
    await tx`update events set status='published',verification_status='verified',verified_by=${u.id},verified_at=now() where id=${eventId}`;
    await tx`insert into platform_admin_actions(admin_id,action,details) values(${u.id},'verify_event',${JSON.stringify({eventId})}::jsonb)`;
    return true;
   });
   if(!published)return fail('A verified organiser bank account is required to publish a paid event',409);
  }else if(action==='reject'){
   const outcome=await db().begin(async tx=>{
    await tx`select id from events where id=${eventId} for update`;
    const outstanding=await tx`select
      (exists(select 1 from tickets where event_id=${eventId}) or
       exists(select 1 from offline_tickets where event_id=${eventId} and status='issued')) as issued,
      exists(select 1 from ticket_orders where event_id=${eventId} and status='pending' and reservation_expires_at>now()) as reserved`;
    if(outstanding[0]?.issued||outstanding[0]?.reserved)return {blocked:true};
    await tx`update events set status='draft',verification_status='rejected',verified_by=null,verified_at=null where id=${eventId} and status!='cancelled'`;
    await tx`insert into platform_admin_actions(admin_id,action,details) values(${u.id},'reject_event',${JSON.stringify({eventId})}::jsonb)`;
    return {blocked:false};
   });
   if(outcome.blocked)return fail('Cannot unpublish with issued tickets or active reservations. Open a supervised cancellation and refund case.',409);
  }else{
   if(!uuid(mediaId))return fail('Media ID required');
   const result=action==='reject_media'
    ?await db()`delete from event_media where event_id=${eventId} and id=${mediaId} returning id`
    :await db()`update event_media set approved=true where event_id=${eventId} and id=${mediaId} returning id`;
   if(!result[0])return fail('Media not found for event',404);
   await db()`insert into platform_admin_actions(admin_id,action,details) values(${u.id},${action},${JSON.stringify({eventId,mediaId})}::jsonb)`;
  }
  return ok({success:true,action});
 }catch(e){return handleError(e)}
}
