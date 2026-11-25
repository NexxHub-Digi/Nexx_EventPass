import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sendTicketNotice} from '../src/lib/ticket-notification-email.ts';
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
