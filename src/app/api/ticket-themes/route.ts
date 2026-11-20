import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,handleError,ok,payload,str} from '@/lib/http';
export const runtime='nodejs';
const hex=(v:string)=>/^#[a-fA-F0-9]{6}$/.test(v);
const themeId=(id:string)=>/^[a-z0-9][a-z0-9-]{2,39}$/.test(id);
const activeAdmin=(u:Awaited<ReturnType<typeof currentUser>>)=>Boolean(u&&u.role==='platform_admin'&&u.account_status==='active');
const format=(t:Record<string,unknown>)=>({...t,gradient:`linear-gradient(135deg,${t.color_a},${t.color_b})`});
export async function GET(req:Request){
 try{
  const includeInactive=new URL(req.url).searchParams.get('includeInactive')==='true';
  if(includeInactive&&!activeAdmin(await currentUser()))return fail('Platform Administrator required to view archived themes',403);
  const rows=await db()`select id,name,label,color_a,color_b,accent,active from ticket_theme_catalog
   where (${includeInactive} or active=true)
   order by active desc,case when id='custom' then 1 else 0 end,created_at asc`;
  return ok({themes:rows.map(t=>format(t))});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{
  const u=await currentUser();if(!activeAdmin(u))return fail('Platform Admin only',403);
  const b=await payload(req),name=str(b.name,80),label=str(b.label,50),a=str(b.colorA,7),c=str(b.colorB,7),accent=str(b.accent,7);
  if(name.length<3||!label||![a,c,accent].every(hex))return fail('Provide a theme name, label and three HEX colours',400);
  const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,27);
  if(slug.length<3)return fail('Invalid theme name',400);
  const created=await db().begin(async tx=>{
   const [row]=await tx`insert into ticket_theme_catalog(id,name,label,color_a,color_b,accent,created_by)
    values(${slug+'-'+crypto.randomUUID().slice(0,5)},${name},${label},${a},${c},${accent},${u!.id})
    returning id,name,label,color_a,color_b,accent,active`;
   await tx`insert into platform_admin_actions(admin_id,action,details)
    values(${u!.id},'ticket_theme_created',${tx.json({themeId:row.id,name})})`;
   return row;
  });
  return ok({theme:format(created)},201);
 }catch(e){return handleError(e)}
}
export async function PATCH(req:Request){
 try{
  const u=await currentUser();if(!activeAdmin(u))return fail('Platform Admin only',403);
  const b=await payload(req),id=str(b.id,45),action=str(b.action,20);
  if(!themeId(id)||!['edit','archive','reactivate'].includes(action))return fail('Choose a valid theme and action',400);
  const name=str(b.name,80),label=str(b.label,50),a=str(b.colorA,7),c=str(b.colorB,7),accent=str(b.accent,7);
  if(action==='edit'&&(name.length<3||!label||![a,c,accent].every(hex)))return fail('Provide a theme name, label and three valid HEX colours',400);
  const result=await db().begin(async tx=>{
   const [previous]=await tx`select id,name,label,color_a,color_b,accent,active from ticket_theme_catalog where id=${id} for update`;
   if(!previous)return {error:'Ticket theme not found',status:404};
   if(action==='archive'&&!previous.active||action==='reactivate'&&previous.active)
    return {error:'Theme is already in the requested status',status:409};
   if(action==='edit'&&!previous.active)return {error:'Reactivate this theme before editing',status:409};
   if(action!=='reactivate'){
    const [usage]=await tx`select
     (select count(*)::int from events where ticket_theme=${id}) as events,
     (select count(*)::int from event_ticket_design_versions where theme_id=${id}) as drafts,
     (select count(*)::int from ticket_deliveries where ticket_theme=${id}) as deliveries,
     (select count(*)::int from offline_ticket_batches where ticket_theme=${id}) as offline_batches`;
    if(Object.values(usage).some(n=>Number(n)>0))
     return {error:'Theme already belongs to an event, draft or issued ticket. Create a new version to preserve historical designs.',status:409};
   }
   const [row]=action==='edit'?await tx`update ticket_theme_catalog
    set name=${name},label=${label},color_a=${a},color_b=${c},accent=${accent}
    where id=${id} returning id,name,label,color_a,color_b,accent,active`:
    await tx`update ticket_theme_catalog set active=${action==='reactivate'} where id=${id}
     returning id,name,label,color_a,color_b,accent,active`;
   await tx`insert into platform_admin_actions(admin_id,action,details)
    values(${u!.id},${'ticket_theme_'+action},
      ${tx.json({themeId:id,action,previous:{name:previous.name,label:previous.label,colors:[previous.color_a,previous.color_b,previous.accent],active:previous.active},next:action==='edit'?{name,label,colors:[a,c,accent]}:{active:row.active}})})`;
   return {theme:format(row)};
  });
  return 'error' in result?fail(String(result.error),Number(result.status)):ok(result);
 }catch(e){return handleError(e)}
}
