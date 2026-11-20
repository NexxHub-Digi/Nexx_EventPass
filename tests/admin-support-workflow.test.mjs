import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const web=read('src/components/RoleWorkspace.tsx');
const native=read('apps/platform-admin/App.tsx');
const dashboard=read('apps/platform-admin/PlatformOverview.tsx');
const route=read('src/app/api/support/cases/route.ts');
test('case resolution is required before closing and backend updates status, assignment, priority and audit atomically',()=>{
 assert.match(route,/\['resolved','closed'\]\.includes\(status\)&&finalResolution\.trim\(\)\.length<10/);
 assert.match(route,/await db\(\)\.begin\(async tx=>/);
 assert.match(route,/from platform_support_cases where id=\$\{id\} for update/);
 assert.match(route,/set status=\$\{status\},priority=\$\{priority\},resolution=\$\{finalResolution\},assigned_to=\$\{u\.id\}/);
 assert.match(route,/platform_admin_actions/);
 assert.match(route,/fromStatus:previous\.status,toStatus:status/);
 assert.match(route,/No changes to save for this support case/);
});
test('web Support case editor binds each priority and resolution to a specific case',()=>{
 assert.match(web,/selectedSupportId/);
 assert.match(web,/supportDrafts\[c\.id\]/);
 assert.match(web,/Resolution \/ guidance for this case/);
 assert.match(web,/onClick=\{\(\)=>openSupportCaseEditor\(c\)\}/);
 assert.match(web,/await api\('support\/cases','PATCH',\{id:c\.id,status,priority:draft\.priority,resolution:draft\.resolution\.trim\(\)\}\)/);
 assert.match(web,/Open case \/ take action/);
 assert.match(web,/Resolve case/);
 assert.match(web,/Reopen case/);
 assert.match(web,/Save priority \/ notes/);
 assert.doesNotMatch(web,/resolution:caseResolution/);
});
test('native Support actions are case-scoped, editable and require confirmation',()=>{
 assert.match(native,/supportDrafts\[c\.id\]/);
 assert.match(native,/Resolution for '\+c\.subject/);
 assert.match(native,/Confirm support action/);
 assert.match(native,/priority:draft\.priority,resolution:draft\.resolution\.trim\(\)/);
 assert.match(native,/Refresh support cases/);
 assert.match(native,/Save case details/);
 assert.doesNotMatch(native,/priority:'normal',resolution/);
});
test('both Platform Administrator overview dashboards expose support and actionable review queues',()=>{
 for(const q of ["Open support cases","Bank verification requests","Event / media reviews","Unresolved refund cases","Refresh dashboard"])assert.ok(web.includes(q),q);
 assert.match(web,/setAdminTab\(tab\)/);
 assert.match(web,/onClick=\{\(\)=>\{setSelectedSupportId\(c\.id\)/);
 assert.match(native,/pendingSupport=\{cases\.filter/);
 assert.match(native,/pendingBanks=\{bankAccounts\.filter/);
 assert.match(dashboard,/Support needing action/);
 assert.match(dashboard,/Bank verification requests/);
 assert.match(dashboard,/onNavigate\(target\)/);
});
