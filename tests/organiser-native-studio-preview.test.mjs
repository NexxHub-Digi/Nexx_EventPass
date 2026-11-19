import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const preview=readFileSync(new URL('../apps/organiser/TicketStudioPreview.tsx',import.meta.url),'utf8');
const native=readFileSync(new URL('../apps/organiser/App.tsx',import.meta.url),'utf8');
const route=readFileSync(new URL('../src/app/api/events/route.ts',import.meta.url),'utf8');

test('native organiser selected-event editor includes nine editable, hideable preview fields',()=>{
 for(const name of ['Event title','Presented by','Venue','Date & time','Price (NGN)','Admission label','Ticket holder','Ticket reference','Additional details']){
  assert.ok(preview.includes("'"+name+"'"),name+' not found');
 }
 assert.match(preview,/accessibilityRole="checkbox"/);
 assert.match(preview,/accessibilityState=\{\{checked:enabled\[key\]\}\}/);
 assert.match(preview,/onChangeText=\{value=>setFields/);
 assert.match(preview,/setEnabled\(p=>/);
});
test('mode selector and live preview are non-consuming with no fabricated admission credential',()=>{
 assert.match(preview,/choice\('ticket','Designed ticket'\)/);
 assert.match(preview,/choice\('qr','QR only'\)/);
 assert.match(preview,/choice\('both','Ticket \+ QR'\)/);
 assert.match(preview,/SAMPLE • NOT VALID FOR ENTRY/);
 assert.match(preview,/NO REUSABLE OR DEMO ADMISSION CODE/);
 assert.match(preview,/Real signed QR codes are created only after authorised fulfilment/);
 assert.doesNotMatch(preview,/QRCodeSVG|react-native-qrcode-svg|EVENTPASS-DEMO-NOT-VALID/);
});
test('selected event is authoritative and fields reset when switching events',()=>{
 assert.match(native,/<TicketStudioPreview key=\{eventId\} eventId=\{eventId\}/);
 assert.match(native,/priceNgn=\{Number\(events\.find\(e=>e\.id===eventId\)\?\.price_ngn\|\|0\)\}/);
 assert.match(preview,/\},\[eventId\]\);/);
 assert.match(preview,/setEnabled\(\{\.\.\.visibleByDefault\}\);setMode\('both'\)/);
});
test('UI clearly distinguishes preview-only changes from persisted event values',()=>{
 assert.match(native,/Preview-only fields are not persisted/);
 assert.match(preview,/These preview changes are not published/);
 assert.match(native,/api\('events',token,'PATCH',\{eventId,description,category,ticketTheme:theme,admissionLabel,posterTemplate\}\)/);
 assert.match(route,/if\(usage\.in_use\)return fail\('This event has issued tickets or active reservations/);
});
