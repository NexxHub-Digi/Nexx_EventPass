import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {paystackKey,paystackTestEnabled,validPaystackWebhook,commissionKobo,validPaystackCharge,isPaystackRefundState} from '../src/lib/paystack.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const raw=Buffer.from('{"event":"charge.success","data":{"reference":"EP-TEST"}}');
test('Paystack is strictly test-only and refuses a live provider key',()=>{
 const previous=process.env.PAYSTACK_SECRET_KEY;
 try{
  delete process.env.PAYSTACK_SECRET_KEY;
  assert.equal(paystackTestEnabled(),false);
  assert.throws(()=>paystackKey());
  process.env.PAYSTACK_SECRET_KEY='sk_live_rejected_by_application';
  assert.equal(paystackTestEnabled(),false);
  assert.throws(()=>paystackKey());
  process.env.PAYSTACK_SECRET_KEY='sk_test_fake_ci_key_never_live';
  assert.equal(paystackTestEnabled(),true);
  assert.equal(paystackKey(),'sk_test_fake_ci_key_never_live');
 }finally{if(previous===undefined)delete process.env.PAYSTACK_SECRET_KEY;else process.env.PAYSTACK_SECRET_KEY=previous}
});
test('legacy webhook rejects spoofed signatures; raw body HMAC works',()=>{
 const previous=process.env.PAYSTACK_SECRET_KEY,modern=process.env.PAYSTACK_WEBHOOK_SECRET;
 try{
  process.env.PAYSTACK_SECRET_KEY='sk_test_fake_ci_key_never_live';
  delete process.env.PAYSTACK_WEBHOOK_SECRET;
  const signature=createHmac('sha512',process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');
  assert.equal(validPaystackWebhook(raw,null,signature),true);
  assert.equal(validPaystackWebhook(Buffer.concat([raw,Buffer.from(' ')]),null,signature),false);
  assert.equal(validPaystackWebhook(raw,null,'00'.repeat(64)),false);
 }finally{
  if(previous===undefined)delete process.env.PAYSTACK_SECRET_KEY;else process.env.PAYSTACK_SECRET_KEY=previous;
  if(modern===undefined)delete process.env.PAYSTACK_WEBHOOK_SECRET;else process.env.PAYSTACK_WEBHOOK_SECRET=modern;
 }
});
test('modern HMAC verifies timestamp within replay window',()=>{
 const previous=process.env.PAYSTACK_WEBHOOK_SECRET;
 try{
  process.env.PAYSTACK_WEBHOOK_SECRET='whsec_fake_ci_not_real_secret';
  const stamp=Math.floor(Date.now()/1000);
  const signature=createHmac('sha512',process.env.PAYSTACK_WEBHOOK_SECRET).update(String(stamp)+'.').update(raw).digest('hex');
  assert.equal(validPaystackWebhook(raw,'t='+stamp+',v1=whk_ci:'+signature,null),true);
  assert.equal(validPaystackWebhook(raw,'t='+(stamp-600)+',v1=whk_ci:'+signature,null),false);
  assert.equal(validPaystackWebhook(raw,'t='+stamp+',v1=whk_ci:'+'00'.repeat(64),null),false);
 }finally{if(previous===undefined)delete process.env.PAYSTACK_WEBHOOK_SECRET;else process.env.PAYSTACK_WEBHOOK_SECRET=previous}
});
test('commissions match integer-NGN ledger basis points',()=>{
 assert.equal(commissionKobo(5000,500),25000);
 assert.equal(commissionKobo(100,333),300);
 assert.equal(commissionKobo(5000,0),0);
 assert.throws(()=>commissionKobo(-1,500));
});
test('provider verification rejects untrusted amounts and wrong environments',()=>{
 const charge={reference:'EP-reference',status:'success',amount:500000,currency:'NGN',domain:'test',id:123};
 assert.equal(validPaystackCharge(charge,'EP-reference',500000),true);
 assert.equal(validPaystackCharge({...charge,domain:'live'},'EP-reference',500000),false);
 assert.equal(validPaystackCharge({...charge,amount:500},'EP-reference',500000),false);
 assert.equal(validPaystackCharge({...charge,currency:'USD'},'EP-reference',500000),false);
});
test('webhook cannot fulfil without provider verification and event lock',()=>{
 const callback=read('src/app/api/payments/paystack/webhook/route.ts');
 const fulfil=read('src/lib/paystack-fulfilment.ts');
 assert.match(callback,/validPaystackWebhook/);
 assert.match(callback,/reconcilePaystackReference/);
 assert.match(fulfil,/paystackApi<VerifiedPaystackCharge>/);
 assert.match(fulfil,/for update of e/);
 assert.match(fulfil,/for update/);
 assert.match(fulfil,/issueTicketCredential/);
 assert.match(fulfil,/verified_order_payments/);
 assert.match(fulfil,/ticket_deliveries/);
 assert.match(read('src/app/api/review/route.ts'),/order\.payment_method==='paystack'/);
});

test('charge replay never changes protected refund states',()=>{
 for(const s of ['refund_pending','refunded','refund_failed'])assert.equal(isPaystackRefundState(s),true);
 for(const s of ['initialized','success','reconciliation_required'])assert.equal(isPaystackRefundState(s),false);
 const source=read('src/lib/paystack-fulfilment.ts');
 assert.match(source,/isPaystackRefundState\(record.status\)/);assert.match(source,/isPaystackRefundState\(payment.status\)/);
});
test('insecure checkout requests cannot reserve a provider record',()=>{
 const source=read('src/app/api/payments/paystack/initialize/route.ts');
 assert.ok(source.indexOf('Secure HTTPS checkout required')<source.indexOf('insert into paystack_payments'));
});
