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
      (select count(*)::int from tickets) as tickets,
      (select count(*)::int from tickets where redeemed_at is not null) as checkins`;
    return ok({stats:rows[0]});
  }catch(e){return handleError(e)}
}
