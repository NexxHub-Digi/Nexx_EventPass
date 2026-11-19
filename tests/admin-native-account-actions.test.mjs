import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const native=read('apps/platform-admin/App.tsx');
const accounts=read('src/app/api/platform/users/route.ts');
const web=read('src/components/RoleWorkspace.tsx');

test('native account management opens and closes details and displays verified identity and server counts',()=>{
 assert.match(native,/Close user profile/);
 assert.match(native,/setSelectedAccount\(current=>current===a\.id\?'':a\.id\)/);
 assert.match(native,/setDeactivateReason\(''\)/);
 assert.match(native,/Google identity: \{a\.google_verified/);
 assert.match(native,/a\.order_count/);
 assert.match(native,/a\.ticket_count/);
 assert.match(native,/a\.gate_event_count/);
 assert.match(accounts,/oauth_identities oi where oi\.user_id=u\.id and oi\.provider='google'/);
});
test('native account suspension and restoration require human confirmation, retain audit records and protect platform administrators',()=>{
 assert.match(native,/Suspend this account\?/);
 assert.match(native,/Restore account access\?/);
 assert.match(native,/Existing orders, ticket admissions and audit history are retained/);
 assert.match(native,/style:'destructive',onPress:\(\)=>void changeAccount\('suspend'\)/);
 assert.match(native,/onPress:\(\)=>void changeAccount\('restore'\)/);
 assert.match(native,/Platform Administrator accounts cannot be changed here/);
 assert.doesNotMatch(native,/button\('Suspend account',\(\)=>\{void changeAccount\('suspend'\)\}/);
 assert.match(accounts,/userId===admin\.id/);
 assert.match(accounts,/target\[0\]\.role==='platform_admin'/);
 assert.match(accounts,/insert into platform_admin_actions/);
});
test('native deactivation confirms permanent audit retention and requires a reason like the existing web workflow',()=>{
 assert.match(native,/Deactivate account\?/);
 assert.match(native,/A written reason is required/);
 assert.match(native,/if\(action==='deactivate'&&!deactivateReason\.trim\(\)\)/);
 assert.match(accounts,/if\(action==='deactivate'&&!reason\)/);
 assert.match(accounts,/soft_deactivate_user/);
 assert.match(web,/window\.confirm\('Suspend this account\?/);
});
