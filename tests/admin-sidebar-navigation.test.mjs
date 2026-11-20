import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const adminWeb=read('src/components/RoleWorkspace.tsx');
const adminNative=read('apps/platform-admin/App.tsx');
const sidebar=read('apps/platform-admin/AdminSidebar.tsx');
const dashboard=read('apps/platform-admin/PlatformOverview.tsx');
const css=read('src/app/globals.css');
const api=read('src/app/api/platform/settings/route.ts');

test('Platform Administrator web starts in Dashboard with a single selected workspace',()=>{
 assert.match(adminWeb,/useState\('overview'\)/);
 assert.match(adminWeb,/platform-admin-navigation/);
 assert.match(adminWeb,/ep-admin-workspace/);
 assert.match(adminWeb,/ep-admin-main-header/);
 assert.match(adminWeb,/adminMenuItems\.find/);
 assert.match(adminWeb,/navigateAdmin\(key\)/);
 assert.match(adminWeb,/setAdminMenuOpen\(false\)/);
 assert.match(adminWeb,/aria-current=\{adminTab===key\?'page':undefined\}/);
 assert.match(adminWeb,/adminTab==='overview'/);
});
test('Platform Administrator web uses desktop sidebar, mobile drawer, correct Escape/backdrop and focus states',()=>{
 assert.match(adminWeb,/aria-controls="platform-admin-navigation"/);
 assert.match(adminWeb,/aria-label="Close administrator menu"/);
 assert.match(adminWeb,/setAdminNavCollapsed\(x=>!x\)/);
 assert.match(adminWeb,/setAdminMenuOpen\(x=>!x\)/);
 assert.match(adminWeb,/event\.key==='Escape'/);
 assert.match(css,/\.ep-admin-shell \.ep-admin-sidebar\.is-open/);
 assert.match(css,/\.ep-admin-shell \.ep-admin-workspace\.is-collapsed/);
 assert.match(css,/\.ep-admin-drawer-scrim/);
 assert.match(css,/focus-visible/);
});
test('the organiser web workspace also uses a sidebar and mobile drawer rather than a stacked menu',()=>{
 assert.match(adminWeb,/ep-organiser-workspace/);
 assert.match(adminWeb,/organiser-workspace-navigation/);
 assert.match(adminWeb,/setOrganiserMenuOpen\(false\)/);
 assert.match(adminWeb,/navigateOrganiser\(tab\)/);
 assert.match(css,/\.ep-organiser-workspace \.ep-organiser-sidebar\.is-open/);
});
test('native Administrator has ten grouped menu sections with no More screen or bottom tab maze',()=>{
 for(const tab of ['overview','organisers','accounts','events','analytics','finance','support','themes','audit','settings']){
  assert.ok(sidebar.includes("'"+tab+"'"),'missing tab '+tab);
 }
 assert.match(sidebar,/accessibilityState=\{\{selected\}\}/);
 assert.match(adminNative,/desktopNavigation&&showDesktopSidebar&&<AdminSidebar/);
 assert.match(adminNative,/!desktopNavigation&&menuOpen&&<View style=\{s\.drawerOverlay\}/);
 assert.match(adminNative,/onNavigate=\{navigateAdmin\}/);
 assert.match(adminNative,/setSection\('overview'\);setMenuOpen\(false\)/);
 assert.doesNotMatch(adminNative,/section==='more'/);
 assert.doesNotMatch(adminNative,/<View style=\{s\.navigation\}>/);
});
test('Dashboard is live and focuses on workload, finance, and audit activity instead of duplicate menu tiles',()=>{
 assert.match(dashboard,/Operations requiring attention/);
 assert.match(dashboard,/Platform performance/);
 assert.match(dashboard,/Recent administrator activity/);
 assert.match(dashboard,/recentActions\.slice\(0,5\)/);
 assert.doesNotMatch(dashboard,/Administration tools/);
 assert.match(adminNative,/recentActions=\{auditHistory\}/);
 assert.match(adminWeb,/ep-admin-queues/);
 assert.match(adminWeb,/Recent support activity/);
});
test('admin sections load independently and expose failures and retry instead of blanking every menu',()=>{
 assert.match(adminWeb,/Promise\.allSettled\(calls\.map/);
 assert.match(adminWeb,/setAdminLoadIssues\(adminIssues\)/);
 assert.match(adminWeb,/Some administrator modules could not load/);
 assert.match(adminWeb,/Retry modules/);
 assert.match(adminNative,/Promise\.allSettled\(services\.map/);
 assert.match(adminNative,/setLoadWarnings\(warnings\)/);
 assert.match(adminNative,/Retry loading affected modules/);
});
test('native Settings selects whitelisted, server-persisted values with active save and reload',()=>{
 for(const key of ['support_email','organiser_approval_policy','event_verification_policy','help_text']){
  assert.ok(adminNative.includes("'"+key+"'"),'missing configurable policy '+key);
  assert.ok(api.includes("'"+key+"'"),'missing server whitelist '+key);
 }
 assert.match(adminNative,/Edit selected setting/);
 assert.match(adminNative,/Save and verify setting/);
 assert.match(adminNative,/Reload saved settings/);
 assert.match(adminNative,/await api\('platform\/settings',token,'PATCH'/);
 assert.match(adminNative,/setSettingValue\(String\(result\.settings\?\.\[settingKey\]/);
 assert.doesNotMatch(adminNative,/input\('Setting key'/);
});
