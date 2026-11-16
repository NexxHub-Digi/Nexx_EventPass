import postgres from 'postgres';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
if(process.env.EVENTPASS_E2E!=='true'||process.env.CI!=='true')throw Error('E2E setup is CI-only');
if(!/@(localhost|127\.0\.0\.1):/.test(process.env.DATABASE_URL||''))throw Error('Refusing to initialise a non-local database');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const sql=postgres(process.env.DATABASE_URL,{ssl:false,prepare:false,max:1});
try{
 for(const file of ['db/schema.sql','db/migrations/20261116_approval_receipts_gates.sql',
  'db/migrations/20261116_gate_invite_tokens.sql','db/migrations/20261116_admin_audit.sql','db/migrations/20261116_auth_session_revocations.sql','db/migrations/20261116_event_studio_mobile_oauth.sql']){
  await sql.unsafe(readFileSync(resolve(root,file),'utf8'));
  console.log('Applied',file);
 }
}finally{await sql.end()}
