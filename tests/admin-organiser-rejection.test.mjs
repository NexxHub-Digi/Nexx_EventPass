import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const route=read('src/app/api/platform/organisers/route.ts');
const audit=read('src/app/api/platform/audit/route.ts');
const web=read('src/components/RoleWorkspace.tsx');
const native=read('apps/platform-admin/App.tsx');

test('API rejects no-reason decisions and audits accepted rationale within same transaction',()=>{
 assert.match(route,/reason=str\(b\.reason,400\)/);
 assert.match(route,/if\(reason\.length<10\)return fail/);
 assert.match(route,/select id from app_users where id=\$\{id\} and role='user' and requested_role='organiser' and account_status='active' for update/);
 assert.match(route,/await tx`update app_users set requested_role=null where id=\$\{id\}`/);
 assert.match(route,/await tx`insert into platform_admin_actions\(admin_id,target_user_id,action,details\)/);
 assert.match(route,/tx\.json\(\{reason\}\)/);
 assert.match(audit,/a\.details/);
});
test('both admin portals present reason fields and confirmation before rejection',()=>{
 assert.match(web,/Reason for rejecting this application/);
 assert.match(web,/minLength=\{10\}/);
 assert.match(web,/Reject this organiser application with the recorded reason\?/);
 assert.match(web,/reason:rejectOrganiserReason\.trim\(\)/);
 assert.match(native,/Organiser rejection reason/);
 assert.match(native,/min(imum)? 10 characters/);
 assert.match(native,/Reject organiser application\?/);
 assert.match(native,/reason:rejectReason\.trim\(\)/);
});
test('native audit displays rejection reason and successful outcome after server acknowledgement',()=>{
 assert.match(native,/item\.details\?\.reason/);
 assert.match(native,/Application rejected/);
 assert.match(native,/await load\(token\)/);
});
