import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,handleError,ok} from '@/lib/http';
export const runtime='nodejs';
const uuid=(x:string)=>/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(x);
export async function GET(req:Request){
 try{
  const u=await currentUser(),url=new URL(req.url),mediaId=url.searchParams.get('id')||'',eventId=url.searchParams.get('eventId')||'';
  if(mediaId){
   if(!uuid(mediaId))return fail('Invalid media',400);
   const results=await db()`select m.media_data,m.mime_type,m.file_name from event_media m
   join events e on e.id=m.event_id join app_users owner on owner.id=e.organiser_id
   where m.id=${mediaId} and ((e.status='published' and owner.account_status='active')
    or (e.organiser_id=${u?.id||null} and ${u?.role==='organiser'})
    or ${u?.role==='platform_admin'&&u?.account_status==='active'}) limit 1`;
   if(!results[0])return fail('Media not found',404);
   return new Response(new Uint8Array(results[0].media_data as Uint8Array),{headers:{
     'Content-Type':String(results[0].mime_type),'Cache-Control':'public, max-age=600',
     'Content-Disposition':'inline','X-Content-Type-Options':'nosniff',
     'Content-Security-Policy':"default-src 'none'; sandbox"
   }});
  }
  if(!uuid(eventId))return fail('Event ID required',400);
  const data=await db()`select m.id,m.event_id,m.media_type,m.mime_type,m.file_name,m.created_at
  from event_media m join events e on e.id=m.event_id join app_users owner on owner.id=e.organiser_id
  where e.id=${eventId} and ((e.status='published' and owner.account_status='active')
    or (e.organiser_id=${u?.id||null} and ${u?.role==='organiser'})
    or ${u?.role==='platform_admin'&&u?.account_status==='active'}) order by m.created_at asc limit 15`;
  return ok({media:data.map(x=>({...x,url:'/api/events/media?id='+x.id}))});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{
  const u=await currentUser();if(!u||u.role!=='organiser'||u.account_status!=='active')return fail('Active organiser required',403);
  const form=await req.formData(),eventId=String(form.get('eventId')||''),file=form.get('file');
  if(!uuid(eventId)||!(file instanceof File))return fail('Choose an event and media file',400);
  const allowed:Record<string,string>={'image/jpeg':'image','image/png':'image','image/webp':'image','video/mp4':'video','video/webm':'video'};
  const kind=allowed[file.type];
  if(!kind||file.size<32||file.size>(kind==='video'?8_000_000:2_000_000))return fail('Upload JPG, PNG or WebP (2 MB max), MP4 or WebM clips (8 MB max)',400);
  const bytes=Buffer.from(await file.arrayBuffer());
  const signature=(file.type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)
   ||(file.type==='image/png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
   ||(file.type==='image/webp'&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')
   ||(file.type==='video/mp4'&&bytes.toString('ascii',4,8)==='ftyp')
   ||(file.type==='video/webm'&&bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])));
  if(!signature)return fail('Media file content does not match its declared type',400);
  const entry=await db().begin(async tx=>{
   const e=await tx`select id from events where id=${eventId} and organiser_id=${u.id} for update`;
   if(!e[0])return {error:'Only the owning organiser can upload media',status:403};
   const used=await tx`select count(*)::int as items,coalesce(sum(octet_length(media_data)),0)::bigint as bytes from event_media where event_id=${eventId}`;
   if(Number(used[0].items)>=12||Number(used[0].bytes)+bytes.length>24_000_000)return {error:'Event media limit reached (12 files, 24 MB total)',status:409};
   const inserted=await tx`insert into event_media(event_id,media_type,mime_type,media_data,file_name) values
    (${eventId},${kind},${file.type},${bytes},${file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120)}) returning id,media_type`;
   return {media:inserted[0]};
  });
  if('error' in entry)return fail(String(entry.error),Number(entry.status));
  return ok(entry,201);
 }catch(e){return handleError(e)}
}
export async function DELETE(req:Request){
 try{
  const u=await currentUser();if(!u||u.role!=='organiser'||u.account_status!=='active')return fail('Active organiser required',403);
  const body=await req.json(),mediaId=String(body.id||'');
  if(!uuid(mediaId))return fail('Invalid media',400);
  const deleted=await db()`delete from event_media m using events e where m.id=${mediaId} and e.id=m.event_id and e.organiser_id=${u.id} returning m.id`;
  return deleted[0]?ok({success:true}):fail('Media not found',404);
 }catch(e){return handleError(e)}
}
