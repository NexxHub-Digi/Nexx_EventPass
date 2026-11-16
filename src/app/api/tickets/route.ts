import { currentUser, qrToken } from '@/lib/security';
import { createEncryptedQr } from '@/lib/qr-encryption';
import { db } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
  try {const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const rows=await db()`select t.id,t.event_id,t.status,t.redeemed_at,t.created_at,e.title,e.venue,e.starts_at,e.ticket_theme,(select m.id from event_media m where m.event_id=e.id and m.media_type='ticket_art' and m.approved order by m.created_at asc limit 1) as ticket_art_id,e.qr_keyword_ciphertext from tickets t join events e on e.id=t.event_id where t.owner_id=${u.id} order by t.created_at desc limit 200`;
    return ok({tickets:rows.map(t=>({id:t.id,event_id:t.event_id,status:t.status,redeemed_at:t.redeemed_at,created_at:t.created_at,title:t.title,venue:t.venue,starts_at:t.starts_at,ticket_theme:t.ticket_theme,ticket_art_id:t.ticket_art_id,qr:t.status==='issued'?(t.qr_keyword_ciphertext ? createEncryptedQr(t.id,t.event_id,t.qr_keyword_ciphertext) : qrToken(t.id,t.event_id)):null}))});
  }catch(e){return handleError(e);}
}
