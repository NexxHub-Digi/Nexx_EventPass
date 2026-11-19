import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('only event organiser may review payments',()=>{
 const x=read('src/app/api/review/route.ts');
 assert.match(x,/order\.organiser_id!==u\.id \|\| u\.role!=='organiser'/);
 assert.match(x,/order\.organiser_status!=='active'/);
 assert.match(x,/receipt_data/);
});
test('paid orders require configured bank instructions',()=>{
 const x=read('src/app/api/orders/route.ts');
 assert.match(x,/price_ngn\)>0&&!e\.payment_account_id/);
 assert.match(x,/for update of e/);
 assert.match(x,/availableEventTickets\(tx,/);
 assert.match(read('src/lib/event-inventory.ts'),/reservation_expires_at>now\(\)/);
 assert.doesNotMatch(x,/returning \*/);
});
test('gate validation requires active event organiser',()=>{
 const x=read('src/app/api/scan/route.ts');
 assert.match(x,/owner\.role='organiser' and owner\.account_status='active'/);
 assert.match(x,/redeemed_at is null/);
});
test('receipt upload requires real content signature and pending order',()=>{
 const x=read('src/app/api/orders/receipt/route.ts');
 assert.match(x,/isPng/); assert.match(x,/isJpeg/); assert.match(x,/isPdf/);assert.match(x,/verifiedMime/);
 assert.match(x,/status='pending' and reservation_expires_at>now\(\) returning id/);
});
test('platform overview requires active administrator',()=>{
 const x=read('src/app/api/platform/overview/route.ts');
 assert.match(x,/user\.role!=='platform_admin'\|\|user\.account_status!=='active'/);
});
