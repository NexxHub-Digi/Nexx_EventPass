import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api=read('src/app/api/platform/overview/route.ts');
const web=read('src/components/RoleWorkspace.tsx');
const native=read('apps/platform-admin/PlatformOverview.tsx');
test('financial overview uses independently scoped aggregates, not multiplicative joins',()=>{
 assert.match(api,/verified_order_payments p\) as verified_collections_ngn/);
 assert.match(api,/verified_order_payments p\) as verified_commissions_ngn/);
 assert.match(api,/left join commission_reconciliations c on c.order_id=p.order_id/);
 assert.match(api,/greatest\(p.commission_ngn-coalesce\(c.received_ngn,0\),0\)/);
 assert.match(api,/from offline_tickets t[\s\S]*t.distribution='sold' and t.status='issued'/);
 assert.match(api,/from ticket_orders o[\s\S]*refund_status in \('review_required','initiated'\)/);
 assert.match(api,/user.role!=='platform_admin'/);
});
test('native and web Platform Administrator display clear naira metrics and non-collection disclaimer',()=>{
 for(const key of ['verified_collections_ngn','verified_commissions_ngn','commission_outstanding_ngn','manual_offline_sales_ngn','refund_review_exposure_ngn']){
  assert.ok(web.includes(key),'web: '+key);
  assert.ok(native.includes(key),'native: '+key);
 }
 assert.match(native,/key.endsWith\('_ngn'\)/);
 assert.match(native,/manually recorded offline sales do not imply money received/);
 assert.match(web,/Offline sales are manually recorded, not necessarily received/);
 assert.match(web,/k.endsWith\('_ngn'\)/);
});
