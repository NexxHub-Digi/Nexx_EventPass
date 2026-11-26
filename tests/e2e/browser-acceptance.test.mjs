import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {SignJWT} from 'jose';
import {chromium} from 'playwright';

if(process.env.CI!=='true'||process.env.EVENTPASS_E2E!=='true'||!/@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL||''))throw Error('Browser acceptance requires isolated local E2E');
if(!process.env.AUTH_SECRET?.startsWith('ci-auth-test-only-'))throw Error('Only synthetic test signing secrets allowed');
const base='http://localhost:3210';
const evidence=process.env.EVENTPASS_BROWSER_EVIDENCE||'/tmp/eventpass-browser-acceptance';
const sql=postgres(process.env.DATABASE_URL,{ssl:false,prepare:false});
const tag=randomUUID().slice(0,8);
async function account(role,label){
 const [u]=await sql`insert into app_users(email,password_hash,full_name,role,account_status)
 values(${'browser-'+label+'-'+tag+'@example.invalid'},'not-a-login-password',${'Browser '+label},${role},'active') returning id`;
 const token=await new SignJWT({sub:u.id}).setProtectedHeader({alg:'HS256'}).setIssuer('nexx-eventpass').setAudience('eventpass')
  .setJti(randomUUID()).setIssuedAt().setExpirationTime('15m').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
 return {...u,token};
}
async function contextFor(browser,user,width){
 const ctx=await browser.newContext({viewport:{width,height:width<800?820:1000},deviceScaleFactor:1});
 if(user)await ctx.addCookies([{name:'eventpass_session',value:user.token,url:base,httpOnly:true,sameSite:'Lax'}]);
 await ctx.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 return ctx;
}
async function shot(page,name){await page.screenshot({path:join(evidence,name+'.png'),animations:'disabled'});}
async function visit(page,path){const res=await page.goto(base+path,{waitUntil:'domcontentloaded'});assert.ok(res&&res.status()<400,path+' failed');}
async function visible(locator){await locator.first().waitFor({state:'visible',timeout:20000});}
test('browser: four isolated role workspaces, responsive discovery and protected access', {timeout:180000},async()=>{
 let browser;
 try{
  await mkdir(evidence,{recursive:true});
  const user=await account('user','buyer'),owner=await account('organiser','owner'),gate=await account('user','gate'),admin=await account('platform_admin','admin');
  const title='Browser acceptance '+tag;
  const [event]=await sql`insert into events(organiser_id,title,slug,venue,starts_at,price_ngn,capacity,status,verification_status,visibility)
   values(${owner.id},${title},${'browser-'+tag},'Synthetic test venue',now()+interval '1 hour',0,50,'published','verified','public') returning id`;
  await sql`insert into gate_assignments(event_id,user_id,gate_label) values(${event.id},${gate.id},'Synthetic gate')`;
  browser=await chromium.launch({headless:true});
  for(const width of [320,390,768,1440]){
   const ctx=await contextFor(browser,user,width);
   try{
    const page=await ctx.newPage();
    await visit(page,'/login/user');
    await visible(page.getByRole('button',{name:'Switch portal'}));
    await page.getByRole('button',{name:'Switch portal'}).click();
    await visible(page.getByRole('navigation',{name:'Choose portal'}));
    await shot(page,'login-'+width);
    await visit(page,'/');
    await visible(page.getByRole('textbox',{name:'Search events'}));
    await page.getByRole('textbox',{name:'Search events'}).fill(title);
    const card=page.locator('article.card').filter({hasText:title});
    await visible(card);
    await card.getByRole('button',{name:'View event',exact:false}).click();
    const dialog=page.getByRole('dialog',{name:'Reserve event tickets'});
    await visible(dialog);
    await shot(page,'checkout-'+width);
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    await page.getByRole('textbox',{name:'Search events'}).fill('not-a-real-event-'+tag);
    await visible(page.getByRole('button',{name:'Clear filters'}));
    await page.getByRole('button',{name:'Clear filters'}).click();
    await visible(card);
    await shot(page,'discovery-'+width);
   }finally{await ctx.close()}
  }
  for(const [role,who,path,selector] of [
   ['organiser',owner,'/organiser','[data-portal="organiser"]'],
   ['gate',gate,'/gate','[data-portal="gate"]'],
   ['admin',admin,'/platform-admin','[data-portal="platform-admin"]']
  ]){
   for(const width of [390,1440]){
    const ctx=await contextFor(browser,who,width);
    try{
     const page=await ctx.newPage();await visit(page,path);
     await visible(page.locator(selector));await visible(page.getByRole('button',{name:'Sign out',exact:true}));
     if(role==='gate')await visible(page.locator('.rw-gate-event').filter({hasText:title}));
     if(role==='admin')await visible(page.getByRole('heading',{name:'Platform overview',exact:true}));
     await shot(page,role+'-'+width);
    }finally{await ctx.close()}
   }
  }
  const denied=await contextFor(browser,user,390);
  try{
   const page=await denied.newPage();
   for(const role of ['organiser','gate','platform-admin']){
    await visit(page,'/'+role);
    await page.waitForURL(url=>url.pathname==='/login/'+role,{timeout:20000});
    assert.equal(await page.locator('[data-portal="'+role+'"]').count(),0);
   }
  }finally{await denied.close()}
 }finally{if(browser)await browser.close();await sql.end()}
});
