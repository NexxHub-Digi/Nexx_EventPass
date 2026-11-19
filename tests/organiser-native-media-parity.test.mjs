import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const native=readFileSync(new URL('../apps/organiser/App.tsx',import.meta.url),'utf8');
const mediaRoute=readFileSync(new URL('../src/app/api/events/media/route.ts',import.meta.url),'utf8');

test('organiser may confirm remove of uploaded artwork with safe server state refresh',()=>{
 assert.match(native,/function confirmRemoveMedia\(mediaId:string\)/);
 assert.match(native,/Alert\.alert\('Remove uploaded artwork\?'/);
 assert.match(native,/style:'destructive'/);
 assert.match(native,/api\('events\/media',token,'DELETE',\{id:mediaId\}\)/);
 assert.match(native,/setMedia\(\(await api\('events\/media\?eventId='/);
 assert.match(native,/accessibilityLabel=\{'Remove '\+/);
 assert.match(native,/No media uploaded for this event/);
});
test('backend protects issued artwork and enforces owner access on deletion',()=>{
 assert.match(mediaRoute,/u\.role!=='organiser'\|\|u\.account_status!=='active'/);
 assert.match(mediaRoute,/ticket_deliveries d where d\.ticket_art_id=\$\{mediaId\}/);
 assert.match(mediaRoute,/Artwork is attached to issued tickets and must remain available/);
 assert.match(mediaRoute,/e\.organiser_id=\$\{u\.id\}/);
});
test('media moderation status returned from API supports honest native review labels',()=>{
 assert.match(mediaRoute,/select m\.id,m\.event_id,m\.media_type,m\.mime_type,m\.file_name,m\.approved,m\.created_at/);
 assert.match(native,/m\.approved\?'✓ Approved':'Pending media review'/);
 assert.match(native,/m\.file_name\|\|m\.media_type/);
});
test('design previews use the event being created or the actual selected existing event',()=>{
 assert.match(native,/eventTitle\|\|'Your Masquerade Event'/);
 assert.match(native,/<TicketStudioPreview key=\{eventId\} eventId=\{eventId\}/);
 assert.match(native,/title=\{events\.find\(e=>e\.id===eventId\)\?\.title\|\|''\}/);
 assert.match(native,/venue=\{events\.find\(e=>e\.id===eventId\)\?\.venue\|\|''\}/);
 const preview=readFileSync(new URL('../apps/organiser/TicketStudioPreview.tsx',import.meta.url),'utf8');
 assert.match(preview,/NO REUSABLE OR DEMO ADMISSION CODE/);
 assert.match(native,/QR GENERATED ON APPROVAL/);
});
