/** Verify the production backfill CLI against disposable PostgreSQL E2E fixtures.
 * Never permit this test to point to an external or production database.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {deriveEntryCode,entryCodeHash} from '../../src/lib/entry-code-core.ts';

if(process.env.EVENTPASS_E2E!=='true'||process.env.CI!=='true'||
 !/@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL||'')) {
 throw Error('Refusing to test legacy backfill outside disposable localhost CI PostgreSQL');
}
const sql=postgres(process.env.DATABASE_URL,{ssl:false,prepare:false,max:1});
const key=process.env.QR_SIGNING_SECRET||'';
if(key.length<32)throw Error('Isolated CI signing secret must be configured');

function backfill(apply=false) {
 const args=['--experimental-strip-types','scripts/backfill-entry-codes.mjs',...(apply?['--apply']:[])];
 const output=execFileSync(process.execPath,args,{
  encoding:'utf8',
  timeout:30000,
  env:{...process.env,ENTRY_CODE_BACKFILL_CONFIRM:'staging',ENTRY_CODE_BACKFILL_ALLOW_PRODUCTION:''}
 });
 const lines=output.trim().split('\n');
 return {summary:JSON.parse(lines[0]),result:apply?JSON.parse(lines.at(-1)).result:null};
}
test('legacy backfill indexes online and offline tickets without modifying ticket or financial state',async()=>{
 try {
  const [online]=await sql`select id,event_id,status,redeemed_at from tickets where status='issued' order by created_at desc limit 1`;
  const [offline]=await sql`select id,event_id,status,active,redeemed_at from offline_tickets where status='issued' order by created_at desc limit 1`;
  assert.ok(online&&offline,'E2E workflow must issue online and offline tickets before backfill test');
  const before=await sql`select (select count(*)::int from ticket_orders) as orders,
    (select count(*)::int from tickets) as online_tickets,
    (select count(*)::int from offline_tickets) as offline_tickets,
    (select count(*)::int from entry_scans) as scans`;

  // Simulate legacy tickets without changing an existing attendee credential.
  await sql`delete from ticket_entry_codes where ticket_id=${online.id} or offline_ticket_id=${offline.id}`;
  const [missing]=await sql`select
    (select count(*)::int from ticket_entry_codes where ticket_id=${online.id}) as online,
    (select count(*)::int from ticket_entry_codes where offline_ticket_id=${offline.id}) as offline`;
  assert.deepEqual({online:missing.online,offline:missing.offline},{online:0,offline:0});
  const dry=backfill(false);
  assert.equal(dry.summary.mode,'dry-run');
  const [afterDry]=await sql`select count(*)::int as count from ticket_entry_codes
    where ticket_id=${online.id} or offline_ticket_id=${offline.id}`;
  assert.equal(afterDry.count,0,'dry run must never insert an entry code');

  const first=backfill(true);
  assert.equal(first.summary.mode,'apply');
  assert.ok(first.result.inserted>=2,'both missing credentials were indexed');
  for(const [source,ticket] of [['online',online],['offline',offline]]) {
   const column=source==='online'?'ticket_id':'offline_ticket_id';
   const [entry]=await sql.unsafe('select event_id,code_hash from ticket_entry_codes where '+column+'=$1',[ticket.id]);
   assert.ok(entry,source+' entry code should exist');
   assert.equal(entry.event_id,ticket.event_id);
   assert.equal(entry.code_hash,entryCodeHash(deriveEntryCode(ticket.id,ticket.event_id,key)));
  }
  const second=backfill(true);
  assert.equal(second.result.inserted,0,'rerunning the backfill must not duplicate indexed codes');
  const after=await sql`select (select count(*)::int from ticket_orders) as orders,
    (select count(*)::int from tickets) as online_tickets,
    (select count(*)::int from offline_tickets) as offline_tickets,
    (select count(*)::int from entry_scans) as scans`;
  assert.deepEqual(after[0],before[0],'financial, ticket and scan counts must be unchanged');
  const [onlineAfter]=await sql`select status,redeemed_at from tickets where id=${online.id}`;
  const [offlineAfter]=await sql`select status,active,redeemed_at from offline_tickets where id=${offline.id}`;
  assert.equal(onlineAfter.status,online.status);
  assert.equal(onlineAfter.redeemed_at?.toISOString()??null,online.redeemed_at?.toISOString()??null);
  assert.equal(offlineAfter.status,offline.status);
  assert.equal(offlineAfter.active,offline.active);
  assert.equal(offlineAfter.redeemed_at?.toISOString()??null,offline.redeemed_at?.toISOString()??null);
 } finally {await sql.end()}
},{timeout:120000});
