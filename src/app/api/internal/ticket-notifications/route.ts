import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendTicketNotice } from '@/lib/ticket-notification-email';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const digest=(value:string)=>createHash('sha256').update(value).digest();
const reply=(status:number,body:object)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function dispatch(req:Request){
  const secret=process.env.EVENTPASS_NOTIFICATION_SECRET||'';
  if(secret.length<32||!timingSafeEqual(digest(req.headers.get('authorization')||''),digest('Bearer '+secret)))return reply(403,{error:'Forbidden'});
  const apiKey=process.env.RESEND_API_KEY,from=process.env.EVENTPASS_EMAIL_FROM;
  if(process.env.EVENTPASS_TICKET_EMAIL_ENABLED!=='true'||process.env.EVENTPASS_EMAIL_SENDER_VERIFIED!=='true'||!process.env.RESEND_WEBHOOK_SECRET||!apiKey||!from)return reply(503,{error:'Ticket email delivery is disabled'});
  try{
    const sql=db(),claim=randomUUID();
    await sql`update ticket_email_outbox set state='failed',completed_at=now(),last_result='retry_window_closed'
      where state in ('pending','sending') and (lease_until is null or lease_until<now())
      and (attempts>=5 or first_attempt_at<now()-interval '12 hours' or created_at<now()-interval '12 hours')`;
    const rows=await sql`with due as (
      select order_id from ticket_email_outbox
      where (state='pending' or (state='sending' and lease_until<now()))
      and next_attempt_at<=now() and attempts<5 and created_at>=now()-interval '12 hours'
      and (first_attempt_at is null or first_attempt_at>=now()-interval '12 hours')
      order by next_attempt_at,order_id limit 4 for update skip locked
    ) update ticket_email_outbox q set state='sending',claim_token=${claim},lease_until=now()+interval '2 minutes',
      attempts=q.attempts+1,first_attempt_at=coalesce(q.first_attempt_at,now())
      from due where q.order_id=due.order_id returning q.order_id,q.recipient_id,q.event_id,q.attempts`;
    let accepted=0,skipped=0,failed=0,retry=0;
    for(const row of rows){
      const [recipient]=await sql`select u.email from app_users u
        join oauth_identities i on i.user_id=u.id and i.provider='google' and lower(i.provider_email)=lower(u.email)
        join ticket_orders o on o.buyer_id=u.id and o.id=${row.order_id} and o.event_id=${row.event_id}
        join verified_order_payments p on p.order_id=o.id join events e on e.id=o.event_id
        where u.id=${row.recipient_id} and u.account_status='active' and o.status='approved'
        and e.status='published' and e.verification_status='verified' and e.starts_at>=now()-interval '4 hours'
        and exists(select 1 from tickets t where t.order_id=o.id and t.owner_id=u.id and t.status='issued')`;
      let result:Awaited<ReturnType<typeof sendTicketNotice>>|null=null;
      if(recipient){
        const to=String(recipient.email);
        const fingerprint=createHash('sha256').update(JSON.stringify(['ticket-notice-v1',from,to])).digest('hex');
        const bound=await sql`update ticket_email_outbox set request_fingerprint=${fingerprint}
          where order_id=${row.order_id} and claim_token=${claim} and state='sending'
          and (request_fingerprint is null or request_fingerprint=${fingerprint}) returning order_id`;
        result=bound.length?await sendTicketNotice({apiKey,from,to,orderId:String(row.order_id)}):{kind:'failed'};
      }
      const state=!result?'skipped':result.kind==='accepted'?'accepted':result.kind==='failed'||Number(row.attempts)>=5?'failed':'pending';
      const providerId=result?.kind==='accepted'?result.id:null;
      const updated=await sql`update ticket_email_outbox set state=${state},provider_id=${providerId},
        completed_at=case when ${state}='pending' then null else now() end,
        next_attempt_at=now()+interval '5 minutes',lease_until=null,claim_token=null,last_result=${result?.kind||'ineligible'}
        where order_id=${row.order_id} and claim_token=${claim} and state='sending' returning order_id`;
      if(updated.length){if(state==='accepted')accepted++;else if(state==='skipped')skipped++;else if(state==='failed')failed++;else retry++;}
    }
    return reply(200,{claimed:rows.length,accepted,skipped,failed,retry});
  }catch{return reply(503,{error:'Ticket notification processing unavailable'});}
}
export const POST=dispatch;
export const GET=dispatch;
