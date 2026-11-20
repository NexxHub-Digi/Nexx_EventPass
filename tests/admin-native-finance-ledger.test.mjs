import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('apps/platform-admin/App.tsx');
const ledger=read('apps/platform-admin/AdminFinanceLedger.tsx');
const api=read('src/app/api/finance/route.ts');
const web=read('src/components/FinanceLedger.tsx');

test('Platform Administrator native finance includes the real ledger rather than only refund controls',()=>{
 assert.match(app,/import AdminFinanceLedger from '\.\/AdminFinanceLedger'/);
 assert.match(app,/section==='finance'/);
 assert.match(app,/<AdminFinanceLedger token=\{token\} apiBase=\{BASE\}\/>/);
 assert.match(app,/Refund cases/);
 assert.match(ledger,/apiBase\+'\/api\/finance'/);
 assert.match(ledger,/Authorization:'Bearer '\+token/);
 assert.match(ledger,/ledger\.payments\.map/);
});
test('native finance shows verified financial totals and disclaims unverified offline sales',()=>{
 for(const item of ['gross_ngn','organiser_net_ngn','commission_ngn','received_ngn','outstanding_ngn','discrepancies']){
  assert.ok(ledger.includes(item),'missing financial metric '+item);
 }
 assert.match(ledger,/Manually logged offline ticket sales are not included/);
 assert.match(ledger,/reconciliation_status\.replaceAll/);
 assert.match(api,/from verified_order_payments p join ticket_orders o/);
});
test('native commission policy requires human confirmation and preserves existing approved snapshots',()=>{
 assert.match(ledger,/action:'commission',basisPoints/);
 assert.match(ledger,/value<0\|\|value>100/);
 assert.match(ledger,/Change platform commission\?/);
 assert.match(ledger,/Past commission snapshots will not change/);
 assert.match(api,/user\.role !== 'platform_admin'/);
 assert.match(web,/Commission on future approvals/);
});
test('native per-order reconciliation requires a statement reference, amount and confirmation',()=>{
 assert.match(ledger,/action:'reconcile',orderId:p\.order_id,receivedNgn:paid,reference:reference\.trim\(\)/);
 assert.match(ledger,/reference\.trim\(\)\.length<5/);
 assert.match(ledger,/Number\.isSafeInteger\(paid\)/);
 assert.match(ledger,/independently received/);
 assert.match(ledger,/A mismatch is an auditable discrepancy/);
 assert.match(api,/commission_reconciliations\(order_id,received_ngn,reference,recorded_by\)/);
});
