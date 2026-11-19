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
 assert.match(x,/unitPrice>0&&method==='manual'&&!e\.payment_account_id/);
 assert.match(x,/unitPrice>0&&method==='manual'&&reference\.length<5/);
 assert.match(x,/paymentMethod==='free'\?'FREE':reference/);
 assert.doesNotMatch(x,/method!=='paystack'&&!e\.payment_account_id/);
 assert.match(x,/method==='paystack'&&!e\.paystack_subaccount_code/);
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

test('manual gate codes are one-way indexed and cannot bypass normal single-use admission',()=>{
 const gate=read('src/app/api/scan/route.ts');
 const entry=read('src/lib/ticket-entry-code.ts');
 const migration=read('db/migrations/20261119_rapid_gate_entry_codes.sql');
 assert.match(gate,/entryCodeHash/);
 assert.match(gate,/redeemed_at is null/);
 assert.match(gate,/entry_method/);
 assert.match(entry,/deriveEntryCode/);
 assert.match(read('src/lib/entry-code-core.ts'),/createHmac/);
 assert.match(entry,/createHash/);
 assert.match(migration,/primary key\(event_id,code_hash\)/);
 assert.doesNotMatch(migration,/code_plaintext/);
});

test('legacy entry-code backfill is opt-in, indexes offline and online tickets and never stores plaintext',()=>{
 const migration=read('scripts/backfill-entry-codes.mjs');
 assert.match(migration,/process\.argv\.includes\('--apply'\)/);
 assert.match(migration,/ENTRY_CODE_BACKFILL_CONFIRM/);
 assert.match(migration,/ENTRY_CODE_BACKFILL_ALLOW_PRODUCTION/);
 assert.match(migration,/from tickets where status='issued'/);
 assert.match(migration,/from offline_tickets where status='issued'/);
 assert.match(migration,/on conflict do nothing returning code_hash/);
 assert.match(migration,/createHmac\('sha256',key\)/);
 assert.match(migration,/EventPass:entry-lookup:v1:/);
 assert.doesNotMatch(migration,/insert into ticket_entry_codes\([^)]*plaintext/);
});
