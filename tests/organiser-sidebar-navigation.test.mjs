import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('apps/organiser/App.tsx');
const nav=read('apps/organiser/OrganiserSidebar.tsx');

test('organiser starts at dashboard on Google sign-in and has only one selected workspace',()=>{
 assert.match(app,/useState<OrganiserPage>\('dashboard'\)/);
 assert.match(app,/setTab\('dashboard'\);setMenuOpen\(false\)/);
 assert.match(app,/onPress=\{\(\)=>navigateOrganiser\('dashboard'\)\}/);
 assert.match(app,/tab==='dashboard'&&<View style=\{s\.dashboard\}/);
 assert.match(nav,/accessibilityState=\{\{selected:active===tab\}\}/);
});
test('organiser has a persistent desktop sidebar and a mobile drawer instead of a long bottom tab strip',()=>{
 for(const section of ['dashboard','events','tickets','payments','team','profile'])assert.ok(nav.includes("'"+section+"'"),section+' missing');
 assert.match(app,/desktopNavigation&&showDesktopSidebar&&<View style=\{s\.sidebarDesktop\}/);
 assert.match(app,/!desktopNavigation&&menuOpen&&<View style=\{s\.drawerOverlay\}/);
 assert.match(app,/accessibilityLabel="Dismiss organiser menu"/);
 assert.match(app,/BackHandler\.addEventListener\('hardwareBackPress'/);
 assert.match(app,/onSelect=\{navigateOrganiser\}/);
 assert.doesNotMatch(app,/<View style=\{s\.navigation\}>/);
});
test('the organiser dashboard contains real events, payment inbox and finance metrics',()=>{
 assert.match(app,/events\.filter\(e=>e\.organiser_id===member\.id\)\.length/);
 assert.match(app,/inbox\.pending/);
 assert.match(app,/inbox\.unread/);
 assert.match(app,/finances\.gross_ngn/);
 assert.match(app,/finances\.commission_ngn/);
 assert.match(app,/finances\.organiser_net_ngn/);
 assert.match(app,/finances\.outstanding_ngn/);
 assert.match(app,/Verified payments only/);
});
test('contextual event selector appears only where it is useful',()=>{
 assert.match(app,/\['events','tickets','payments','team'\] as OrganiserPage\[\]/);
 assert.match(app,/\.includes\(tab\)&&events\.some/);
 assert.match(app,/setEventId\(e\.id\)/);
});
