import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,handleError,ok,payload} from '@/lib/http';

export const runtime='nodejs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const keys=['title','venue','startsAt','price','organiser','admission','holder','reference','notes'] as const;
type Key=(typeof keys)[number];
type Draft={mode:'ticket'|'qr'|'both';theme:string;fields:Record<Key,string>;enabled:Record<Key,boolean>};
function parseDraft(body:Record<string,unknown>):Draft|null{
 if(!['ticket','qr','both'].includes(String(body.mode))||typeof body.theme!=='string'||body.theme.length>32)return null;
 if(!body.fields||!body.enabled||typeof body.fields!=='object'||typeof body.enabled!=='object'||Array.isArray(body.fields)||Array.isArray(body.enabled))return null;
 const fields=body.fields as Record<string,unknown>,enabled=body.enabled as Record<string,unknown>;
 if(Object.keys(fields).length!==keys.length||Object.keys(enabled).length!==keys.length)return null;
 for(const key of keys){
  if(typeof fields[key]!=='string'||fields[key].length>(key==='notes'?1000:240)||typeof enabled[key]!=='boolean')return null;
 }
 return {mode:body.mode as Draft['mode'],theme:body.theme,fields:fields as Draft['fields'],enabled:enabled as Draft['enabled']};
}
export async function GET(req:Request){
 try{
  const u=await currentUser();
  if(!u||u.role!=='organiser'||u.account_status!=='active')return fail('Active organiser required',403);
  const eventId=new URL(req.url).searchParams.get('eventId')||'';
  if(!uuid.test(eventId))return fail('Valid event required',400);
  const rows=await db()`select d.id,d.event_id,d.version,d.mode,d.theme_id as theme,d.fields,d.enabled,d.created_at
    from event_ticket_design_versions d join events e on e.id=d.event_id
    where d.event_id=${eventId} and e.organiser_id=${u.id}
    order by d.version desc limit 1`;
  if(rows.length)return ok({draft:rows[0]});
  const owners=await db()`select 1 from events where id=${eventId} and organiser_id=${u.id} limit 1`;
  return owners.length?ok({draft:null}):fail('Event not found',404);
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{
  const u=await currentUser();
  if(!u||u.role!=='organiser'||u.account_status!=='active')return fail('Active organiser required',403);
  const body=await payload(req),eventId=String(body.eventId||''),draft=parseDraft(body);
  if(!uuid.test(eventId)||!draft)return fail('Choose an event and valid ticket preview fields',400);
  const result=await db().begin(async tx=>{
   const owned=await tx`select id from events where id=${eventId} and organiser_id=${u.id} for update`;
   if(!owned.length)return {error:'Event not found',status:404};
   const allowed=await tx`select can_create_events from organiser_capabilities where organiser_id=${u.id}`;
   if(allowed[0]?.can_create_events===false)return {error:'Event editing is restricted',status:403};
   const themes=await tx`select 1 from ticket_theme_catalog where id=${draft.theme} and active=true limit 1`;
   if(!themes.length)return {error:'Choose an available ticket theme',status:400};
   const [row]=await tx`insert into event_ticket_design_versions(event_id,version,theme_id,mode,fields,enabled,saved_by)
    select ${eventId},coalesce(max(version),0)+1,${draft.theme},${draft.mode},
      ${JSON.stringify(draft.fields)}::jsonb,${JSON.stringify(draft.enabled)}::jsonb,${u.id}
    from event_ticket_design_versions where event_id=${eventId}
    returning id,event_id,version,theme_id as theme,mode,fields,enabled,created_at`;
   return {draft:row};
  });
  return 'error' in result?fail(String(result.error),typeof result.status==='number'?result.status:400):ok(result,201);
 }catch(e){return handleError(e)}
}
