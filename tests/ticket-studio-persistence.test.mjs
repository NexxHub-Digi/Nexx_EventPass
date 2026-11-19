import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const api=read('src/app/api/organiser/ticket-designs/route.ts');
const sql=read('db/migrations/20261119_ticket_studio_design_versions.sql');
const web=read('src/components/TicketStudioEditor.tsx');
const native=read('apps/organiser/TicketStudioPreview.tsx');
const workspace=read('src/components/RoleWorkspace.tsx');
const app=read('apps/organiser/App.tsx');

test('design versions are append-only and do not rewrite issued credentials',()=>{
 assert.match(sql,/create table if not exists event_ticket_design_versions/);
 assert.match(sql,/unique\(event_id,version\)/);
 assert.match(sql,/fields jsonb not null/);
 assert.match(sql,/enabled jsonb not null/);
 assert.doesNotMatch(sql,/alter table tickets|alter table ticket_deliveries|alter table offline_tickets/i);
 assert.match(api,/insert into event_ticket_design_versions/);
 assert.match(api,/for update/);
 assert.doesNotMatch(api,/update tickets|update ticket_deliveries|update offline_tickets/i);
});
test('organiser-only authorisation and strict field validation protect stored drafts',()=>{
 assert.match(api,/u.role!=='organiser'/);
 assert.match(api,/u.account_status!=='active'/);
 assert.match(api,/e.organiser_id=\$\{u.id\}/);
 assert.match(api,/organiser_id=\$\{u.id\} for update/);
 assert.match(api,/Object.keys\(fields\).length!==keys.length/);
 assert.match(api,/typeof enabled\[key\]!=='boolean'/);
 assert.match(api,/ticket_theme_catalog where id=\$\{draft.theme\} and active=true/);
});
test('web and native clients use the identical scoped draft API with save and restore',()=>{
 assert.match(workspace,/<TicketStudioEditor key=\{eventId\} eventId=\{eventId\}/);
 assert.match(web,/fetch\('\/api\/organiser\/ticket-designs\?eventId='/);
 assert.match(web,/method:'POST'/);
 assert.match(web,/Save versioned design draft/);
 assert.match(app,/token=\{token\} apiBase=\{BASE\}/);
 assert.match(native,/apiBase\+'\/api\/organiser\/ticket-designs\?eventId='/);
 assert.match(native,/method:'POST'/);
 assert.match(native,/Save versioned design draft/);
 assert.match(native,/Existing issued tickets are unchanged/);
});
