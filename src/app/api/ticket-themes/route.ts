import {currentUser} from '@/lib/security';
import {db} from '@/lib/db';
import {fail,handleError,ok,payload,str} from '@/lib/http';
export const runtime='nodejs';
const hex=(v:string)=>/^#[a-fA-F0-9]{6}$/.test(v);
export async function GET(){
 try{
  const rows=await db()`select id,name,label,color_a,color_b,accent from ticket_theme_catalog where active=true order by case when id='custom' then 1 else 0 end,created_at asc`;
  return ok({themes:rows.map(t=>({...t,gradient:`linear-gradient(135deg,${t.color_a},${t.color_b})`}))});
 }catch(e){return handleError(e)}
}
export async function POST(req:Request){
 try{
  const u=await currentUser();if(!u||u.role!=='platform_admin'||u.account_status!=='active')return fail('Platform Admin only',403);
  const b=await payload(req),name=str(b.name,80),label=str(b.label,50),a=str(b.colorA,7),c=str(b.colorB,7),accent=str(b.accent,7);
  if(name.length<3||!label||![a,c,accent].every(hex))return fail('Provide a theme name, label and three HEX colours',400);
  const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,27);
  if(slug.length<3)return fail('Invalid theme name',400);
  const created=await db()`insert into ticket_theme_catalog(id,name,label,color_a,color_b,accent,created_by)
   values(${slug+'-'+crypto.randomUUID().slice(0,5)},${name},${label},${a},${c},${accent},${u.id}) returning id,name,label,color_a,color_b,accent`;
  return ok({theme:created[0]},201);
 }catch(e){return handleError(e)}
}
