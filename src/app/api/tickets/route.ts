import { currentUser } from '@/lib/security';
import { fillMissingTicketCredentials } from '@/lib/ticket-credentials';
import { db } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
  try {const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const rows=await db()`select t.id,t.event_id,t.status,t.qr_credential,t.redeemed_at,t.created_at,d.created_at as delivered_at,d.status as delivery_status,e.title,e.venue,e.starts_at,coalesce(d.ticket_theme,e.ticket_theme) as ticket_theme,coalesce(d.admission_label,e.admission_label) as admission_label,coalesce(d.ticket_art_id,(select m.id from event_media m where m.event_id=e.id and m.media_type='ticket_art' and m.approved order by m.created_at asc limit 1)) as ticket_art_id,e.qr_keyword_ciphertext from tickets t join events e on e.id=t.event_id left join ticket_deliveries d on d.ticket_id=t.id where t.owner_id=${u.id} order by t.created_at desc limit 200`;
    const backfilled=await fillMissingTicketCredentials('tickets', rows
      .filter(t=>t.status==='issued' && !t.qr_credential)
      .map(t=>({id:t.id,eventId:t.event_id,keyword:t.qr_keyword_ciphertext})));
    return ok({tickets:rows.map(t=>({id:t.id,event_id:t.event_id,status:t.status,redeemed_at:t.redeemed_at,created_at:t.created_at,delivered_at:t.delivered_at,delivery_status:t.delivery_status,title:t.title,venue:t.venue,starts_at:t.starts_at,ticket_theme:t.ticket_theme,ticket_art_id:t.ticket_art_id,admission_label:t.admission_label,qr:t.status==='issued'?(t.qr_credential ?? backfilled.get(t.id) ?? null):null}))});
  }catch(e){return handleError(e);}
}
