import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAdmissionCode,displayAdmissionCode,normalizeAdmissionCode} from '../src/lib/admission-code.ts';
process.env.QR_SIGNING_SECRET='local-test-only-super-long-master-secret-at-least-32';
test('backup code is stable, human-readable, event-bound, and unique by ticket',()=>{
 const event=randomUUID(),otherEvent=randomUUID(),ticket=randomUUID(),otherTicket=randomUUID();
 const a=createAdmissionCode(ticket,event);
 assert.match(a,/^[2-9A-HJ-NP-Z]{12}$/);
 assert.equal(createAdmissionCode(ticket,event),a);
 assert.notEqual(createAdmissionCode(ticket,otherEvent),a);
 assert.notEqual(createAdmissionCode(otherTicket,event),a);
 assert.equal(normalizeAdmissionCode(displayAdmissionCode(a).toLowerCase()),a);
 assert.equal(normalizeAdmissionCode(a.slice(0,-1)+'I'),null);
 assert.equal(normalizeAdmissionCode(ticket),null);
});
