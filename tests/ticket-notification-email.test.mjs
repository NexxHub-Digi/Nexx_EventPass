import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sendTicketNotice,noticeTemplate} from '../src/lib/ticket-notification-email.ts';
const input={apiKey:'fake-key',from:'Nexx <tickets@example.invalid>',to:'buyer@example.invalid',orderId:'test-order'};
test('provider accepts stable idempotent wallet notice without admission secrets',async()=>{
 const result=await sendTicketNotice(input,async(url,init)=>{
  assert.equal(url,'https://api.resend.com/emails');
  assert.equal(init.redirect,'error');
  assert.equal(init.headers['Idempotency-Key'],'eventpass-ticket-notice/test-order');
  const body=JSON.parse(init.body);
  assert.deepEqual(body.to,[input.to]);assert.match(body.text,/dashboard\/user/);
  assert.ok(!('qr' in body));assert.ok(!('ticket' in body));assert.match(body.html,/NEXX/);assert.match(body.html,/Open my ticket wallet/);assert.ok(!body.html.includes(input.to));assert.ok(!body.html.includes(input.orderId));
  return new Response(JSON.stringify({id:'provider-123'}),{status:200});
 });
 assert.deepEqual(result,{kind:'accepted',id:'provider-123'});
});
test('retry uncertain provider results without exposing errors',async()=>{
 for(const status of [409,429,500])assert.deepEqual(await sendTicketNotice(input,async()=>new Response('',{status})),{kind:'retry'});
 assert.deepEqual(await sendTicketNotice(input,async()=>{throw Error('secret provider error')}),{kind:'retry'});
 assert.deepEqual(await sendTicketNotice(input,async()=>new Response('{}',{status:200})),{kind:'retry'});
 assert.deepEqual(await sendTicketNotice(input,async()=>new Response('',{status:401})),{kind:'failed'});
});

test('isolated staging links never direct to production wallet and reject unsafe origins',async()=>{
 const t=noticeTemplate('https://staging.example.invalid');assert.ok(t);assert.match(t.text,/https:\/\/staging\.example\.invalid\/dashboard\/user/);assert.doesNotMatch(t.html,/nexx-eventpass\.vercel\.app/);
 for(const origin of ['http://example.invalid','https://user:pass@example.invalid','https://example.invalid/path','https://example.invalid/?token=secret','https://example.invalid/#x'])assert.equal(noticeTemplate(origin),null);
 let called=false;assert.deepEqual(await sendTicketNotice({...input,walletOrigin:'http://example.invalid'},async()=>{called=true;throw Error('unexpected')}),{kind:'failed'});assert.equal(called,false);
});
