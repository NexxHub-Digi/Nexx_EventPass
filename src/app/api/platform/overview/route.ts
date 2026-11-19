import { currentUser } from '@/lib/security';
import { db } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/http';
export const runtime='nodejs';
export async function GET() {
  try {
    const user=await currentUser();
    if (!user || user.role!=='platform_admin'||user.account_status!=='active') return fail('Platform administrator access required',403);
    const rows=await db()`select
      (select count(*)::int from app_users) as users,
      (select count(*)::int from events) as events,
      (select count(*)::int from ticket_orders) as orders,
      ((select count(*)::int from tickets where status='issued') +
       (select count(*)::int from offline_tickets where status='issued')) as tickets,
      ((select count(*)::int from tickets where redeemed_at is not null) +
       (select count(*)::int from offline_tickets where redeemed_at is not null)) as checkins,
      (select count(*)::int from tickets where status='issued') as online_tickets,
      (select count(*)::int from offline_tickets where status='issued') as offline_tickets,
      (select count(*)::int from tickets where redeemed_at is not null) as online_checkins,
      (select count(*)::int from offline_tickets where redeemed_at is not null) as offline_checkins,
      (select count(*)::int from ticket_orders where status='pending' and reservation_expires_at > now()) as active_reservations,
      (select count(*)::int from organiser_bank_accounts where status='pending') as pending_bank_reviews,
      (select count(*)::int from ticket_orders where refund_status in ('review_required','initiated')) as unresolved_refunds`;
    return ok({stats:rows[0]});
  }catch(e){return handleError(e)}
}
