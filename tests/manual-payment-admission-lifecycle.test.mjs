import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('receipts remain pending and cannot mint a QR credential',()=>{
 const reserve=source('src/app/api/orders/route.ts');
 const receipt=source('src/app/api/orders/receipt/route.ts');
 const review=source('src/app/api/review/route.ts');
 assert.match(reserve,/payment_reference,status,reservation_expires_at/);
 assert.match(reserve,/\b'pending',now\(\)\+interval '45 minutes'/);
 assert.match(receipt,/status='pending' and reservation_expires_at>now\(\)/);
 assert.doesNotMatch(receipt,/insert into tickets/);
 assert.match(review,/Only the owning organiser may review payments/);
 assert.match(review,/order\.payment_method!=='onsite' && Number\(order\.amount_ngn\)>0 && !order\.receipt_data/);
 assert.match(review,/if\(decision==='approved'\)/);
});

test('user wallet credentials require both approved order and verified payment ledger',()=>{
 const wallet=source('src/app/api/tickets/route.ts');
 assert.match(wallet,/join ticket_orders o on o\.id=t\.order_id/);
 assert.match(wallet,/join verified_order_payments p on p\.order_id=o\.id/);
 assert.match(wallet,/o\.status='approved'/);
 assert.match(wallet,/activeRows/);
 assert.match(wallet,/event_phase:/);
});

test('gate always verifies payment authorisation, uses start minus 2 hours and start plus 4 hours',()=>{
 const scan=source('src/app/api/scan/route.ts');
 assert.match(scan,/const admissionOpensAt=new Date\(startsAt-2\*60\*60\*1000\)/);
 assert.match(scan,/const admissionClosesAt=new Date\(startsAt\+4\*60\*60\*1000\)/);
 assert.match(scan,/e\.starts_at between now\(\) - interval '4 hours' and now\(\) \+ interval '2 hours'/);
 assert.equal(scan.match(/starts_at between now\(\) - interval '4 hours' and now\(\) \+ interval '2 hours'/g)?.length,2,
  'both online and offline ticket scanners use the same window');
 assert.match(scan,/exists\(select 1 from ticket_orders o join verified_order_payments p on p\.order_id=o\.id/);
 assert.doesNotMatch(scan,/endsAt>Date\.now\(\)/);
});

test('past events remain inspectable but leave active discovery and admission wallets',()=>{
 const events=source('src/app/api/events/route.ts');
 const tickets=source('src/app/api/tickets/route.ts');
 assert.match(events,/searchParams\.get\('view'\)==='past'/);
 assert.match(events,/e\.starts_at < now\(\) - interval '24 hours'/);
 assert.match(tickets,/event_phase:new Date\(t\.starts_at\)/);
 assert.match(tickets,/entry_code:t\.status==='issued'&&new Date\(t\.starts_at\)/);
 assert.match(tickets,/qr:t\.status==='issued'&&new Date\(t\.starts_at\)/);
});
