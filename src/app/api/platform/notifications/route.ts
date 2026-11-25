import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,ok} from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
 try{
  const u=await currentUser();
  if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform administrator access required',403);
  const rows=await db()`select status,count(*)::int as total from (
    select case when q.state='accepted' then coalesce(replace(w.event_type,'email.',''),'accepted') else q.state end as status
    from ticket_email_outbox q
    left join lateral(select event_type from ticket_email_webhook_events where provider_id=q.provider_id
      order by case when event_type in ('email.complained','email.bounced','email.failed','email.suppressed','email.delivered') then 1 else 0 end desc,
      occurred_at desc,case event_type when 'email.complained' then 3 when 'email.bounced' then 2 when 'email.delivered' then 0 else 1 end desc,webhook_id desc limit 1) w on true
  ) summary group by status`;
  const [health]=await db()`select
   (select count(*)::int from ticket_email_outbox where state='sending' and lease_until<now()) as expired_leases,
   (select count(*)::int from ticket_email_webhook_events w where not exists(select 1 from ticket_email_outbox q where q.provider_id=w.provider_id)) as unmatched_events,
   (select max(received_at) from ticket_email_webhook_events) as last_webhook_at,
   (select min(created_at) from ticket_email_outbox where state in ('pending','sending')) as oldest_pending_at`;
  return ok({counts:Object.fromEntries(rows.map(r=>[r.status,Number(r.total)])),health,
    enabled:process.env.EVENTPASS_TICKET_EMAIL_ENABLED==='true',configured:Boolean(process.env.RESEND_API_KEY&&process.env.EVENTPASS_EMAIL_FROM&&process.env.RESEND_WEBHOOK_SECRET&&process.env.EVENTPASS_EMAIL_SENDER_VERIFIED==='true'&&(process.env.EVENTPASS_NOTIFICATION_SECRET||'').length>=32)});
 }catch{return fail('Notification monitoring unavailable',503)}
}
