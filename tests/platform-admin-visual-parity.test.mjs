import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const native=read('apps/platform-admin/App.tsx');
const overview=read('apps/platform-admin/PlatformOverview.tsx');
const web=read('src/components/RoleWorkspace.tsx');
const css=read('src/app/globals.css');

test('the native Platform Administrator renders a purpose-built operational dashboard instead of stacked generic cards',()=>{
 assert.match(native,/import PlatformOverview from '\.\/PlatformOverview'/);
 assert.match(native,/<PlatformOverview fullName=\{member\.full_name\} summary=\{summary\}/);
 assert.doesNotMatch(native,/Object\.entries\(summary\)\.map\(\(\[key,value\]\)=>/);
 assert.match(overview,/Operations requiring attention/);
 assert.match(overview,/Platform performance/);
 assert.match(overview,/Administration tools/);
 assert.match(overview,/Database-backed metrics/);
});
test('all ten administrator functions have a reachable responsive command-centre action or bottom navigation',()=>{
 for(const section of ['organisers','accounts','events','analytics','finance','support','themes','audit','settings']){
  assert.ok(overview.includes("'"+section+"'"),section+' is missing from tool navigation');
 }
 assert.match(native,/\['overview','Overview'\]/);
 assert.match(overview,/onNavigate\(key\)/);
 assert.match(overview,/onNavigate\(target\)/);
 assert.match(native,/sectionBannerTitle/);
 assert.match(native,/sectionEyebrow/);
});
test('native responsive layout, accessibility and operational metrics remain real-data driven',()=>{
 assert.match(overview,/useWindowDimensions\(\)/);
 assert.match(overview,/width<380/);
 assert.match(overview,/accessibilityRole="button"/);
 assert.match(overview,/accessibilityLabel=\{'Open '\+title\}/);
 assert.match(overview,/Object\.entries\(summary\)/);
 assert.match(native,/pendingEvents=\{moderationEvents\.filter/);
 assert.match(native,/pendingRefunds=\{refundCases\.filter/);
 assert.match(native,/onRefresh=\{\(\)=>void exec\(async\(\)=>load\(token\)\)\}/);
});
test('web administrator uses dedicated Nexx Future styles and mobile accessibility breakpoints',()=>{
 assert.match(web,/rw-shell ep-admin-shell/);
 assert.match(web,/ep-admin-hero/);
 assert.match(web,/ep-admin-sidebar/);
 assert.match(web,/ep-admin-kpis/);
 assert.match(css,/\.ep-admin-shell \.ep-admin-hero/);
 assert.match(css,/\.ep-admin-shell \.ep-admin-kpis/);
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/@media\(max-width:550px\)/);
 assert.match(css,/@media\(max-width:340px\)/);
 assert.match(css, /prefers-reduced-motion:reduce/);
 assert.match(css, /focus-visible/);
});
