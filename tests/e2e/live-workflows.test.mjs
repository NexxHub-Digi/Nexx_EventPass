import test from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
if(process.env.CI!=='true'||process.env.EVENTPASS_E2E!=='true'||!/@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL||''))throw Error('Refusing to run E2E outside isolated local CI');
const sql=postgres(process.env.DATABASE_URL,{ssl:false,prepare:false});
const base='http://127.0.0.1:3210', tag=randomUUID().slice(0,8),password='EventPass-E2E-Password-123456789!';
const email=name=>'e2e-'+name+'-'+tag+'@example.invalid';
async function req(path,{cookie,bearer,method='GET',body,form}={}){
 const resp=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(bearer?{Authorization:'Bearer '+bearer}:{}),...(!form&&body?{'Content-Type':'application/json'}:{})},body:form||(body?JSON.stringify(body):undefined)});
 let data;try{data=await resp.json()}catch{data=null}
 return {status:resp.status,data,cookie:resp.headers.get('set-cookie')?.split(';')[0]};
}
function expect(r,n,label){assert.equal(r.status,n,label+': '+JSON.stringify(r.data));return r.data;}
const post=(path,cookie,body)=>req(path,{cookie,method:'POST',body});
async function signUp(name,portal='user'){
 // CI fixture creates pre-existing password accounts. Public sign-up is Google only.
 const hash=await bcrypt.hash(password,10);
 const rows=await sql.unsafe('insert into app_users(email,password_hash,full_name,role,account_status,requested_role) values($1,$2,$3,$4,$5,$6) returning id',
  [email(name),hash,'Test '+name,'user','active',portal==='organiser'?'organiser':null]);
 const r=await post('/api/auth/login',null,{portal,email:email(name),password});
 expect(r,200,'fixture login '+name);
 assert.ok(r.cookie?.includes('eventpass_session='));
 return {id:rows[0].id,cookie:r.cookie,email:email(name),token:r.data.token};
}
test('HTTP E2E: signup, approval, bank, payment evidence, QR, invitation, atomic scan and suspension',async()=>{
 try{
  const admin=await signUp('admin'),org=await signUp('organiser','organiser'),buyer=await signUp('buyer'),wrong=await signUp('wrong');
  expect(await post('/api/auth/register',null,{portal:'user',email:email('new'),password,fullName:'New User'}),403,'password sign-up disabled');
  for(const [portal,label] of [['user','User'],['organiser','Event Organiser'],['gate','Gate Operator'],['platform-admin','Platform Administrator']]){
    const page=await fetch(base+'/login/'+portal);
    assert.equal(page.status,200,'dedicated '+label+' sign-in route');
    assert.ok((await page.text()).includes(label),'role title on '+portal+' sign-in page');
  }
  assert.equal(expect(await req('/api/auth/me',{cookie:org.cookie}),200,'organiser pending').user.requested_role,'organiser');
  expect(await post('/api/events',org.cookie,{title:'Denied',venue:'E2E',startsAt:new Date(Date.now()+3600000),capacity:1,priceNgn:5000,qrKeyword:'secrettest123'}),403,'unapproved organiser');
  await sql.unsafe('update app_users set role=$1 where id=$2',['platform_admin',admin.id]);
  const adminLogin=await post('/api/auth/login',null,{portal:'platform_admin',email:admin.email,password});
  const adminCookie=expect(adminLogin,200,'admin login')&&adminLogin.cookie;
  assert.ok(adminCookie);
  assert.ok(expect(await req('/api/platform/organisers',{cookie:adminCookie}),200,'admin directory').organisers.some(x=>x.id===org.id));
  expect(await post('/api/platform/organisers',adminCookie,{action:'approve',userId:org.id}),200,'approve organiser');
  assert.equal(expect(await req('/api/auth/me',{cookie:org.cookie}),200,'approved role').user.role,'organiser');
  expect(await post('/api/ticket-themes',wrong.cookie,{name:'Unauthorized Glow',label:'No',colorA:'#123456',colorB:'#456789',accent:'#ffffff'}),403,'only Admin may publish ticket themes');
  const dynamicTheme=expect(await post('/api/ticket-themes',adminCookie,{name:'E2E Ocean Glow',label:'Concert',colorA:'#1450aa',colorB:'#00baa1',accent:'#ffffff'}),201,'Admin adds ticket theme').theme;
  assert.ok(expect(await req('/api/ticket-themes'),200,'public ticket theme catalogue').themes.some(t=>t.id===dynamicTheme.id));
  expect(await req('/api/auth/google?portal=gate&client=native'),400,'native OAuth requires PKCE challenge');
    const date=new Date(Date.now()+3600000).toISOString();
  const event=expect(await post('/api/events',org.cookie,{title:'E2E Test Event',venue:'E2E Venue',startsAt:date,capacity:2,priceNgn:5000,qrKeyword:'private-test-keyword'}),201,'create event').event;
  assert.equal(event.status,'draft','new event cannot auto-publish');
  assert.equal(event.verification_status,'pending','new event requires verification');
  assert.ok(!expect(await req('/api/events'),200,'pre-review discovery').events.some(x=>x.id===event.id),'unreviewed event hidden');
  const artwork=new Uint8Array(90);artwork.set([137,80,78,71,13,10,26,10]);
  const mediaForm=new FormData();mediaForm.set('eventId',event.id);mediaForm.set('file',new Blob([artwork],{type:'image/png'}),'event-poster.png');
  const uploaded=expect(await req('/api/events/media',{cookie:org.cookie,method:'POST',form:mediaForm}),201,'organiser uploads event poster');
  const artworkId=uploaded.media.id;
  assert.equal(expect(await req('/api/events/media?eventId='+event.id),200,'hidden media').media.length,0,'public cannot see unverified media');
  expect(await post('/api/orders',buyer.cookie,{eventId:event.id,quantity:1,paymentReference:'UNVERIFIED-123'}),400,'unverified listing cannot sell tickets');
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,action:'verify'}),409,'event cannot auto-approve unreviewed media');
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,mediaId:artworkId,action:'approve_media'}),200,'admin separately approves artwork');
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,action:'verify'}),200,'admin verifies event listing');
  assert.ok(expect(await req('/api/events'),200,'post-verification discovery').events.some(x=>x.id===event.id),'verified event published');
  assert.equal(expect(await req('/api/events/media?eventId='+event.id),200,'approved gallery').media.length,1);
    expect(await post('/api/orders',buyer.cookie,{eventId:event.id,quantity:1,paymentReference:'E2E-TRANSFER-123'}),409,'paid event requires bank');
  expect(await post('/api/organiser/payment-account',org.cookie,{bankName:'E2E Test Bank',accountName:'E2E Organiser',accountNumber:'0123456789'}),200,'bank details');
  expect(await post('/api/platform/organisers',adminCookie,{action:'configure',userId:org.id,fullName:'E2E Approved Organiser',bankName:'E2E Test Bank',accountName:'E2E Organiser',accountNumber:'0123456789'}),200,'admin profile configuration');
  assert.ok(expect(await req('/api/platform/organisers',{cookie:adminCookie}),200,'admin profile after configuration').organisers.some(x=>x.id===org.id&&x.full_name==='E2E Approved Organiser'&&x.account_number==='0123456789'));
  assert.ok(expect(await req('/api/events'),200,'discover event').events.some(e=>e.id===event.id&&e.bank_account_number==='0123456789'));
  const order=expect(await post('/api/orders',buyer.cookie,{eventId:event.id,quantity:1,paymentReference:'E2E-TRANSFER-123'}),201,'create order').order;
  expect(await post('/api/review',org.cookie,{orderId:order.id,decision:'approved'}),409,'no receipt cannot approve');
  expect(await post('/api/review',wrong.cookie,{orderId:order.id,decision:'approved'}),403,'unauthorised approval');
  const bytes=new Uint8Array(90);bytes.set([137,80,78,71,13,10,26,10]);
  const form=new FormData();form.set('orderId',order.id);form.set('receipt',new Blob([bytes],{type:'image/png'}),'test.png');
  expect(await req('/api/orders/receipt',{cookie:buyer.cookie,method:'POST',form}),200,'receipt submission');
  expect(await req('/api/orders/receipt?orderId='+order.id,{cookie:wrong.cookie}),404,'receipt privacy');
  expect(await post('/api/review',org.cookie,{orderId:order.id,decision:'approved'}),200,'organiser payment verification');
  expect(await post('/api/review',org.cookie,{orderId:order.id,decision:'approved'}),409,'prevent double approval');
  const tickets=expect(await req('/api/tickets',{cookie:buyer.cookie}),200,'ticket wallet').tickets;
  const ticket=tickets.find(t=>t.event_id===event.id);assert.ok(ticket?.qr?.startsWith('EVP2.'));
  expect(await req('/api/events',{cookie:org.cookie}),200,'organiser can view event');
  expect(await req('/api/events/media?id='+artworkId),200,'verified public poster can be loaded');
  expect(await req('/api/events/media?id='+artworkId,{cookie:wrong.cookie}),200,'verified poster can be displayed by Users');
  expect(await req('/api/events/media?eventId='+event.id,{cookie:wrong.cookie}),200,'verified media gallery');
  expect(await req('/api/events',{cookie:buyer.cookie}),200,'buyer can discover approved listings');
  expect(await req('/api/events/media?eventId='+event.id,{cookie:org.cookie}),200,'organiser media collection');
  expect(await req('/api/events',{cookie:wrong.cookie}),200,'other User can browse multiple organisers');
  expect(await req('/api/events/media?id='+artworkId,{cookie:buyer.cookie}),200,'User can see media');
  expect(await req('/api/events',{cookie:adminCookie}),200,'admin can inspect events');
  expect(await req('/api/events',{cookie:buyer.cookie}),200,'public discovery remains available');
  expect(await req('/api/tickets',{cookie:buyer.cookie}),200,'tickets still in wallet');
  expect(await req('/api/events',{cookie:org.cookie}),200,'organiser event status readable');
  expect(await req('/api/events',{cookie:buyer.cookie}),200,'verified event listed');
  expect(await req('/api/events',{cookie:wrong.cookie}),200,'public browsing');
  expect(await req('/api/events/media?eventId='+event.id,{cookie:buyer.cookie}),200,'media remains public');
  expect(await req('/api/events',{cookie:org.cookie}),200,'own event readable');
  expect(await post('/api/events',org.cookie,{eventId:event.id,description:'Edit',category:'Music',ticketTheme:'aurora'}),400,'creating without required fields fails');
  expect(await req('/api/events'),200,'discovery remains operational');
  expect(await req('/api/events/media?id='+artworkId),200,'approved image remains accessible');
  expect(await req('/api/events',{cookie:buyer.cookie}),200,'verified event stays browsable');
    const gateEmail=email('operator');
  const invite=expect(await post('/api/gates',org.cookie,{eventId:event.id,email:gateEmail,gateLabel:'Main Gate'}),200,'invite any email');
  const token=new URL(invite.invitationLink).searchParams.get('token');assert.equal(token?.length,43);
  expect(await post('/api/gates/accept',wrong.cookie,{token}),403,'wrong invitee');
  const operator=await signUp('operator');assert.equal(operator.email,gateEmail);
  await sql.unsafe('insert into oauth_identities(provider,provider_sub,user_id,provider_email) values($1,$2,$3,$4)', ['google','ci-gate-'+tag,operator.id,operator.email]);
  expect(await post('/api/gates/accept',operator.cookie,{token}),200,'accept invitation');
  expect(await post('/api/gates/accept',operator.cookie,{token}),410,'single-use token');
  assert.ok(expect(await req('/api/auth/me',{cookie:operator.cookie}),200,'gate portal').portals.includes('gate'));
  const scans=await Promise.all([post('/api/scan',operator.cookie,{eventId:event.id,code:ticket.qr}),post('/api/scan',operator.cookie,{eventId:event.id,code:ticket.qr})]);
  assert.deepEqual(scans.map((r,i)=>expect(r,200,'concurrent scan '+i).outcome).sort(),['approved','duplicate']);
  const history=expect(await req('/api/gates/activity?eventId='+event.id,{cookie:operator.cookie}),200,'gate log');
  assert.equal(Number(history.stats.admitted),1);assert.equal(Number(history.stats.duplicates),1);
  const otherEvent=expect(await post('/api/events',org.cookie,{title:'E2E Other Event',venue:'E2E Other Venue',startsAt:date,capacity:3,priceNgn:0,qrKeyword:'other-private-keyword',ticketTheme:dynamicTheme.id}),201,'second event').event;
  expect(await post('/api/platform/events',adminCookie,{eventId:otherEvent.id,action:'verify'}),200,'verify second event');
  expect(await post('/api/gates',org.cookie,{eventId:otherEvent.id,email:wrong.email,gateLabel:'Other Gate',mode:'add'}),409,'unverified direct addition rejected');
  expect(await post('/api/gates',org.cookie,{eventId:otherEvent.id,email:operator.email,gateLabel:'Other Gate',mode:'add'}),200,'existing verified operator added');
  assert.equal(expect(await post('/api/scan',operator.cookie,{eventId:otherEvent.id,code:ticket.qr}),200,'wrong-event QR').outcome,'wrong_event');
  expect(await req('/api/gates',{method:'DELETE',cookie:org.cookie,body:{eventId:event.id,email:operator.email}}),200,'revoke gate');
  expect(await post('/api/scan',operator.cookie,{eventId:event.id,code:ticket.qr}),403,'revoked gate denied');
  expect(await post('/api/platform/organisers',adminCookie,{action:'suspend',userId:org.id}),200,'suspend organiser');
  expect(await post('/api/events',org.cookie,{title:'Nope',venue:'E2E',startsAt:date,capacity:1,priceNgn:0,qrKeyword:'secrettest123'}),403,'suspended organiser');
  expect(await post('/api/platform/organisers',adminCookie,{action:'restore',userId:org.id}),200,'restore organiser');
  const nativeCode=randomBytes(32).toString('base64url');
  const nativeVerifier=randomBytes(32).toString('hex');const nativeChallenge=createHash('sha256').update(nativeVerifier).digest('hex');
  await sql.unsafe('insert into mobile_auth_codes(code_hash,user_id,client,expires_at,code_challenge) values($1,$2,$3,now()+interval \'2 minutes\',$4)',
  [createHash('sha256').update(nativeCode).digest('hex'),buyer.id,'user',nativeChallenge]);
  expect(await post('/api/auth/mobile',null,{code:nativeCode,client:'user',codeVerifier:randomBytes(32).toString('hex')}),410,'invalid verifier does not redeem code');
  const native=expect(await post('/api/auth/mobile',null,{code:nativeCode,client:'user',codeVerifier:nativeVerifier}),200,'single-use Google native exchange');
  assert.ok(native.token,'native app receives scoped server JWT');
  expect(await post('/api/auth/mobile',null,{code:nativeCode,client:'user',codeVerifier:nativeVerifier}),410,'native exchange code is one time');
    expect(await req('/api/tickets',{bearer:buyer.token}),200,'mobile bearer access before logout');
  expect(await post('/api/auth/logout',buyer.cookie,{}),200,'server-side session revocation');
  expect(await req('/api/tickets',{bearer:buyer.token}),403,'revoked mobile token cannot access wallet');
  expect(await req('/api/tickets'),403,'logged-out anonymous request cannot access wallet');
 }finally{await sql.end()}
},{timeout:180000});
