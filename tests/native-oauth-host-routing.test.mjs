import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const login=read('src/app/api/auth/google/route.ts');
const callback=read('src/app/api/auth/google/callback/route.ts');
const native=read('apps/gate/App.tsx');

test('production aliases canonicalize before setting the OAuth state cookie',()=>{
 assert.match(login,/process\.env\.VERCEL_ENV === 'production'/);
 assert.match(login,/req\.nextUrl\.origin!==canonical\.origin/);
 assert.match(login,/target\.search=req\.nextUrl\.search/);
 assert.match(login,/return NextResponse\.redirect\(target,\{status:307\}\)/);
 assert.ok(login.indexOf('return NextResponse.redirect(target')<login.indexOf('const state=randomValue()'));
});
test('staging OAuth remains on its own origin',()=>{
 assert.match(login,/Preview uses its own staging host/);
 assert.match(login,/callbackUrl\(req\.nextUrl\.origin\)/);
});
test('native callback errors return to original app, not a web login',()=>{
 assert.match(callback,/nativeFlow=st\.native===true/);
 assert.match(callback,/new URL\(nativeSchemes\[portal\]\+'\:\/\/oauth'\)/);
 assert.match(callback,/u\.searchParams\.set\('error',code\)/);
 assert.match(callback,/response=back\(origin,portal,safeReason,nativeFlow\)/);
 assert.match(native,/returned\.searchParams\.get\('error'\)/);
 assert.match(native,/eventpassgate:\/\/oauth/);
});
test('gate operator displays the active authentication host for device diagnosis',()=>{
 assert.match(native,/Auth server: \{BASE\.replace/);
 assert.match(native,/EXPO_PUBLIC_RELEASE_CHANNEL/);
});
