import { currentUser, qrToken } from '@/lib/security';
import { db } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
  try {const u=await currentUser();if(!u)return fail('Sign in required',401);
    const rows=await db()`select t.id,t.event_id,t.status,t.redeemed_at,t.created_at,e.title,e.venue,e.starts_at from tickets t join events e on e.id=t.event_id where t.owner_id=${u.id} order by t.created_at desc limit 200`;
    return ok({tickets:rows.map(t=>({...t,qr:t.status==='issued'?qrToken(t.id,t.event_id):null}))});
  }catch(e){return handleError(e);}
}
