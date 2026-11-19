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
  'db/migrations/20261116_gate_invite_tokens.sql','db/migrations/20261116_admin_audit.sql','db/migrations/20261116_auth_session_revocations.sql','db/migrations/20261116_event_studio_mobile_oauth.sql','db/migrations/20261116_platform_crm_ticket_delivery.sql','db/migrations/20261116_masquerade_templates.sql','db/migrations/20261116_ticket_admission_label.sql','db/migrations/20261116_poster_templates.sql','db/migrations/20261118_inventory_reservations.sql','db/migrations/20261118_organiser_capabilities.sql','db/migrations/20261118_payment_audit.sql','db/migrations/20261119_offline_ticketing.sql','db/migrations/20261119_stable_ticket_credentials.sql','db/migrations/20261119_ticket_category_inventory.sql','db/migrations/20261119_payment_reconciliation.sql','db/migrations/20261119_verified_event_bank_accounts.sql','db/migrations/20261119_payment_review_notifications.sql','db/migrations/20261119_link_offline_entry_scans.sql','db/migrations/20261119_reservation_idempotency.sql','db/migrations/20261119_ticket_category_pricing.sql','db/migrations/20261119_unpaid_order_cancellation.sql','db/migrations/20261119_paystack_test_checkout.sql','db/migrations/20261119_rapid_gate_entry_codes.sql']){
  await sql.unsafe(readFileSync(resolve(root,file),'utf8'));
  console.log('Applied',file);
 }
}finally{await sql.end()}
