import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../apps/organiser/App.tsx',import.meta.url),'utf8');
const finance=readFileSync(new URL('../src/app/api/finance/route.ts',import.meta.url),'utf8');
const inbox=readFileSync(new URL('../src/app/api/organiser/payment-inbox/route.ts',import.meta.url),'utf8');

test('organiser dashboard counts global pending reviews and notifications instead of a selected event',()=>{
 assert.match(app,/\['Pending reviews',inbox\.pending\]/);
 assert.match(app,/\['New receipts',inbox\.unread\]/);
 assert.match(app,/refreshInbox\(t\)/);
 assert.doesNotMatch(app,/Pending event payment reviews: \{orders\.filter/);
});
test('verified finance KPIs come from scoped server totals, formatted in naira, with accurate semantics',()=>{
 assert.match(app,/api\('finance',t\)/);
 for(const source of ['finances.gross_ngn','finances.commission_ngn','finances.organiser_net_ngn','finances.outstanding_ngn'])
  assert.ok(app.includes(source),source+' missing');
 assert.match(app,/Number\(value\)\.toLocaleString\('en-NG'\)/);
 assert.match(app,/Verified payments only/);
 assert.match(finance,/e\.organiser_id=\$\{user\.id\}/);
 assert.match(inbox,/organiser_id/);
});
test('dashboard refresh and finance errors stay visible, and other pages are available through the menu',()=>{
 assert.match(app,/Financial totals unavailable\. Retry refresh\./);
 assert.match(app,/Refresh dashboard/);
 assert.match(app,/Promise\.all\(\[refreshInbox\(\),refreshFinances\(\)\]\)/);
 assert.match(app,/navigateOrganiser\('events'\)/);
 assert.match(app,/navigateOrganiser\('payments'\)/);
});
