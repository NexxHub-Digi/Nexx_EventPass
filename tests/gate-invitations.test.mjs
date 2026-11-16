import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('any invited email receives a one-time SHA-256 token and 72-hour expiry',()=>{
 const src=read('src/app/api/gates/route.ts');
 assert.match(src,/randomBytes\(32\)/);
 assert.match(src,/createHash\('sha256'\)/);
 assert.match(src,/interval '72 hours'/);
 assert.match(src,/on conflict\(event_id,invitee_email\)/);
 assert.doesNotMatch(src,/password_hash/);
});
test('invitation acceptance requires authenticated matching email and active organiser',()=>{
 const src=read('src/app/api/gates/accept/route.ts');
 assert.match(src,/currentUser\(\)/);
 assert.match(src,/i\.invitee_email\.toLowerCase\(\)!==u\.email\.toLowerCase\(\)/);
 assert.match(src,/i\.organiser_status!=='active'/);
 assert.match(src,/i\.status!=='pending'/);
 assert.match(src,/for update of i/);
 assert.match(src,/token_hash=null/);
});
test('only an owning organiser can add or revoke an event operator',()=>{
 const src=read('src/app/api/gates/route.ts');
 assert.match(src,/u\.role!=='organiser'/);
 assert.match(src,/event_id=\$\{eventId\}/);
 assert.match(src,/mode,10\)==='add'/);
 assert.match(src,/ident\.provider='google'/);
 assert.match(src,/delete from gate_assignments/);
});
test('Google invitation continuation is validated and returned only to same-app paths',()=>{
 const src=read('src/app/api/auth/google/route.ts');
 const cb=read('src/app/api/auth/google/callback/route.ts');
 assert.match(src,/returnTo/);
 assert.match(src,/\/invite\\\/gate/);
 assert.match(cb,/safeInvite/);
 assert.match(cb,/st\.returnTo/);
});
test('organiser interfaces support invite and add while gate interface stays scoped',()=>{
 const web=read('src/components/RoleWorkspace.tsx');
 const gate=read('src/app/api/scan/route.ts');
 assert.match(web,/addExistingOperator/);
 assert.match(web,/latestInvite/);
 assert.match(gate,/gate_assignments/);
 assert.match(gate,/owner\.role='organiser'/);
});
