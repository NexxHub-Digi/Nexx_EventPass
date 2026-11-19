import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterDiscoveryEvents,toggleSavedEvent} from '../apps/user/discovery.ts';

const published=(id,title,price,category='Music')=>({
 id,title,venue:'Ilorin Arena',description:'Live show',category,
 price_ngn:price,status:'published',visibility:'public'
});
const data=[published('b','Zebra',5000),published('a','Alpha',1000),
 {...published('private','Private Show',200),visibility:'private'},
 {...published('draft','Draft Show',100),status:'draft'},
 published('c','Conference',2000,'Business')];

test('native discovery excludes private and draft events before filtering',()=>{
 const results=filterDiscoveryEvents(data,{section:'discover',query:'',category:'All',sortBy:'name',saved:[]});
 assert.deepEqual(results.map(e=>e.id),['a','c','b']);
});
test('saved view contains only bookmarked public events, even when an old bookmark becomes private',()=>{
 const saved=['a','private','b'];
 const result=filterDiscoveryEvents(data,{section:'saved',query:'',category:'All',sortBy:'name',saved});
 assert.deepEqual(result.map(e=>e.id),['a','b']);
 const reduced=toggleSavedEvent(saved,'b');
 assert.deepEqual(reduced,['a','private']);
 assert.deepEqual(toggleSavedEvent(reduced,'b'),saved);
});
test('category, search, lowest-price sorting and name sorting compose without mutation',()=>{
 const before=data.map(e=>e.id);
 assert.deepEqual(filterDiscoveryEvents(data,{section:'discover',query:'arena',category:'Music',sortBy:'price',saved:[]}).map(e=>e.id),['a','b']);
 assert.deepEqual(filterDiscoveryEvents(data,{section:'discover',query:'confer',category:'Business',sortBy:'name',saved:[]}).map(e=>e.id),['c']);
 assert.deepEqual(data.map(e=>e.id),before);
});
test('native UI exposes accessible bookmark, navigation, count, sorting and empty states',()=>{
 const native=readFileSync(new URL('../apps/user/App.tsx',import.meta.url),'utf8');
 assert.match(native,/\['saved', 'Saved'\]/);
 assert.match(native,/accessibilityLabel=\{saved\.includes\(e\.id\)\?'Remove from saved':'Save event'\}/);
 assert.match(native,/accessibilityLabel="Sort events"/);
 assert.match(native,/visibleEvents\.length/);
 assert.match(native,/No saved events match your filters/);
 assert.match(native,/setSaved\(\[\]\)/);
});
