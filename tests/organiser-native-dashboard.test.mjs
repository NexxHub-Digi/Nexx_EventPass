import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../apps/organiser/App.tsx',import.meta.url),'utf8');
const finance=readFileSync(new URL('../src/app/api/finance/route.ts',import.meta.url),'utf8');
const inbox=readFileSync(new URL('../src/app/api/organiser/payment-inbox/route.ts',import.meta.url),'utf8');

test('organiser dashboard reports global pending reviews not currently selected event orders',()=>{
 assert.match(app,/Pending payment reviews across your events: \{inbox\.pending\}/);
 assert.doesNotMatch(app,/Pending event payment reviews: \{orders\.filter/);
 assert.match(app,/New payment notifications: \{inbox\.unread\}/);
 assert.match(app,/refreshInbox\(t\)/);
});
test('dashboard finance uses existing scope-protected server totals and labels',()=>{
 assert.match(app,/api\('finance',t\)/);
 assert.match(app,/Confirmed collections: ₦\{Number\(finances\.gross_ngn\)/);
 assert.match(app,/Platform commissions: ₦\{Number\(finances\.commission_ngn\)/);
 assert.match(app,/Organiser net: ₦\{Number\(finances\.organiser_net_ngn\)/);
 assert.match(app,/Outstanding commission remittance: ₦\{Number\(finances\.outstanding_ngn\)/);
 assert.match(finance,/e\.organiser_id=\$\{user\.id\}/);
 assert.match(inbox,/organiser_id/);
});
test('dashboard can refresh while a finance service failure remains visible and recoverable',()=>{
 assert.match(app,/Financial totals unavailable\. Retry refresh\./);
 assert.match(app,/Refresh dashboard/);
 assert.match(app,/Promise\.all\(\[refreshInbox\(\),refreshFinances\(\)\]\)/);
});
