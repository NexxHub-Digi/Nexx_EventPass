/**
 * Backfill deterministic, one-way backup admission codes for previously issued
 * online and offline tickets. No ticket QR or payment state is changed.
 *
 * Dry run (default):
 *   DATABASE_URL=... QR_SIGNING_SECRET=... node --experimental-strip-types scripts/backfill-entry-codes.mjs
 *
 * Explicit staging apply:
 *   ENTRY_CODE_BACKFILL_CONFIRM=staging node --experimental-strip-types scripts/backfill-entry-codes.mjs --apply
 * Explicit production apply additionally requires:
 *   ENTRY_CODE_BACKFILL_CONFIRM=production ENTRY_CODE_BACKFILL_ALLOW_PRODUCTION=YES
 *
 * Run only with the exact QR_SIGNING_SECRET used when tickets are delivered.
 * Never print credentials, codes, signing secrets, or connection strings.
 */
import postgres from 'postgres';
import {deriveEntryCode,entryCodeHash} from '../src/lib/entry-code-core.ts';

const key=process.env.QR_SIGNING_SECRET||'';
const connection=process.env.DATABASE_URL||'';
if(!connection)throw Error('DATABASE_URL is required');
if(key.length<32)throw Error('QR_SIGNING_SECRET must be at least 32 characters');
const apply=process.argv.includes('--apply');
const environment=process.env.ENTRY_CODE_BACKFILL_CONFIRM||'';
if(apply&&!['staging','production'].includes(environment))
 throw Error('Set ENTRY_CODE_BACKFILL_CONFIRM=staging or production for --apply');
if(apply&&environment==='production'&&process.env.ENTRY_CODE_BACKFILL_ALLOW_PRODUCTION!=='YES')
 throw Error('Production backfill requires ENTRY_CODE_BACKFILL_ALLOW_PRODUCTION=YES');

const sql=postgres(connection,{max:1,connect_timeout:10});
try{
 const counts=await sql`select
 (select count(*)::int from tickets where status='issued') as online_issued,
 (select count(*)::int from offline_tickets where status='issued') as offline_issued,
 (select count(*)::int from ticket_entry_codes) as indexed`;
 console.log(JSON.stringify({mode:apply?'apply':'dry-run',...counts[0]}));
 if(!apply){console.log('No writes. Pass --apply with explicit environment confirmation.');}
 else {
  const result=await sql.begin(async tx=>{
   const tickets=await tx`select id,event_id,'online' as source from tickets where status='issued'
      union all select id,event_id,'offline' as source from offline_tickets where status='issued'`;
   let inserted=0;
   for(const row of tickets){
    const code_hash=entryCodeHash(deriveEntryCode(row.id,row.event_id,key));
    if(!code_hash)throw Error('Unable to derive indexed entry code');
    const existing=await tx`insert into ticket_entry_codes(event_id,code_hash,ticket_id,offline_ticket_id)
      values(${row.event_id},${code_hash},
       ${row.source==='online'?row.id:null},${row.source==='offline'?row.id:null})
      on conflict do nothing returning code_hash`;
    inserted+=existing.length;
   }
   return {examined:tickets.length,inserted,alreadyIndexed:tickets.length-inserted};
  });
  console.log(JSON.stringify({result,environment}));
 }
}finally{await sql.end();}
