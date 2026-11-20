import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const config=readFileSync(new URL('../src/lib/mobile-downloads.ts',import.meta.url),'utf8');
const page=readFileSync(new URL('../src/app/login/[role]/page.tsx',import.meta.url),'utf8');
const route=readFileSync(new URL('../src/app/api/download/android/[role]/route.ts',import.meta.url),'utf8');

test('every active login interface has a unique Expo Android APK',()=>{
  for(const role of ['user','organiser','gate',"'platform-admin'"]){
    assert.ok(config.includes(role+':{'), 'missing app for '+role);
  }
  const urls=config.match(/https:\/\/expo\.dev\/artifacts\/eas\/[\w-]+\.apk/g)||[];
  assert.equal(urls.length,4);
  assert.equal(new Set(urls).size,4);
  assert.equal((config.match(/buildId:/g)||[]).length,5); // one field definition and four builds
});

test('links respect expiry and cannot be redirected to unapproved destinations',()=>{
  assert.match(route,/isDownloadRole\(role\)/);
  assert.match(route,/Date\.now\(\)>=Date\.parse\(build\.expiresAt\)/);
  assert.match(route,/status:410/);
  assert.match(route,/Location:build\.url/);
  assert.match(page,/androidPreviewBuilds\[role\]/);
  assert.match(page,/\/api\/download\/android\//);
});

test('iOS remains a disabled coming-soon placeholder per role',()=>{
  assert.match(page,/iOS/);
  assert.match(page,/Coming soon/);
  assert.match(page,/className="ep-app-download-button ep-app-download-ios" disabled/);
  assert.doesNotMatch(config,/https?:\/\/[^\s'"]+\.ipa/);
});
