import { currentUser } from '@/lib/security';
import { fillMissingTicketCredentials } from '@/lib/ticket-credentials';
import {ensureEntryCodes} from '@/lib/ticket-entry-code';
import { db } from '@/lib/db';
import { fail, handleError, ok } from '@/lib/http';
export const runtime='nodejs';
export async function GET(){
  try {const u=await currentUser();if(!u||u.account_status!=='active')return fail('Active account required',403);
    const rows=await db()`select t.id,t.event_id,t.status,t.qr_credential,t.redeemed_at,t.created_at,d.created_at as delivered_at,d.status as delivery_status,e.title,e.venue,e.starts_at,coalesce(d.ticket_theme,e.ticket_theme) as ticket_theme,coalesce(d.admission_label,e.admission_label) as admission_label,d.design_version,d.design_snapshot,coalesce(d.ticket_art_id,(select m.id from event_media m where m.event_id=e.id and m.media_type='ticket_art' and m.approved order by m.created_at asc limit 1)) as ticket_art_id,e.qr_keyword_ciphertext from tickets t join ticket_orders o on o.id=t.order_id
      join verified_order_payments p on p.order_id=o.id join events e on e.id=t.event_id
      left join ticket_deliveries d on d.ticket_id=t.id
      where t.owner_id=${u.id} and (o.status='approved' or (o.status='cancelled' and t.status='revoked')) order by t.created_at desc limit 200`;
    // A reference or receipt is never sufficient to release a ticket credential.
    const activeRows=rows.filter(t=>new Date(t.starts_at).getTime()>=Date.now()-86400000);
    const backfilled=await fillMissingTicketCredentials('tickets', activeRows
      .filter(t=>t.status==='issued' && !t.qr_credential)
      .map(t=>({id:t.id,eventId:t.event_id,keyword:t.qr_keyword_ciphertext})));
    const backupCodes=await ensureEntryCodes('online',activeRows.filter(t=>t.status==='issued').map(t=>({id:t.id,eventId:t.event_id})));
    return ok({tickets:rows.map(t=>({id:t.id,event_id:t.event_id,status:t.status,redeemed_at:t.redeemed_at,created_at:t.created_at,delivered_at:t.delivered_at,delivery_status:t.delivery_status,title:t.title,venue:t.venue,starts_at:t.starts_at,event_phase:new Date(t.starts_at).getTime()<Date.now()-86400000?'past':'current',ticket_theme:t.ticket_theme,ticket_art_id:t.ticket_art_id,admission_label:t.admission_label,design_version:t.design_version,design_snapshot:t.design_snapshot,entry_code:t.status==='issued'&&new Date(t.starts_at).getTime()>=Date.now()-86400000?(backupCodes.get(t.id)||null):null,
      qr:t.status==='issued'&&new Date(t.starts_at).getTime()>=Date.now()-86400000?(t.qr_credential ?? backfilled.get(t.id) ?? null):null}))});
  }catch(e){return handleError(e);}
}
