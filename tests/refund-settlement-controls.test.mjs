import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api=read('src/app/api/refunds/route.ts');
const web=read('src/components/RoleWorkspace.tsx');
const native=read('apps/platform-admin/App.tsx');

test('server refuses settlement before initiation and rejects any further settled changes',()=>{
 assert.match(api,/action==='settled'&&order\.refund_status!=='initiated'/);
 assert.match(api,/order\.refund_status==='settled'/);
 assert.match(api,/action==='review_required'&&!\['not_required','review_required'\]\.includes/);
 assert.match(api,/action==='initiated'&&!\['review_required','initiated'\]\.includes/);
 assert.match(api,/note\.length<10/);
 assert.match(api,/for update of e,o/);
 assert.match(api,/for update\x60/);
 assert.match(api,/ticket_payment_audit/);
});
test('web admin and organiser use per-order settlement notes and only valid staged actions',()=>{
 assert.match(web,/refundNotes\[orderId\]/);
 assert.match(web,/refundNotes\[r\.id\]/);
 assert.match(web,/r\.refund_status==='initiated'/);
 assert.match(web,/r\.refund_status==='settled'/);
 assert.match(web,/window\.confirm\('Confirm you independently verified refund settlement/);
 assert.doesNotMatch(web,/refundNote,setRefundNote/);
});
test('native admin uses per-order settlement evidence and confirmation with immutable completion state',()=>{
 assert.match(native,/refundNotes\[orderId\]/);
 assert.match(native,/refundNotes\[refund\.id\]/);
 assert.match(native,/refund\.refund_status==='initiated'/);
 assert.match(native,/refund\.refund_status==='settled'/);
 assert.match(native,/Verify the transfer for /);
 assert.match(native,/Settlement recorded — read only/);
 assert.doesNotMatch(native,/refundNote,setRefundNote/);
});
