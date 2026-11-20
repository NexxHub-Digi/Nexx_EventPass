import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('OpenGraph image does not trigger dynamic Unicode fallback font downloads',()=>{
 const source=read('src/app/opengraph-image.tsx');
 assert.match(source,/ImageResponse/);
 assert.match(source,/NEXX EVENTPASS/);
 assert.doesNotMatch(source,/◈|•|&nbsp;/);
});

test('moderation cannot modify approved media or remove artwork attached to issued passes',()=>{
 const source=read('src/app/api/platform/events/route.ts');
 assert.match(source,/if\(asset\.approved\)/);
 assert.match(source,/if\(asset\.in_use\)/);
 assert.match(source,/from event_media m join events e on e\.id=m\.event_id/);
 assert.match(source,/for update of e,m/);
 assert.match(source,/where id=\$\{mediaId\} and approved=false/);
 assert.match(source,/Cancelled events cannot be republished/);
});

test('organiser media deletion holds event lock while checking ticket deliveries',()=>{
 const source=read('src/app/api/events/media/route.ts');
 assert.match(source,/const result=await db\(\)\.begin\(async tx=>/);
 assert.match(source,/for update of e,m/);
 assert.match(source,/ticket_deliveries d where d\.ticket_art_id=\$\{mediaId\}/);
 assert.match(source,/Artwork is attached to issued tickets/);
});

test('native gate exchange enforces verified event parity with web authorization',()=>{
 const route=read('src/app/api/auth/mobile/route.ts');
 assert.match(route,/e\.status='published' and e\.verification_status='verified'/);
 assert.equal(route.match(/e\.verification_status='verified'/g)?.length,2);
});

test('payment gateway prevents collection outside the admission grace window',()=>{
 const route=read('src/app/api/payments/paystack/initialize/route.ts');
 assert.match(route,/new Date\(order\.starts_at\)\.getTime\(\)\+4\*60\*60\*1000<=Date\.now\(\)/);
});

test('QR keyword configuration cannot overwrite offline ticket credentials',()=>{
 const route=read('src/app/api/events/qr/route.ts');
 assert.match(route,/select id from offline_tickets where event_id=/);
 assert.match(route,/if\(issued\[0\]\|\|offline\[0\]\)return false/);
});
