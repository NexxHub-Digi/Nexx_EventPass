import { currentUser } from '@/lib/security';
import { db } from '@/lib/db';
import { encryptOrganiserKeyword } from '@/lib/qr-encryption';
import { fail, handleError, ok, payload, str } from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){
  try {
    const u=await currentUser();if(!u||u.account_status!=='active'||u.role!=='organiser')return fail('Active owning organiser required',403);
    const b=await payload(req);const eventId=str(b.eventId,40),keyword=str(b.qrKeyword,80);
    if(!/^[a-f0-9-]{36}$/i.test(eventId)||keyword.length<8)return fail('Valid event ID and private QR keyword required');
    const cipher=encryptOrganiserKeyword(eventId,keyword);
    const result=await db().begin(async tx=>{
      const existing=await tx`select id from events where id=${eventId} and organiser_id=${u.id} and qr_keyword_ciphertext is null for update`;
      if(!existing[0])return false;
      const issued=await tx`select id from tickets where event_id=${eventId} limit 1`;
      const offline=await tx`select id from offline_tickets where event_id=${eventId} limit 1`;
      // Never invalidate credentials from previously generated or distributed passes.
      if(issued[0]||offline[0])return false;
      await tx`update events set qr_keyword_ciphertext=${cipher} where id=${eventId}`;
      return true;
    });
    if(!result)return fail('Only the organiser can configure QR encryption, before tickets are issued',409);
    return ok({success:true});
  }catch(e){return handleError(e)}
}
