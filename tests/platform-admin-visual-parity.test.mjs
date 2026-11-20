import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const native=read('apps/platform-admin/App.tsx');
const overview=read('apps/platform-admin/PlatformOverview.tsx');
const sidebar=read('apps/platform-admin/AdminSidebar.tsx');
const web=read('src/components/RoleWorkspace.tsx');
const css=read('src/app/globals.css');

test('native Platform Administrator opens to a true data-backed Dashboard instead of menu list',()=>{
 assert.match(native,/useState<AdminPage>\('overview'\)/);
 assert.match(native,/setSection\('overview'\);setMenuOpen\(false\)/);
 assert.match(native,/<PlatformOverview fullName=\{member\.full_name\} summary=\{summary\}/);
 assert.match(overview,/Operations requiring attention/);
 assert.match(overview,/Platform performance/);
 assert.match(overview,/Recent administrator activity/);
 assert.match(overview,/recentActions\.slice\(0,5\)/);
 assert.doesNotMatch(overview,/Administration tools/);
 assert.match(overview,/Database-backed metrics/);
});
test('native sidebar contains ten sections with accessible selection and genuine menu navigation',()=>{
 for(const section of ['overview','organisers','accounts','events','analytics','finance','support','themes','audit','settings']){
  assert.ok(sidebar.includes("'"+section+"'"),'missing '+section+' from sidebar');
 }
 assert.match(sidebar,/accessibilityRole="button"/);
 assert.match(sidebar,/accessibilityState=\{\{selected\}\}/);
 assert.match(sidebar,/onPress=\{\(\)=>onNavigate\(key\)\}/);
 assert.match(native,/onNavigate=\{navigateAdmin\}/);
 assert.match(native,/setMenuOpen\(false\);scroll\.current\?\.scrollTo/);
 assert.doesNotMatch(native,/section==='more'/);
 assert.doesNotMatch(native,/\[\['overview','Overview'\],\['organisers','Organisers'\]/);
});
test('native layout has responsive desktop sidebar, mobile drawer and hardware-back close',()=>{
 assert.match(native,/useWindowDimensions/);
 assert.match(native,/desktopNavigation=viewportWidth>=900/);
 assert.match(native,/desktopNavigation&&showDesktopSidebar&&<AdminSidebar/);
 assert.match(native,/!desktopNavigation&&menuOpen&&<View style=\{s\.drawerOverlay\}/);
 assert.match(native,/BackHandler\.addEventListener\('hardwareBackPress'/);
 assert.match(native,/accessibilityLabel="Dismiss navigation drawer"/);
 assert.match(native,/onPress=\{\(\)=>navigateAdmin\('overview'\)\}/);
});
test('web Administrator and Organiser use separate responsive sidebar drawers and selected workspaces',()=>{
 assert.match(web,/ep-admin-workspace/);
 assert.match(web,/ep-organiser-workspace/);
 assert.match(web,/adminMenuOpen/);
 assert.match(web,/organiserMenuOpen/);
 assert.match(web,/aria-controls="platform-admin-navigation"/);
 assert.match(web,/aria-controls="organiser-workspace-navigation"/);
 assert.match(web,/aria-current=\{adminTab===key\?'page':undefined\}/);
 assert.match(css,/\.ep-admin-shell \.ep-admin-workspace\.is-collapsed/);
 assert.match(css,/\.ep-admin-shell \.ep-admin-sidebar\.is-open/);
 assert.match(css,/\.ep-organiser-workspace \.ep-organiser-sidebar\.is-open/);
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/focus-visible/);
});
test('native Dashboard retains real workload and finance data while avoiding menu duplication',()=>{
 assert.match(overview,/Object\.entries\(summary\)/);
 assert.match(overview,/useWindowDimensions\(\)/);
 assert.match(native,/pendingEvents=\{moderationEvents\.filter/);
 assert.match(native,/pendingRefunds=\{refundCases\.filter/);
 assert.match(native,/recentActions=\{auditHistory\}/);
 assert.match(native,/onRefresh=\{\(\)=>void exec\(async\(\)=>load\(token\)\)\}/);
});
