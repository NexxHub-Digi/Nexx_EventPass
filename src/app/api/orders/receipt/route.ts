import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,handleError,ok} from '@/lib/http';
export const runtime='nodejs';
const types=['image/png','image/jpeg','image/webp','application/pdf'];
export async function POST(req:Request){
 try{const u=await currentUser();if(!u||u.account_status!=='active')return fail('Sign in required',401);
  const form=await req.formData(),orderId=String(form.get('orderId')||''),file=form.get('receipt');
  if(!/^[a-f0-9-]{36}$/i.test(orderId)||!(file instanceof File)||!types.includes(file.type)||file.size<50||file.size>2_000_000)return fail('Upload PNG, JPG, WebP or PDF proof (up to 2 MB)',400);
  const contents=Buffer.from(await file.arrayBuffer());if(contents.length>2_000_000)return fail('Receipt too large',400);
  const isPng=contents.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const isJpeg=contents[0]===255&&contents[1]===216&&contents[2]===255;
  const isWebp=contents.toString('ascii',0,4)==='RIFF'&&contents.toString('ascii',8,12)==='WEBP';
  const isPdf=contents.toString('ascii',0,5)==='%PDF-';
  const verifiedMime=(file.type==='image/png'&&isPng)||(file.type==='image/jpeg'&&isJpeg)||
    (file.type==='image/webp'&&isWebp)||(file.type==='application/pdf'&&isPdf);
  if(!verifiedMime)return fail('Receipt content does not match its file type',400);
  const rows=await db()`update ticket_orders set receipt_data=${contents},receipt_mime=${file.type},receipt_uploaded_at=now(),reservation_expires_at=now()+interval '24 hours' where id=${orderId} and buyer_id=${u.id} and status='pending' and reservation_expires_at>now() returning id`;
  if(!rows[0])return fail('Active reservation required; expired payments need organiser refund review',409);
  return ok({success:true});
 }catch(e){return handleError(e)}
}
export async function GET(req:Request){
 try{const u=await currentUser();if(!u||u.account_status!=='active')return fail('Sign in required',401);
 const id=new URL(req.url).searchParams.get('orderId')||'';
 if(!/^[a-f0-9-]{36}$/i.test(id))return fail('Invalid order');
 const row=await db()`select o.receipt_data,o.receipt_mime from ticket_orders o join events e on e.id=o.event_id
 where o.id=${id} and (o.buyer_id=${u.id} or (e.organiser_id=${u.id} and ${u.role}='organiser') or ${u.role}='platform_admin') limit 1`;
 if(!row[0]?.receipt_data)return fail('Receipt not available',404);
 const content=row[0].receipt_data as Uint8Array;
 return new Response(new Uint8Array(content),{headers:{'Content-Type':String(row[0].receipt_mime||'application/octet-stream'),'Content-Disposition':'inline; filename="receipt"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return handleError(e)}
}
