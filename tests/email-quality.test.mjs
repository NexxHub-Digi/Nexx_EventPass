import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {assessEmailQuality} from '../src/lib/email-quality.ts';

const endpoint='https://validator.internal/api/validate';
const email='staff@example.com';
const reply=(body,status=200)=>async (_url,init)=> {
  assert.equal(init.method,'POST');
  assert.equal(init.redirect,'error');
  assert.equal(JSON.parse(init.body).email,email);
  return {ok:status===200,status,json:async()=>body};
};
const data=(status,changes={})=>({email,status,validations:{syntax:true,is_disposable:false},...changes});

test('disabled by default; never calls public demo',async()=>{
 let calls=0;
 const x=await assessEmailQuality(email,{endpoint:'',fetcher:async()=>{calls++;throw Error('should not call')}});
 assert.equal(x.state,'unchecked');assert.equal(calls,0);
});
test('accepts a valid domain only as an email quality signal',async()=>{
 const x=await assessEmailQuality(email,{endpoint,fetcher:reply(data('VALID'))});
 assert.equal(x.state,'accept');
});
test('blocks known disposable and invalid-format emails',async()=>{
 for(const response of [data('DISPOSABLE',{validations:{syntax:true,is_disposable:true}}),
   data('INVALID_FORMAT',{validations:{syntax:false,is_disposable:false}})]) {
  const x=await assessEmailQuality(email,{endpoint,fetcher:reply(response)});
  assert.equal(x.state,'reject');
 }
});
test('DNS/MX uncertainty does not prevent a real Google user from joining',async()=>{
 for(const status of ['INVALID_DOMAIN','NO_MX_RECORDS','INVALID']) {
  const x=await assessEmailQuality(email,{endpoint,fetcher:reply(data(status))});
  assert.equal(x.state,'review');
 }
});
test('fails open on outages, unexpected responses and unsafe endpoints',async()=>{
 const unavailable=await assessEmailQuality(email,{endpoint,fetcher:async()=>{throw Error('outage')}});
 assert.equal(unavailable.state,'unchecked');
 const swapped=await assessEmailQuality(email,{endpoint,fetcher:reply(data('VALID',{email:'other@example.com'}))});
 assert.equal(swapped.state,'unchecked');
 const unsafe=await assessEmailQuality(email,{endpoint:'http://example.net/api/validate',fetcher:async()=>{throw Error('unexpected call')}});
 assert.equal(unsafe.reason,'invalid_endpoint');
});
test('gate invitation issues use quality preflight without changing Google approval',()=>{
 const src=readFileSync(new URL('../src/app/api/gates/route.ts',import.meta.url),'utf8');
 assert.match(src,/assessEmailQuality\(email\)/);
 assert.match(src,/quality\.state==='reject'/);
 assert.match(src,/Google-verified account/);
});
