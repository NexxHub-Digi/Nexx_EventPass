import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('gate discovery and protected web access use published verified events with active organisers',()=>{
 for(const path of ['src/app/api/auth/me/route.ts','src/lib/portal-access.ts']){
  const source=read(path);
  assert.match(source,/e\.status='published'/,path);
  assert.match(source,/e\.verification_status='verified'/,path);
  assert.match(source,/owner\.role='organiser'/,path);
  assert.match(source,/owner\.account_status='active'/,path);
  assert.match(source,/e\.organiser_id=\$\{user\.id\}/,path);
  assert.match(source,/g\.event_id=e\.id and g\.user_id=\$\{user\.id\}/,path);
 }
});
test('role-specific Google gate callback cannot elevate a draft event or suspended operator',()=>{
 const source=read('src/app/api/auth/google/callback/route.ts');
 assert.match(source,/e\.status='published'/);
 assert.match(source,/e\.verification_status='verified'/);
 assert.match(source,/owner\.role='organiser'/);
 assert.match(source,/owner\.account_status='active'/);
 assert.match(source,/lower\(owner\.email\)=\$\{profile\.email\}/);
 assert.match(source,/g\.event_id=e\.id and lower\(operator\.email\)=\$\{profile\.email\}/);
 assert.match(source,/operator\.account_status='active'/);
});
test('online redemption uses the same event and organiser restrictions',()=>{
 const source=read('src/app/api/scan/route.ts');
 assert.match(source,/e\.status='published'/);
 assert.match(source,/e\.verification_status='verified'/);
 assert.match(source,/owner\.role='organiser'/);
 assert.match(source,/owner\.account_status='active'/);
});
