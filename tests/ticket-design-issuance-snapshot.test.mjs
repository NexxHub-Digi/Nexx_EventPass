import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeIssuedDesignSnapshot} from '../src/lib/ticket-design-snapshot.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('design snapshot is a detached copy of selected Ticket Studio version',()=>{
 const original={version:2,theme_id:'stj-royal-gold',mode:'ticket',fields:{title:'',holder:'Example buyer'},enabled:{title:true,holder:true}};
 const result=makeIssuedDesignSnapshot(original,'4c9c2e61-aacc-47e7-a80a-1770338f198d');
 assert.equal(result.version,2);
 assert.equal(result.theme,'stj-royal-gold');
 assert.equal(result.fields.holder,'Example buyer');
 original.fields.holder='Edited after sale';
 assert.equal(result.fields.holder,'Example buyer','immutable snapshot must never reference live draft');
 assert.equal(makeIssuedDesignSnapshot(null,null),null,'legacy tickets remain valid without a draft');
});
test('manual and Paystack ticket issuance store frozen versions and wallets expose them',()=>{
 const manual=read('src/app/api/review/route.ts');
 const paystack=read('src/lib/paystack-fulfilment.ts');
 const wallet=read('src/app/api/tickets/route.ts');
 for(const content of [manual,paystack]){
  assert.match(content,/event_ticket_design_versions/);
  assert.match(content,/makeIssuedDesignSnapshot\(savedDesign/);
  assert.match(content,/design_version,design_snapshot/);
  assert.match(content,/tx\.json\(snapshot\)/);
 }
 assert.match(wallet,/d\.design_version,d\.design_snapshot/);
 assert.match(wallet,/design_snapshot:t\.design_snapshot/);
});
