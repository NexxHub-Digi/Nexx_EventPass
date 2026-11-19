import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const native=readFileSync(new URL('../apps/gate/App.tsx',import.meta.url),'utf8');
const scan=readFileSync(new URL('../src/app/api/scan/route.ts',import.meta.url),'utf8');

test('valid rehearsal is visibly amber and never labelled as real admission',()=>{
 assert.match(native,/outcome==='valid_test'\|\|outcome==='duplicate'\?'#F59E0B'/);
 assert.match(native,/outcome==='valid_test'\|\|outcome==='duplicate'\?'#FBBF24'/);
 assert.match(native,/TEST ONLY — VALID, NOT ADMITTED/);
 assert.match(native,/Rehearsal passed\. No ticket was redeemed/);
 assert.match(native,/TEST ONLY\. No attendee will be admitted in this mode/);
});
test('native history distinguishes event server history from session-only history',()=>{
 assert.match(native,/No recorded scans for this event\./);
 assert.doesNotMatch(native,/No tickets scanned in this session\./);
 assert.match(native,/else if\(r\.entry_method==='manual'&&r\.outcome==='invalid'\)/);
 assert.match(scan,/if\(!testOnly\|\|entryMethod==='manual'\)/);
});
test('rehearsal never counts valid tickets as admitted in native app',()=>{
 assert.match(native,/if\(!r\.testOnly\)/);
 assert.match(native,/approved:c\.approved\+\(r\.outcome==='approved'\?1:0\)/);
 assert.match(scan,/if\(testOnly\)/);
 assert.match(scan,/ticket\.status==='issued'&&ticket\.active\?'valid_test'/);
});
