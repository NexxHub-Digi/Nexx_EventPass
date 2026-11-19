import test from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import {SignJWT} from 'jose';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
if(process.env.CI!=='true'||process.env.EVENTPASS_E2E!=='true'||!/@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL||''))throw Error('Refusing to run E2E outside isolated local CI');
const sql=postgres(process.env.DATABASE_URL,{ssl:false,prepare:false});
const base='http://localhost:3210', tag=randomUUID().slice(0,8),password='EventPass-E2E-Password-123456789!';
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
 const token=await new SignJWT({sub:rows[0].id}).setProtectedHeader({alg:'HS256'}).setIssuer('nexx-eventpass').setAudience('eventpass')
  .setJti(randomUUID()).setIssuedAt().setExpirationTime('7d').sign(new TextEncoder().encode(process.env.AUTH_SECRET));
 const cookie='eventpass_session='+token;
 return {id:rows[0].id,cookie,email:email(name),token};
}
test('HTTP E2E: signup, approval, bank, payment evidence, QR, invitation, atomic scan and suspension',async()=>{
 try{
  const admin=await signUp('admin'),org=await signUp('organiser','organiser'),buyer=await signUp('buyer'),wrong=await signUp('wrong');
  expect(await post('/api/auth/register',null,{portal:'user',email:email('new'),password,fullName:'New User'}),403,'password sign-up disabled');
  expect(await post('/api/auth/login',null,{portal:'user',email:email('buyer'),password}),403,'legacy password login disabled');
  for(const [portal,label] of [['user','User'],['organiser','Event Organiser'],['gate','Gate Operator'],['platform-admin','Platform Administrator']]){
    const page=await fetch(base+'/login/'+portal);
    assert.equal(page.status,200,'dedicated '+label+' sign-in route');
    const html=await page.text();
    assert.ok(html.includes('Continue with Google'),'Google-only sign-in on '+portal+' page');
    assert.ok(html.includes('aria-label="Switch portal"'),'corner portal switch on '+portal+' page');
    const homePath=portal==='user'?'/':'/'+portal;
    const homeLink=html.match(/<a[^>]*class="ep-logo"[^>]*>/)?.[0];
    assert.ok(homeLink?.includes('href="'+homePath+'"'),'role sign-in links home to its own portal');
    assert.ok(html.includes('/api/auth/google?portal='+(portal==='platform-admin'?'platform_admin':portal)),'correct Google OAuth portal on '+portal+' page');
  }
  const failedCallback=await fetch(base+'/api/auth/google/callback?error=access_denied',{redirect:'manual'});
  assert.equal(failedCallback.status,307,'failed OAuth callback redirects');
  const failedLocation=new URL(failedCallback.headers.get('location'));
  assert.equal(failedLocation.origin,base,'failed OAuth remains on current deployment');
  assert.equal(failedLocation.pathname,'/login/user','failed OAuth returns to redesigned login');
  assert.equal(failedLocation.searchParams.get('oauth_error'),'state_missing','failed OAuth displays error');
  assert.equal(expect(await req('/api/auth/me',{cookie:org.cookie}),200,'organiser pending').user.requested_role,'organiser');
  expect(await post('/api/events',org.cookie,{title:'Denied',venue:'E2E',startsAt:new Date(Date.now()+3600000),capacity:1,priceNgn:5000,qrKeyword:'secrettest123'}),403,'unapproved organiser');
  await sql.unsafe('update app_users set role=$1 where id=$2',['platform_admin',admin.id]);
  const adminCookie=admin.cookie;
  expect(await post('/api/auth/login',null,{portal:'platform_admin',email:admin.email,password}),403,'retired password sign-in blocked even for admins');
  assert.ok(expect(await req('/api/platform/organisers',{cookie:adminCookie}),200,'admin directory').organisers.some(x=>x.id===org.id));
  const accounts=expect(await req('/api/platform/users',{cookie:adminCookie}),200,'multi-tenant account directory');
  assert.ok(accounts.accounts.some(a=>a.id===buyer.id),'directory includes buyer');
  const searched=expect(await req('/api/platform/users?q='+encodeURIComponent(buyer.email),{cookie:adminCookie}),200,'search users');
  assert.equal(searched.count,1);
  expect(await req('/api/platform/users',{cookie:wrong.cookie}),403,'users cannot open administrator directory');
  const changed=await req('/api/platform/users',{cookie:adminCookie,method:'PATCH',body:{action:'configure',userId:buyer.id,fullName:'E2E Buyer Updated'}});
  expect(changed,200,'admin modifies User profile');
  const setting=await req('/api/platform/settings',{cookie:adminCookie,method:'PATCH',body:{key:'help_text',value:'E2E help instructions'}});
  expect(setting,200,'admin saves platform config');
  assert.equal(expect(await req('/api/platform/settings',{cookie:adminCookie}),200,'platform settings').settings.help_text,'E2E help instructions');
  expect(await post('/api/platform/organisers',adminCookie,{action:'approve',userId:org.id}),200,'approve organiser');
  assert.equal(expect(await req('/api/auth/me',{cookie:org.cookie}),200,'approved role').user.role,'organiser');
  const opened=expect(await post('/api/support/cases',org.cookie,{subject:'Need verification assistance',description:'Please help review this test event and bank settings',priority:'high'}),201,'organiser opens support case').case;
  assert.ok(expect(await req('/api/support/cases',{cookie:adminCookie}),200,'platform support inbox').cases.some(c=>c.id===opened.id));
  expect(await req('/api/support/cases',{cookie:wrong.cookie}),403,'user support data forbidden');
  expect(await req('/api/support/cases',{cookie:adminCookie,method:'PATCH',body:{id:opened.id,status:'resolved',priority:'high',resolution:'Verified by Platform Admin'}}),200,'platform resolves support');
  assert.equal(expect(await req('/api/support/cases',{cookie:org.cookie}),200,'organiser sees support resolution').cases[0].status,'resolved');
  expect(await post('/api/ticket-themes',wrong.cookie,{name:'Unauthorized Glow',label:'No',colorA:'#123456',colorB:'#456789',accent:'#ffffff'}),403,'only Admin may publish ticket themes');
  const dynamicTheme=expect(await post('/api/ticket-themes',adminCookie,{name:'E2E Ocean Glow',label:'Concert',colorA:'#1450aa',colorB:'#00baa1',accent:'#ffffff'}),201,'Admin adds ticket theme').theme;
  assert.ok(expect(await req('/api/ticket-themes'),200,'public ticket theme catalogue').themes.some(t=>t.id===dynamicTheme.id));
  const masks=expect(await req('/api/ticket-themes'),200,'masquerade templates included').themes.filter(t=>t.id.startsWith('stj-'));
  assert.equal(masks.length,5,'all five masquerade layout templates appear in Organiser theme catalogue');
  for(const [portal,key] of [['user','GOOGLE_USER'],['organiser','GOOGLE_ORGANISER'],['gate','GOOGLE_GATE'],['platform_admin','GOOGLE_PLATFORM']]){
    const res=await fetch(base+'/api/auth/google?portal='+portal,{redirect:'manual'});
    assert.ok([302,303,307,308].includes(res.status),'Google initiates for '+portal);
    const google=new URL(res.headers.get('location'));
    assert.equal(google.hostname,'accounts.google.com');
    assert.equal(google.searchParams.get('client_id'),process.env[key+'_CLIENT_ID']);
    assert.equal(google.searchParams.get('redirect_uri'),base+'/api/auth/google/callback');
    assert.equal(google.searchParams.get('code_challenge_method'),'S256');
    assert.ok(google.searchParams.has('nonce'));
  }
    expect(await req('/api/auth/google?portal=gate&client=native'),400,'native OAuth requires PKCE challenge');
    const date=new Date(Date.now()+3600000).toISOString();
  const bankRoute='/api/organiser/payment-account';
  const submitBank=async (bankName,accountNumber)=>expect(await post(bankRoute,org.cookie,{bankName,accountName:'E2E Organiser',accountNumber}),201,'submit organiser bank account').account;
  const reviewBank=(cookie,accountId,decision,note='')=>req(bankRoute,{cookie,method:'PATCH',body:{accountId,decision,note}});
  const bank=await submitBank('E2E Test Bank','0123456789');
  const secondBank=await submitBank('E2E Second Bank','9876543210');
  const rejectedBank=await submitBank('E2E Rejected Bank','1357924680');
  assert.equal(bank.status,'pending');
  expect(await req(bankRoute,{cookie:buyer.cookie}),403,'buyer cannot read submission queue');
  expect(await reviewBank(org.cookie,bank.id,'verified'),403,'organiser cannot self-verify bank');
  const paidDraft={title:'E2E paid account rule',venue:'E2E Venue',startsAt:date,capacity:2,priceNgn:5000,qrKeyword:'private-test-keyword'};
  expect(await post('/api/events',org.cookie,paidDraft),409,'paid event requires selected verified bank');
  expect(await post('/api/events',org.cookie,{...paidDraft,paymentAccountId:bank.id}),409,'pending bank cannot be used');
  expect(await reviewBank(adminCookie,rejectedBank.id,'rejected','Beneficiary did not match'),200,'reject mismatched account');
  expect(await post('/api/events',org.cookie,{...paidDraft,paymentAccountId:rejectedBank.id}),409,'rejected bank cannot be used');
  expect(await reviewBank(adminCookie,bank.id,'verified'),200,'verify first bank account');
  expect(await reviewBank(adminCookie,secondBank.id,'verified'),200,'verify second bank account');
  assert.equal(expect(await req(bankRoute,{cookie:org.cookie}),200,'list organiser accounts').accounts.filter(a=>a.status==='verified').length,2);
  const sibling=await signUp('other-organiser');
  await sql`update app_users set role='organiser' where id=${sibling.id}`;
  const unrelated=expect(await post(bankRoute,sibling.cookie,{bankName:'Other Bank',accountName:'Other Organiser',accountNumber:'2468013579'}),201,'second organiser account').account;
  expect(await reviewBank(adminCookie,unrelated.id,'verified'),200,'verify unrelated organiser account');
  expect(await post('/api/events',org.cookie,{...paidDraft,paymentAccountId:unrelated.id}),409,'cannot use another organiser’s verified account');
  const event=expect(await post('/api/events',org.cookie,{title:'E2E Test Event',venue:'E2E Venue',startsAt:date,capacity:2,priceNgn:5000,paymentAccountId:bank.id,qrKeyword:'private-test-keyword',ticketTheme:'stj-royal-gold',admissionLabel:'ADMIT ONE — MASK COMPULSORY',posterTemplate:'stj-apartment-party'}),201,'create event').event;
  assert.equal(event.status,'draft','new event cannot auto-publish');
  assert.equal(event.verification_status,'pending','new event requires verification');
  assert.equal(event.poster_template,'stj-apartment-party');
  assert.ok(!expect(await req('/api/events'),200,'pre-review discovery').events.some(x=>x.id===event.id),'unreviewed event hidden');
  const artwork=new Uint8Array(90);artwork.set([137,80,78,71,13,10,26,10]);
  const mediaForm=new FormData();mediaForm.set('eventId',event.id);mediaForm.set('file',new Blob([artwork],{type:'image/png'}),'event-poster.png');
  const uploaded=expect(await req('/api/events/media',{cookie:org.cookie,method:'POST',form:mediaForm}),201,'organiser uploads event poster');
  const artworkId=uploaded.media.id;
  assert.equal(expect(await req('/api/events/media?eventId='+event.id),200,'hidden media').media.length,0,'public cannot see unverified media');
  expect(await post('/api/orders',buyer.cookie,{eventId:event.id,quantity:1,paymentReference:'UNVERIFIED-123'}),400,'unverified listing cannot sell tickets');
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,action:'verify'}),409,'event cannot auto-approve unreviewed media');
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,mediaId:artworkId,action:'approve_media'}),200,'admin separately approves artwork');
  const artForm=new FormData();artForm.set('eventId',event.id);artForm.set('purpose','ticket_art');
  artForm.set('file',new Blob([artwork],{type:'image/png'}),'custom-ticket.png');
  const ticketArtwork=expect(await req('/api/events/media',{cookie:org.cookie,method:'POST',form:artForm}),201,'organiser uploads personalised ticket artwork').media;
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,action:'verify'}),409,'artwork approval required before publication');
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,mediaId:ticketArtwork.id,action:'approve_media'}),200,'administrator approves imported ticket art');
  await sql`update events set payment_account_id=${rejectedBank.id} where id=${event.id}`;
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,action:'verify'}),409,'cannot publish using a rejected bank account');
  expect(await req('/api/events',{cookie:org.cookie,method:'PATCH',body:{action:'payment_account',eventId:event.id,paymentAccountId:bank.id}}),200,'assign verified account');
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,action:'verify'}),200,'admin verifies event listing');
  assert.ok(expect(await req('/api/events'),200,'post-verification discovery').events.some(x=>x.id===event.id),'verified event published');
  assert.equal(expect(await req('/api/events/media?eventId='+event.id),200,'approved gallery').media.length,2);
    expect(await post('/api/orders',buyer.cookie,{eventId:event.id,quantity:1,paymentReference:'E2E-TRANSFER-123'}),409,'checkout must identify shown bank account');
  expect(await post('/api/platform/organisers',adminCookie,{action:'configure',userId:org.id,fullName:'E2E Approved Organiser'}),200,'admin profile configuration');
  const instructions=expect(await req('/api/events/payment-instructions?eventId='+event.id),200,'verified checkout bank instructions').payment;
  assert.equal(instructions.bank_account_number,'0123456789');
  assert.equal(instructions.payment_account_id,bank.id);
  assert.ok(expect(await req('/api/events'),200,'discover event').events.some(e=>e.id===event.id&&e.bank_account_number==='0123456789'));
  // Create an expired fixture ONLY inside the isolated CI PostgreSQL database.
  const expiredRows=await sql.unsafe('insert into ticket_orders(event_id,buyer_id,quantity,amount_ngn,payment_reference,status,reservation_expires_at) values($1,$2,1,5000,$3,$4,now()-interval \'1 minute\') returning id',
   [event.id,wrong.id,'E2E-EXPIRED-ORDER','pending']);
  expect(await post('/api/review',org.cookie,{orderId:expiredRows[0].id,decision:'approved'}),409,'an expired hold cannot issue tickets');
  const expiredProof=new FormData();expiredProof.set('orderId',expiredRows[0].id);
  const expiredImage=new Uint8Array(90);expiredImage.set([137,80,78,71,13,10,26,10]);
  expiredProof.set('receipt',new Blob([expiredImage],{type:'image/png'}),'expired.png');
  expect(await req('/api/orders/receipt',{cookie:wrong.cookie,method:'POST',form:expiredProof}),409,'expired hold cannot accept payment proof');
  const order=expect(await post('/api/orders',buyer.cookie,{eventId:event.id,quantity:1,paymentAccountId:bank.id,paymentReference:'E2E-TRANSFER-123'}),201,'create order').order;
  const assignBank=(cookie,paymentAccountId)=>req('/api/events',{cookie,method:'PATCH',body:{action:'payment_account',eventId:event.id,paymentAccountId}});
  expect(await assignBank(org.cookie,unrelated.id),409,'cannot assign another owner’s account');
  expect(await assignBank(org.cookie,secondBank.id),200,'assign second verified account to event');
  expect(await post('/api/orders',wrong.cookie,{eventId:event.id,quantity:1,paymentAccountId:bank.id,paymentReference:'STALE-ACCOUNT'}),409,'reject checkout using previously shown account');
  const originalOrder=expect(await req('/api/orders',{cookie:buyer.cookie}),200,'read original bank snapshot').orders.find(row=>row.id===order.id);
  assert.equal(originalOrder.payment_account_id,bank.id);
  expect(await assignBank(org.cookie,bank.id),200,'restore primary event account for remaining fixtures');
  assert.ok(new Date(order.reservation_expires_at).getTime()>Date.now(),'ticket reservation must have an expiry');
  const attempts=await Promise.all([
    post('/api/orders',wrong.cookie,{eventId:event.id,quantity:1,paymentAccountId:bank.id,paymentReference:'E2E-SEAT-001'}),
    post('/api/orders',wrong.cookie,{eventId:event.id,quantity:1,paymentAccountId:bank.id,paymentReference:'E2E-SEAT-002'})
  ]);
  assert.deepEqual(attempts.map(x=>x.status).sort(),[201,409],'only one competing checkout gets the remaining seat');
  const held=attempts.find(x=>x.status===201).data.order;
  const rejectedReceipt=new FormData();rejectedReceipt.set('orderId',held.id);
  const proofBytes=new Uint8Array(90);proofBytes.set([137,80,78,71,13,10,26,10]);
  rejectedReceipt.set('receipt',new Blob([proofBytes],{type:'image/png'}),'rejected-payment.png');
  expect(await req('/api/orders/receipt',{cookie:wrong.cookie,method:'POST',form:rejectedReceipt}),200,'attach proof before refund review');
  const inboxPath='/api/organiser/payment-inbox';
  const pending=expect(await req(inboxPath,{cookie:org.cookie}),200,'receipt arrives in organiser inbox');
  assert.equal(pending.unread,1);
  assert.equal(pending.payments[0].id,held.id);
  expect(await req(inboxPath,{cookie:buyer.cookie}),403,'buyer cannot read organiser notification inbox');
  assert.equal(expect(await req(inboxPath,{cookie:sibling.cookie}),200,'other organiser inbox').pending,0);
  const dispute={orderId:held.id,description:'I transferred the ticket amount and have attached my receipt.'};
  expect(await post('/api/support/cases',wrong.cookie,dispute),409,'pending payment cannot open rejected-payment dispute');
  expect(await req(inboxPath,{cookie:org.cookie,method:'PATCH'}),200,'mark payment notifications read');
  assert.equal(expect(await req(inboxPath,{cookie:org.cookie}),200,'read notification status').unread,0);
  expect(await req('/api/orders/receipt',{cookie:wrong.cookie,method:'POST',form:rejectedReceipt}),200,'retry existing receipt');
  assert.equal(expect(await req(inboxPath,{cookie:org.cookie}),200,'receipt retry does not duplicate or mark unread').unread,0);
  expect(await post('/api/review',org.cookie,{orderId:held.id,decision:'rejected'}),200,'rejection releases held seat');
  expect(await post('/api/support/cases',buyer.cookie,dispute),409,'another buyer cannot dispute this order');
  const disputeCase=expect(await post('/api/support/cases',wrong.cookie,dispute),201,'buyer requests support on rejected payment').case;
  assert.equal(expect(await post('/api/support/cases',wrong.cookie,dispute),200,'retry returns existing case').case.id,disputeCase.id);
  assert.equal(expect(await req(inboxPath,{cookie:org.cookie}),200,'rejected order leaves review queue').pending,0);
  assert.ok(expect(await req('/api/support/cases',{cookie:adminCookie}),200,'platform admin sees payment case').cases.some(c=>c.payment_order_id===held.id));
  expect(await req('/api/orders/receipt?orderId='+held.id,{cookie:adminCookie}),200,'platform admin can view linked payment evidence');
  expect(await req('/api/support/cases',{cookie:adminCookie,method:'PATCH',body:{id:disputeCase.id,status:'resolved',priority:'normal',resolution:'Receipt reviewed; contact the organiser about your transaction.'}}),200,'resolve payment support case');
  const caseList=expect(await req('/api/support/cases?scope=payment',{cookie:wrong.cookie}),200,'buyer tracks payment support status').cases;
  assert.ok(caseList.some(c=>c.payment_order_id===held.id&&c.status==='resolved'&&c.resolution.includes('Receipt reviewed')));
  assert.equal(expect(await req('/api/support/cases?scope=payment',{cookie:buyer.cookie}),200,'other buyer cannot see case').cases.length,0);
  const pendingRefunds=expect(await req('/api/refunds',{cookie:org.cookie}),200,'organiser sees refund cases').orders;
  assert.ok(pendingRefunds.some(x=>x.id===held.id&&x.refund_status==='review_required'));
  expect(await req('/api/refunds',{cookie:buyer.cookie}),403,'buyer cannot access organiser refund desk');
  expect(await req('/api/refunds',{cookie:org.cookie,method:'PATCH',body:{orderId:held.id,action:'initiated',note:'E2E refund initiated'}}),200,'record refund initiation');
  expect(await req('/api/refunds',{cookie:org.cookie,method:'PATCH',body:{orderId:held.id,action:'settled',note:'E2E bank transfer reference test-123'}}),200,'record manual settlement evidence');

  expect(await post('/api/orders',wrong.cookie,{eventId:event.id,quantity:1,paymentAccountId:bank.id,paymentReference:'E2E-SEAT-003'}),201,'released seat is available again');

  expect(await post('/api/review',org.cookie,{orderId:order.id,decision:'approved'}),409,'no receipt cannot approve');
  expect(await post('/api/review',wrong.cookie,{orderId:order.id,decision:'approved'}),403,'unauthorised approval');
  const bytes=new Uint8Array(90);bytes.set([137,80,78,71,13,10,26,10]);
  const form=new FormData();form.set('orderId',order.id);form.set('receipt',new Blob([bytes],{type:'image/png'}),'test.png');
  expect(await req('/api/orders/receipt',{cookie:buyer.cookie,method:'POST',form}),200,'receipt submission');
  expect(await req('/api/orders/receipt?orderId='+order.id,{cookie:wrong.cookie}),404,'receipt privacy');
  const approved=expect(await post('/api/review',org.cookie,{orderId:order.id,decision:'approved'}),200,'organiser payment verification');
  assert.ok(!expect(await req(inboxPath,{cookie:org.cookie}),200,'approved order leaves inbox').payments.some(item=>item.id===order.id));
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,action:'reject'}),409,'event with sold tickets must not be unpublished');
  const report=expect(await req('/api/platform/event-directory',{cookie:adminCookie}),200,'admin event details').events;
  assert.ok(report.some(x=>x.id===event.id&&Number(x.tickets_issued)===1),'admin reports issued inventory');
  assert.ok(expect(await req('/api/platform/event-directory',{cookie:org.cookie}),200,'organiser scoped report').events.every(x=>x.organiser_id===org.id));
  expect(await req('/api/platform/audit',{cookie:wrong.cookie}),403,'platform audit cannot be read by ordinary users');
  assert.ok(expect(await req('/api/platform/audit',{cookie:adminCookie}),200,'audit log available to admin').history.length>0);

  assert.equal(approved.issued,1,'approval immediately issues one ticket');
  assert.equal(approved.delivery,'in_app','user can retrieve ticket immediately');
  expect(await post('/api/review',org.cookie,{orderId:order.id,decision:'approved'}),409,'prevent double approval');
  const tickets=expect(await req('/api/tickets',{cookie:buyer.cookie}),200,'ticket wallet').tickets;
  const ticket=tickets.find(t=>t.event_id===event.id);assert.ok(ticket?.qr?.startsWith('EVP2.'));
  assert.ok(ticket.qr.length<140,'compact encrypted QR reduces visual density');
  assert.match(ticket.entry_code,/^NX-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/,'backup code shown to owner');
  assert.equal((await sql`select count(*)::int as total from ticket_entry_codes where ticket_id=${ticket.id}`)[0].total,1,'online backup lookup indexed');
  assert.ok(ticket?.delivered_at,'ticket is immediately delivered into User wallet');
  assert.equal(ticket?.ticket_theme,'stj-royal-gold','issued ticket retains the selected luxurious STJ design');
  assert.equal(ticket?.ticket_art_id,ticketArtwork.id,'approved custom artwork is attached to each issued QR pass');
  expect(await req('/api/events/media',{cookie:org.cookie,method:'DELETE',body:{id:ticketArtwork.id}}),409,'issued artwork cannot be removed');
  assert.equal(ticket?.admission_label,'ADMIT ONE — MASK COMPULSORY','issued ticket preserves approved admission wording');
  expect(await req('/api/events/media?id='+artworkId),200,'verified poster publicly accessible');
  expect(await req('/api/events/media?eventId='+event.id,{cookie:buyer.cookie}),200,'buyer can browse gallery');
  const repeatWallet=expect(await req('/api/tickets',{cookie:buyer.cookie}),200,'tickets remain accessible').tickets;
  assert.equal(repeatWallet.find(t=>t.id===ticket.id).qr,ticket.qr,'online QR stays stable');
  assert.equal(repeatWallet.find(t=>t.id===ticket.id).entry_code,ticket.entry_code,'backup code remains stable');
  const [storedOnline]=await sql`select qr_credential from tickets where id=${ticket.id}`;
  assert.equal(storedOnline.qr_credential,ticket.qr,'credential was stored at issuance');
  expect(await req('/api/events',{cookie:wrong.cookie}),200,'cross-organiser public discovery works');
  expect(await req('/api/events/media?eventId='+event.id,{cookie:org.cookie}),200,'organiser can browse own media');
  expect(await req('/api/events',{cookie:adminCookie}),200,'platform can inspect events');
  // Media uploaded after verification must remain private until approved or rejected.
  const pendingForm=new FormData();pendingForm.set('eventId',event.id);
  pendingForm.set('file',new Blob([artwork],{type:'image/png'}),'second-poster.png');
  const pendingAsset=expect(await req('/api/events/media',{cookie:org.cookie,method:'POST',form:pendingForm}),201,'upload pending second poster').media;
  assert.equal(expect(await req('/api/events/media?eventId='+event.id),200,'gallery excludes pending uploads').media.length,2);
  expect(await post('/api/platform/events',adminCookie,{eventId:event.id,mediaId:pendingAsset.id,action:'reject_media'}),200,'admin rejects unapproved media');
  assert.equal(expect(await req('/api/events/media?eventId='+event.id,{cookie:org.cookie}),200,'rejected media removed').media.length,2);
  const patchResult=await req('/api/events',{cookie:org.cookie,method:'PATCH',body:{eventId:event.id,description:'Changed after paid tickets were issued',category:'Nightlife',ticketTheme:'aurora'}});
  expect(patchResult,409,'issued ticket event cannot be silently unpublished by edits');
  expect(await post('/api/platform/organisers',adminCookie,{action:'capabilities',userId:org.id,
    canCreateEvents:false,canInviteGates:true,canVerifyPayments:true}),200,'admin disables event publishing');
  expect(await post('/api/events',org.cookie,{title:'No permission',venue:'Venue',startsAt:date,capacity:1,priceNgn:0,qrKeyword:'private-keyword-123'}),403,'organiser cannot bypass capability restriction');
  expect(await post('/api/platform/organisers',adminCookie,{action:'capabilities',userId:org.id,
    canCreateEvents:true,canInviteGates:true,canVerifyPayments:true}),200,'restore organiser permissions');
    const gateEmail=email('operator');
  const invite=expect(await post('/api/gates',org.cookie,{eventId:event.id,email:gateEmail,gateLabel:'Main Gate'}),200,'invite any email');
  const token=new URL(invite.invitationLink).searchParams.get('token');assert.equal(token?.length,43);
  expect(await post('/api/gates/accept',wrong.cookie,{token}),403,'wrong invitee');
  const operator=await signUp('operator');assert.equal(operator.email,gateEmail);
  await sql.unsafe('insert into oauth_identities(provider,provider_sub,user_id,provider_email) values($1,$2,$3,$4)', ['google','ci-gate-'+tag,operator.id,operator.email]);
  expect(await post('/api/gates/accept',operator.cookie,{token}),200,'accept invitation');
  expect(await post('/api/gates/accept',operator.cookie,{token}),410,'single-use token');
  const operatorHistory=expect(await req('/api/gate-history?eventId='+event.id,{cookie:operator.cookie}),200,'native gate history loads').scans;
  assert.deepEqual(operatorHistory,[]);
  expect(await req('/api/gate-history?eventId='+event.id,{cookie:wrong.cookie}),403,'unassigned user cannot load operator scan history');
  const operatorGates=expect(await req('/api/gates',{cookie:operator.cookie}),200,'gate workspace inventory').gates;
  assert.equal(operatorGates.length,1);
  assert.ok(expect(await req('/api/gates',{cookie:org.cookie}),200,'organiser gate workspace').gates.length);
  assert.ok(expect(await req('/api/auth/me',{cookie:operator.cookie}),200,'gate portal').portals.includes('gate'));
  const rehearsalQr=expect(await post('/api/scan',operator.cookie,{eventId:event.id,code:ticket.qr,testOnly:true}),200,'non-consuming QR rehearsal');
  const rehearsalManual=expect(await post('/api/scan',operator.cookie,{eventId:event.id,code:ticket.entry_code,testOnly:true}),200,'non-consuming manual rehearsal');
  assert.equal(rehearsalQr.outcome,'valid_test');
  assert.equal(rehearsalManual.outcome,'valid_test');
  const [beforeLive]=await sql`select redeemed_at from tickets where id=${ticket.id}`;
  assert.equal(beforeLive.redeemed_at,null,'rehearsal must not use ticket');
  assert.equal(expect(await req('/api/gate-history?eventId='+event.id,{cookie:operator.cookie}),200,'rehearsal does not create admissions').scans.length,0);
  const scans=await Promise.all([post('/api/scan',operator.cookie,{eventId:event.id,code:ticket.qr}),post('/api/scan',operator.cookie,{eventId:event.id,code:ticket.qr})]);
  assert.deepEqual(scans.map((r,i)=>expect(r,200,'concurrent scan '+i).outcome).sort(),['approved','duplicate']);
  const duplicateManual=expect(await post('/api/scan',operator.cookie,{eventId:event.id,code:ticket.entry_code.toLowerCase().replaceAll('-',' ')}),200,'manual backup reuse');
  assert.equal(duplicateManual.outcome,'duplicate','same ticket cannot be admitted again by backup code');
  assert.equal(duplicateManual.entry_method,'manual');
  const history=expect(await req('/api/gates/activity?eventId='+event.id,{cookie:operator.cookie}),200,'gate log');
  const recordedHistory=expect(await req('/api/gate-history?eventId='+event.id,{cookie:operator.cookie}),200,'operator history after scanning');
  assert.ok(recordedHistory.scans.some(scan=>scan.outcome==='approved'&&scan.ticket_id===ticket.id&&scan.offline_ticket_id===null));
  assert.ok(recordedHistory.scans.length&&recordedHistory.scans.every(scan=>scan.created_at));
  assert.equal(Number(history.stats.admitted),1);assert.equal(Number(history.stats.duplicates),2,'QR and manual attempts are both audited as duplicates');
  const otherEvent=expect(await post('/api/events',org.cookie,{title:'E2E Other Event',venue:'E2E Other Venue',startsAt:date,capacity:3,priceNgn:0,qrKeyword:'other-private-keyword',ticketTheme:dynamicTheme.id}),201,'second event').event;
  expect(await post('/api/platform/events',adminCookie,{eventId:otherEvent.id,action:'verify'}),200,'verify second event');
  expect(await post('/api/gates',org.cookie,{eventId:otherEvent.id,email:wrong.email,gateLabel:'Other Gate',mode:'add'}),409,'unverified direct addition rejected');
  expect(await post('/api/gates',org.cookie,{eventId:otherEvent.id,email:operator.email,gateLabel:'Other Gate',mode:'add'}),200,'existing verified operator added');
  assert.equal(expect(await post('/api/scan',operator.cookie,{eventId:otherEvent.id,code:ticket.qr}),200,'wrong-event QR').outcome,'wrong_event');
  assert.equal(expect(await post('/api/scan',operator.cookie,{eventId:otherEvent.id,code:ticket.entry_code}),200,'backup code does not transfer events').outcome,'invalid');
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
  // Offline ticketing: anonymous recipients, optional activation and single-use QR.
  const privateEvent=expect(await post('/api/events',org.cookie,{
    title:'E2E Private External Event',venue:'Private venue',startsAt:new Date(Date.now()+60*60*1000).toISOString(),
    capacity:5,priceNgn:0,qrKeyword:'private-offline-qr-keyword',ticketTheme:'aurora',visibility:'private'
  }),201,'create private external event').event;
  assert.equal(privateEvent.status,'published');
  assert.ok(!expect(await req('/api/events'),200,'public event discovery').events.some(e=>e.id===privateEvent.id),'private event hidden');
  expect(await post('/api/offline/batches',wrong.cookie,{eventId:privateEvent.id,quantity:2,idempotencyKey:randomUUID()}),403,'non-organiser cannot issue offline tickets');
  const key=randomUUID();
  const batch=expect(await post('/api/offline/batches',org.cookie,{eventId:privateEvent.id,quantity:2,category:'General',label:'Offline E2E',active:false,idempotencyKey:key}),201,'generate inactive offline batch').batch;
  assert.equal(expect(await post('/api/offline/batches',org.cookie,{eventId:privateEvent.id,quantity:2,active:false,idempotencyKey:key}),200,'idempotent offline batch').existing,true);
  const inventory=expect(await req('/api/offline/tickets?eventId='+privateEvent.id,{cookie:org.cookie}),200,'offline inventory').tickets;
  assert.equal(inventory.length,2);assert.ok(inventory.every(t=>t.qr?.startsWith('EVP2.')&&t.active===false),'encrypted inactive tickets');
  assert.ok(inventory.every(t=>t.entry_code?.startsWith('NX-')&&t.qr.length<140),'offline compact QR and indexed backup codes');
  const first=inventory[0];
  const offlinePath='/api/offline/tickets?eventId='+privateEvent.id;
  const searchPath=offlinePath+'&search='+first.id.slice(0,8);
  assert.deepEqual(expect(await req(searchPath,{cookie:org.cookie}),200,'search by ticket ID prefix').tickets.map(t=>t.id),[first.id]);
  const repeatInventory=expect(await req(offlinePath,{cookie:org.cookie}),200,'refresh offline inventory').tickets;
  assert.equal(repeatInventory.find(t=>t.id===first.id).qr,first.qr,'QR remains stable on refresh');
  assert.equal(repeatInventory.find(t=>t.id===first.id).entry_code,first.entry_code,'offline backup code remains stable');
  const [storedOffline]=await sql`select qr_credential from offline_tickets where id=${first.id}`;
  assert.equal(storedOffline.qr_credential,first.qr,'offline credential was stored at issuance');
  await sql`update offline_tickets set qr_credential=null where id=${first.id}`;
  const legacyReads=await Promise.all([req(offlinePath,{cookie:org.cookie}),req(offlinePath,{cookie:org.cookie})]);
  const [legacyQr1,legacyQr2]=legacyReads.map(r=>expect(r,200,'concurrent first read of pre-migration ticket').tickets.find(t=>t.id===first.id).qr);
  assert.ok(legacyQr1?.startsWith('EVP2.'));
  assert.equal(legacyQr1,legacyQr2,'concurrent legacy reads agree on one persisted QR');
  assert.equal(expect(await post('/api/scan',org.cookie,{eventId:privateEvent.id,code:first.qr}),200,'inactive ticket scan').outcome,'inactive_or_unavailable');
  assert.equal(expect(await post('/api/scan',org.cookie,{eventId:privateEvent.id,code:first.entry_code}),200,'inactive backup code').outcome,'inactive_or_unavailable');
  const patch=await req('/api/offline/tickets',{cookie:org.cookie,method:'PATCH',body:{eventId:privateEvent.id,ticketIds:[first.id],action:'activate'}});
  expect(patch,200,'activate selected offline ticket');
  const activated=expect(await req(offlinePath,{cookie:org.cookie}),200,'refresh activated credential').tickets;
  assert.equal(activated.find(t=>t.id===first.id).qr,legacyQr1,'activation does not rotate the QR');
  const manualAdmission=expect(await post('/api/scan',org.cookie,{eventId:privateEvent.id,code:first.entry_code}),200,'first offline backup admission');
  assert.equal(manualAdmission.outcome,'approved');
  assert.equal(manualAdmission.entry_method,'manual');
  assert.equal(expect(await post('/api/scan',org.cookie,{eventId:privateEvent.id,code:first.qr}),200,'subsequent QR after manual admission').outcome,'duplicate');
  assert.equal(expect(await post('/api/scan',org.cookie,{eventId:privateEvent.id,code:first.qr}),200,'duplicate offline scan').outcome,'duplicate');
  const offlineHistory=expect(await req('/api/gate-history?eventId='+privateEvent.id,{cookie:org.cookie}),200,'offline scan references').scans;
  for(const outcome of ['approved','duplicate']){
   assert.ok(offlineHistory.some(scan=>scan.outcome===outcome&&scan.offline_ticket_id===first.id&&scan.ticket_id===null));
  }
  assert.ok(offlineHistory.some(scan=>scan.entry_method==='manual'&&scan.offline_ticket_id===first.id&&scan.outcome==='approved'),'manual admission logged distinctly');
  assert.equal(expect(await post('/api/scan',org.cookie,{eventId:privateEvent.id,code:'not-a-ticket-credential'}),200,'invalid credential').outcome,'invalid');
  const invalidScan=expect(await req('/api/gate-history?eventId='+privateEvent.id,{cookie:org.cookie}),200,'invalid scan history').scans[0];
  assert.equal(invalidScan.outcome,'invalid');
  assert.equal(invalidScan.offline_ticket_id,null);
  assert.equal(invalidScan.ticket_id,null);
  expect(await req('/api/offline/tickets',{cookie:wrong.cookie,method:'PATCH',body:{eventId:privateEvent.id,ticketIds:[first.id],action:'activate'}}),403,'unauthorised activation');
  const second=inventory[1];
  expect(await req('/api/offline/tickets',{cookie:org.cookie,method:'PATCH',body:{eventId:privateEvent.id,ticketIds:[second.id],action:'distribution',distribution:'sold',amountNgn:4000}}),200,'record external sale');
  const replacement=expect(await post('/api/offline/reissue',org.cookie,{eventId:privateEvent.id,ticketId:second.id,reason:'Lost printed ticket'}),200,'atomic replacement');
  assert.ok(replacement.replacement.id!==second.id);
  const [newPass]=expect(await req(offlinePath,{cookie:org.cookie}),200,'replacement credential').tickets.filter(t=>t.id===replacement.replacement.id);
  assert.ok(newPass.qr?.startsWith('EVP2.'));
  assert.notEqual(newPass.qr,second.qr,'replacement has a different QR');
  assert.equal(expect(await post('/api/scan',org.cookie,{eventId:privateEvent.id,code:second.qr}),200,'revoked original').outcome,'revoked');
  assert.equal(expect(await post('/api/scan',org.cookie,{eventId:privateEvent.id,code:second.entry_code}),200,'revoked backup code').outcome,'revoked');
  assert.notEqual(newPass.entry_code,second.entry_code,'reissued ticket receives different backup code');
  const [externalReport] = expect(await req('/api/platform/event-directory?eventId='+privateEvent.id,{cookie:adminCookie}),200,'external inventory in admin report').events;
  assert.equal(externalReport.external_tickets_issued,2);
  assert.equal(externalReport.checked_in,1);
  assert.equal(Number(externalReport.confirmed_revenue_ngn),0);
  const platformSummary=expect(await req('/api/platform/overview',{cookie:adminCookie}),200,'platform totals include offline tickets').stats;
  assert.ok(platformSummary.offline_tickets>=2,'issued external passes counted in totals');
  assert.ok(platformSummary.offline_checkins>=1,'external admissions counted in totals');
  assert.equal(platformSummary.tickets,platformSummary.online_tickets+platformSummary.offline_tickets);
  assert.equal(platformSummary.checkins,platformSummary.online_checkins+platformSummary.offline_checkins);
  expect(await post('/api/offline/exports',org.cookie,{eventId:privateEvent.id,ticketIds:[replacement.replacement.id],format:'jpeg'}),200,'authorise JPEG export');
  expect(await post('/api/offline/exports',org.cookie,{eventId:privateEvent.id,ticketIds:[replacement.replacement.id],format:'print'}),200,'authorise a print sheet');
  assert.equal(expect(await req(offlinePath,{cookie:org.cookie}),200,'refresh after exports').tickets.find(t=>t.id===newPass.id).qr,newPass.qr);
  expect(await post('/api/platform/events',adminCookie,{eventId:privateEvent.id,action:'reject'}),409,'protect live external tickets from unpublishing');
  // Concurrent retries converge on the same batch and reserve only one ticket.
  await sql`update events set starts_at=now()+interval '1 hour' where id=${privateEvent.id}`;
  const retry = {eventId:privateEvent.id,quantity:1,idempotencyKey:randomUUID()};
  const generated = await Promise.all([post('/api/offline/batches',org.cookie,retry),post('/api/offline/batches',org.cookie,retry)]);
  assert.deepEqual(generated.map(response=>response.status).sort(),[200,201]);
  assert.equal(generated[0].data.batch.id,generated[1].data.batch.id);
  const [toRevoke] = expect(await req('/api/offline/tickets?eventId='+privateEvent.id+'&batchId='+generated[0].data.batch.id,{cookie:org.cookie}),200,'new batch register').tickets;
  const revoke = {eventId:privateEvent.id,ticketIds:[toRevoke.id],action:'revoke',reason:'Printed copy lost'};
  expect(await req('/api/offline/tickets',{cookie:wrong.cookie,method:'PATCH',body:revoke}),403,'unassigned user cannot revoke');
  expect(await req('/api/offline/tickets',{cookie:org.cookie,method:'PATCH',body:revoke}),200,'standalone revocation');
  assert.equal(expect(await post('/api/scan',org.cookie,{eventId:privateEvent.id,code:toRevoke.qr}),200,'revoked ticket scan').outcome,'revoked');

  const afterRevoke=expect(await post('/api/offline/reissue',org.cookie,{eventId:privateEvent.id,ticketId:toRevoke.id,reason:'Replace revoked copy'}),200,'replace separately revoked ticket').replacement;
  const reissued=expect(await req(offlinePath,{cookie:org.cookie}),200,'refresh revocation replacement').tickets.find(t=>t.id===afterRevoke.id);
  assert.ok(reissued.qr);
  assert.notEqual(reissued.qr,toRevoke.qr);
  expect(await post('/api/offline/reissue',org.cookie,{eventId:privateEvent.id,ticketId:toRevoke.id,reason:'Second replacement attempt'}),409,'cannot replace same ticket twice');

  await sql`insert into oauth_identities(provider,provider_sub,user_id,provider_email) values('google',${randomUUID()},${wrong.id},${wrong.email})`;
  expect(await post('/api/offline/staff',org.cookie,{eventId:privateEvent.id,email:wrong.email,scope:'selected',eventIds:[privateEvent.id],permissions:['view']}),200,'assign verified staff');
  const assignments = expect(await req('/api/offline/assignments',{cookie:wrong.cookie}),200,'staff event list').events;
  assert.deepEqual(assignments.map(event=>event.id),[privateEvent.id]);
  const staffTickets = expect(await req('/api/offline/tickets?eventId='+privateEvent.id,{cookie:wrong.cookie}),200,'view only inventory').tickets;
  assert.ok(staffTickets.every(ticket=>ticket.qr===null));
  expect(await post('/api/offline/exports',wrong.cookie,{eventId:privateEvent.id,ticketIds:[replacement.replacement.id],format:'jpeg'}),403,'read-only staff cannot export');
  expect(await req('/api/offline/staff',{cookie:org.cookie,method:'DELETE',body:{eventId:privateEvent.id,userId:wrong.id}}),200,'revoke staff grant');
  assert.deepEqual(expect(await req('/api/offline/assignments',{cookie:wrong.cookie}),200,'revoked staff event list').events,[]);
  expect(await req('/api/offline/tickets?eventId='+privateEvent.id,{cookie:wrong.cookie}),403,'revoked staff inventory');
  assert.ok(expect(await req('/api/offline/activity?eventId='+privateEvent.id,{cookie:org.cookie}),200,'offline activity').history.length>=4);

  const lastSeatEvent=expect(await post('/api/events',org.cookie,{
    title:'E2E shared last seat',venue:'Test hall',startsAt:new Date(Date.now()+3600000).toISOString(),
    capacity:2,priceNgn:0,visibility:'public',qrKeyword:'shared-inventory-test-key'
  }),201,'create shared capacity fixture').event;
  expect(await post('/api/platform/events',adminCookie,{eventId:lastSeatEvent.id,action:'verify'}),200,'publish shared capacity fixture');
  const categoryPath='/api/events/ticket-categories';
  const allocation={eventId:lastSeatEvent.id,name:'Balcony',capacity:1};
  expect(await post(categoryPath,wrong.cookie,allocation),403,'non-organiser cannot allocate tickets');
  const balcony=expect(await post(categoryPath,org.cookie,allocation),201,'allocate one Balcony seat').category;
  expect(await post(categoryPath,org.cookie,{...allocation,name:'Floor',capacity:2}),409,'reject allocations beyond General capacity');
  const pools=expect(await req(categoryPath+'?eventId='+lastSeatEvent.id),200,'discover published ticket categories');
  assert.equal(pools.generalCapacity,1);
  assert.equal(pools.categories[0].id,balcony.id);
  const contenders=await Promise.all([
    post('/api/orders',wrong.cookie,{eventId:lastSeatEvent.id,ticketCategoryId:balcony.id,quantity:1,paymentReference:'E2E shared capacity'}),
    post('/api/offline/batches',org.cookie,{eventId:lastSeatEvent.id,ticketCategoryId:balcony.id,quantity:1,idempotencyKey:randomUUID()})
  ]);
  assert.deepEqual(contenders.map(response=>response.status).sort(),[201,409],'online and external issuance cannot both claim the last category seat');
  expect(await post('/api/offline/batches',org.cookie,{eventId:privateEvent.id,ticketCategoryId:balcony.id,quantity:1,idempotencyKey:randomUUID()}),400,'reject another event’s category');
  const request={eventId:lastSeatEvent.id,quantity:1,paymentReference:'General seat fixture',reservationKey:randomUUID()};
  const duplicateReservation=await Promise.all([post('/api/orders',wrong.cookie,request),post('/api/orders',wrong.cookie,request)]);
  assert.deepEqual(duplicateReservation.map(result=>result.status).sort(),[200,201]);
  assert.equal(duplicateReservation[0].data.order.id,duplicateReservation[1].data.order.id);
  expect(await post('/api/orders',wrong.cookie,{...request,quantity:2}),409,'reject conflicting reservation key reuse');

  const onsiteBuyer=await signUp('onsite-buyer');
  const patchFinance=(cookie,body)=>req('/api/finance',{cookie,method:'PATCH',body});
  const onsiteEvent=expect(await post('/api/events',org.cookie,{
    title:'E2E onsite collection',venue:'Test hall',startsAt:new Date(Date.now()+3600000).toISOString(),
    capacity:4,priceNgn:1001,paymentAccountId:secondBank.id,visibility:'public',qrKeyword:'onsite-collection-test-key'
  }),201,'create onsite fixture').event;
  expect(await post('/api/platform/events',adminCookie,{eventId:onsiteEvent.id,action:'verify'}),200,'publish onsite fixture');
  assert.equal(expect(await req('/api/events/payment-instructions?eventId='+onsiteEvent.id),200,'second event uses assigned account').payment.bank_account_number,'9876543210');
  const onsiteBody={eventId:onsiteEvent.id,quantity:1,paymentMethod:'onsite'};
  expect(await post('/api/orders',onsiteBuyer.cookie,onsiteBody),409,'onsite is opt-in');
  expect(await post('/api/orders',onsiteBuyer.cookie,{...onsiteBody,paymentMethod:'paystack'}),400,'placeholder cannot create a Paystack payment');
  expect(await patchFinance(wrong.cookie,{action:'onsite',eventId:onsiteEvent.id,enabled:true}),403,'non-owner cannot enable onsite collection');
  expect(await patchFinance(org.cookie,{action:'onsite',eventId:onsiteEvent.id,enabled:true}),200,'enable onsite collection');
  await sql`update events set starts_at=now()-interval '10 minutes' where id=${onsiteEvent.id}`;
  const onsite=expect(await post('/api/orders',onsiteBuyer.cookie,onsiteBody),201,'reserve onsite during event').order;
  assert.equal(onsite.payment_method,'onsite');
  expect(await patchFinance(org.cookie,{action:'commission',basisPoints:750}),403,'only platform admin can set commission');
  expect(await patchFinance(adminCookie,{action:'commission',basisPoints:750}),200,'set commission for future approvals');
  const collection={orderId:onsite.id,decision:'approved',collectedAmountNgn:1001,collectionReference:'CASH-'+tag};
  expect(await post('/api/review',org.cookie,{orderId:onsite.id,decision:'approved'}),409,'require onsite confirmation');
  expect(await post('/api/review',org.cookie,{...collection,collectedAmountNgn:1000}),409,'reject mismatched collection amount');
  expect(await post('/api/review',wrong.cookie,collection),403,'non-owner cannot confirm collection');
  expect(await post('/api/review',org.cookie,collection),200,'confirm exact collection and issue ticket');
  expect(await post('/api/review',org.cookie,collection),409,'prevent duplicate confirmation');
  const duplicate=expect(await post('/api/orders',onsiteBuyer.cookie,onsiteBody),201,'create second onsite reservation').order;
  expect(await post('/api/review',org.cookie,{...collection,orderId:duplicate.id}),409,'prevent reused collection reference');
  assert.ok(expect(await req('/api/tickets',{cookie:onsiteBuyer.cookie}),200,'onsite ticket in wallet').tickets.some(t=>t.event_id===onsiteEvent.id&&t.qr));

  const financePath='/api/finance?eventId='+onsiteEvent.id;
  const ledger=async cookie=>expect(await req(financePath,{cookie}),200,'read scoped finance ledger');
  expect(await req(financePath,{cookie:onsiteBuyer.cookie}),403,'buyer cannot read finance ledger');
  const [verified]=(await ledger(org.cookie)).payments;
  assert.equal(verified.commission_ngn,75);
  assert.equal(verified.organiser_net_ngn,926);
  assert.equal(verified.reconciliation_status,'outstanding');
  expect(await patchFinance(adminCookie,{action:'commission',basisPoints:1000}),200,'change future commission');
  assert.equal((await ledger(org.cookie)).payments[0].commission_ngn,75,'historical commission remains fixed');
  const remittance={action:'reconcile',orderId:onsite.id,reference:'STATEMENT-'+tag,receivedNgn:60};
  expect(await patchFinance(org.cookie,remittance),403,'organiser cannot reconcile platform receipt');
  assert.equal(expect(await patchFinance(adminCookie,remittance),200,'record mismatched settlement').status,'discrepancy');
  assert.equal(Number((await ledger(adminCookie)).totals.outstanding_ngn),15);
  assert.equal(expect(await patchFinance(adminCookie,{...remittance,receivedNgn:75}),200,'correct settlement from statement').status,'matched');
  assert.equal(Number((await ledger(org.cookie)).totals.outstanding_ngn),0);
  await patchFinance(adminCookie,{action:'commission',basisPoints:0});
  const [wrongOwnerEvent]=await sql`insert into events(organiser_id,title,slug,venue,starts_at,price_ngn,capacity,status,verification_status,visibility)
   values(${admin.id},'E2E admin-owned legacy event',${'admin-owned-'+tag},'Test',now()+interval '1 hour',0,1,'published','verified','public') returning id`;
  assert.ok(!expect(await req('/api/events'),200,'public discovery hides invalid owner').events.some(event=>event.id===wrongOwnerEvent.id));
  assert.ok(expect(await req('/api/events',{cookie:adminCookie}),200,'admin still sees event for correction').events.some(event=>event.id===wrongOwnerEvent.id));
  expect(await req('/api/events/payment-instructions?eventId='+wrongOwnerEvent.id),404,'booking hides invalid owner');
  expect(await req('/api/events/ticket-categories?eventId='+wrongOwnerEvent.id),404,'inventory hides invalid owner');
  expect(await post('/api/platform/events',adminCookie,{eventId:wrongOwnerEvent.id,action:'verify'}),409,'admin cannot publish events with an ineligible owner');

  const correction={eventId:wrongOwnerEvent.id,action:'correct_owner',expectedOwnerId:admin.id,
   organiserEmail:org.email,reason:'Confirmed owner in fixture',ownershipConfirmed:true};
  assert.ok(expect(await req('/api/platform/events',{cookie:adminCookie}),200,'moderation flags invalid owner').events
    .some(event=>event.id===wrongOwnerEvent.id&&!event.owner_eligible));
  expect(await post('/api/platform/events',org.cookie,correction),403,'correction requires Platform Admin');
  expect(await post('/api/platform/events',adminCookie,{...correction,ownershipConfirmed:false}),400,'correction requires explicit confirmation');
  await sql`insert into gate_assignments(event_id,user_id) values(${wrongOwnerEvent.id},${admin.id})`;
  expect(await post('/api/platform/events',adminCookie,correction),409,'gate dependencies block correction');
  await sql`delete from gate_assignments where event_id=${wrongOwnerEvent.id}`;
  expect(await post('/api/platform/events',adminCookie,correction),200,'admin corrects confirmed owner');
  const [corrected]=await sql`select organiser_id,status,verification_status from events where id=${wrongOwnerEvent.id}`;
  assert.deepEqual({...corrected},{organiser_id:org.id,status:'draft',verification_status:'pending'});
  const [correctionAudit]=await sql`select details from platform_admin_actions where action='correct_event_owner' and details->>'eventId'=${wrongOwnerEvent.id}`;
  assert.equal(correctionAudit.details.previousOwnerId,admin.id);
  expect(await post('/api/platform/events',adminCookie,correction),409,'stale correction cannot transfer an eligible event');

  const pricedEvent=expect(await post('/api/events',org.cookie,{
   title:'E2E category pricing',venue:'Test',startsAt:new Date(Date.now()+3600000).toISOString(),
   priceNgn:1000,capacity:4,paymentAccountId:secondBank.id,qrKeyword:'category-pricing-test'
  }),201,'create priced category fixture').event;
  const vip=expect(await post('/api/events/ticket-categories',org.cookie,{eventId:pricedEvent.id,name:'VIP',capacity:2,priceNgn:2000}),201,'configure VIP price').category;
  const complimentary=expect(await post('/api/events/ticket-categories',org.cookie,{eventId:pricedEvent.id,name:'Complimentary',capacity:1,priceNgn:0}),201,'configure complimentary allocation').category;
  expect(await post('/api/platform/events',adminCookie,{eventId:pricedEvent.id,action:'verify'}),200,'publish priced fixture');
  const vipOrder={eventId:pricedEvent.id,ticketCategoryId:vip.id,quantity:1,paymentReference:'PRICING-FIXTURE',paymentAccountId:secondBank.id};
  expect(await post('/api/orders',wrong.cookie,{...vipOrder,unitPriceNgn:1000}),409,'reject stale price');
  const firstVip=expect(await post('/api/orders',wrong.cookie,{...vipOrder,unitPriceNgn:2000}),201,'purchase uses category price').order;
  assert.equal(firstVip.amount_ngn,2000);
  assert.equal(firstVip.unit_price_ngn,2000);
  expect(await req('/api/events/ticket-categories',{cookie:org.cookie,method:'PATCH',body:{eventId:pricedEvent.id,categoryId:vip.id,priceNgn:2500}}),200,'edit the price for new orders');
  const secondVip=expect(await post('/api/orders',wrong.cookie,{...vipOrder,unitPriceNgn:2500}),201,'accept new price').order;
  assert.equal(secondVip.unit_price_ngn,2500);
  assert.equal(expect(await req('/api/orders',{cookie:wrong.cookie}),200,'historical price snapshot').orders.find(order=>order.id===firstVip.id).unit_price_ngn,2000);
  const free=expect(await post('/api/orders',wrong.cookie,{eventId:pricedEvent.id,ticketCategoryId:complimentary.id,quantity:1,paymentReference:'FREE-TICKET',unitPriceNgn:0}),201,'reserve complimentary allocation').order;
  assert.equal(free.amount_ngn,0);
  assert.equal(free.payment_method,'free');

  const cancel={action:'cancel',orderId:firstVip.id};
  expect(await req('/api/orders',{cookie:onsiteBuyer.cookie,method:'PATCH',body:cancel}),404,'only buyer can cancel reservation');
  expect(await req('/api/orders',{cookie:wrong.cookie,method:'PATCH',body:cancel}),200,'buyer cancels unpaid reservation');
  expect(await req('/api/orders',{cookie:wrong.cookie,method:'PATCH',body:cancel}),200,'duplicate cancellation is safe');
  expect(await post('/api/review',org.cookie,{orderId:firstVip.id,decision:'approved'}),409,'cancelled order cannot issue a ticket');
  expect(await post('/api/orders',wrong.cookie,{...vipOrder,unitPriceNgn:2500}),201,'cancellation releases category capacity');

 }finally{await sql.end()}
},{timeout:180000});
