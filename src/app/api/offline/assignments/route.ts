import { db } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/http';
import { currentUser } from '@/lib/security';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user || user.account_status !== 'active') return fail('Sign in with an active account', 403);
    const events = await db()`
      select e.id,e.title,e.organiser_id,s.permissions,s.expires_at
      from offline_ticket_staff s
      join events e on e.organiser_id=s.organiser_id
      join app_users owner on owner.id=e.organiser_id
      where s.user_id=${user.id} and s.revoked_at is null
        and (s.expires_at is null or s.expires_at>now())
        and owner.role='organiser' and owner.account_status='active'
        and ((s.scope='all' and (s.include_future or e.created_at<=s.created_at))
          or (s.scope='selected' and e.id=any(s.selected_event_ids)))
      order by e.starts_at desc,e.id`;
    return ok({ events });
  } catch (error) {
    return handleError(error);
  }
}
