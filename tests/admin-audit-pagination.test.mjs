import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const route=read('src/app/api/platform/audit/route.ts');
const web=read('src/components/RoleWorkspace.tsx');
const native=read('apps/platform-admin/App.tsx');
test('audit API allows only active administrators and enforces bounded pagination',()=>{
 assert.match(route,/u.role!=='platform_admin'/);
 assert.match(route,/u.account_status!=='active'/);
 assert.match(route,/Number.isSafeInteger\(rawPage\)/);
 assert.match(route,/pageSize=30/);
 assert.match(route,/limit \$\{pageSize\} offset \$\{offset\}/);
 assert.match(route,/count\(\*\)::int/);
 assert.match(route,/action ilike/);
});
test('web audit controls submit search and action filters then paginate server records',()=>{
 assert.match(web,/auditQuery,setAuditQuery/);
 assert.match(web,/auditAction,setAuditAction/);
 assert.match(web,/async function searchAudit\(page:number\)/);
 assert.match(web,/api\('platform\/audit\?'\+q.toString\(\)\)/);
 assert.match(web,/Search audit history/);
 assert.match(web,/Previous page/);
 assert.match(web,/Next page/);
});
test('native audit controls use authenticated API and show error and navigation feedback',()=>{
 assert.match(native,/async function searchAudit\(page:number\)/);
 assert.match(native,/api\('platform\/audit\?'\+params.toString\(\),token\)/);
 assert.match(native,/Search audit records/);
 assert.match(native,/Refresh audit results/);
 assert.match(native,/matching actions/);
 assert.match(native,/JSON.stringify\(item.details\)/);
});
