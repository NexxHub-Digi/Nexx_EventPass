import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const native=read('apps/platform-admin/App.tsx');
const sidebar=read('apps/platform-admin/AdminSidebar.tsx');
const themes=read('src/app/api/ticket-themes/route.ts');
const events=read('src/app/api/platform/event-directory/route.ts');
const users=read('src/app/api/platform/users/route.ts');
const organisers=read('src/app/api/platform/organisers/route.ts');

test('native admin navigation offers all ten sections in sidebar and no duplicate More list',()=>{
 for(const section of ['overview','organisers','accounts','events','analytics','finance','support','themes','audit','settings']){
  assert.match(sidebar,new RegExp("'"+section+"'"),section+' section absent from sidebar');
 }
 assert.match(sidebar,/Events & analytics/);
 assert.match(sidebar,/Ticket themes/);
 assert.match(sidebar,/Users & access/);
 assert.match(native,/section==='themes'/);
 assert.match(native,/section==='analytics'/);
 assert.match(native,/navigateAdmin\('overview'\)/);
 assert.match(native,/setMenuOpen\(false\)/);
 assert.match(sidebar,/accessibilityRole="button"/);
 assert.doesNotMatch(native,/section==='more'/);
});
test('events analytics source is the permission-protected directory, with accurate financial labels',()=>{
 assert.match(native,/api\('platform\/event-directory',t\)/);
 assert.match(native,/api\('platform\/event-directory\?q='/);
 assert.match(native,/Confirmed order revenue/);
 assert.match(native,/Pending orders:/);
 assert.match(native,/Refund cases:/);
 assert.match(events,/\!\['organiser','platform_admin'\]\.includes\(u\.role\)/);
 assert.match(events,/confirmed_revenue_ngn/);
});
test('administrator native ticket theme publisher uses existing guarded API',()=>{
 assert.match(native,/api\('ticket-themes',token,'POST'/);
 assert.match(native,/Create ticket theme/);
 assert.match(native,/Available themes/);
 assert.match(native,/Publish new ticket theme\?/);
 assert.match(themes,/u.role!=='platform_admin'/);
 assert.match(themes,/\!\[a,c,accent\]\.every\(hex\)/);
});
test('native account search has role filters and bounded previous\/next pagination',()=>{
 assert.match(native,/role='\+encodeURIComponent\(role\)/);
 assert.match(native,/&page='\+page/);
 assert.match(native,/Search accounts/);
 assert.match(native,/Showing page \{accountPage\}/);
 assert.match(native,/accountPage\*40>=accountCount/);
 assert.match(users,/limit 40 offset \$\{offset\}/);
});
test('organiser profile and capability controls use audited, owner-targeted APIs',()=>{
 assert.match(native,/View organiser profile/);
 assert.match(native,/updateOrganiserName\(a.id\)/);
 assert.match(native,/action:'capabilities',userId:a.id/);
 assert.match(native,/Change organiser permission\?/);
 assert.match(native,/accessibilityRole="switch"/);
 assert.match(organisers,/update_organiser_capabilities/);
 assert.match(organisers,/configure_organiser/);
});
