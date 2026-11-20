import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const roles=['user','organiser','gate','platform-admin'];
const root=new URL('../',import.meta.url);
const denied=['READ_SMS','RECEIVE_SMS','SEND_SMS','READ_CONTACTS','WRITE_CONTACTS',
 'READ_CALL_LOG','WRITE_CALL_LOG','READ_PHONE_STATE','ACCESS_FINE_LOCATION',
 'ACCESS_COARSE_LOCATION','ACCESS_BACKGROUND_LOCATION','QUERY_ALL_PACKAGES',
 'REQUEST_INSTALL_PACKAGES','MANAGE_EXTERNAL_STORAGE','SYSTEM_ALERT_WINDOW',
 'RECORD_AUDIO'].map(name=>'android.permission.'+name);
const idSet=new Set(),schemeSet=new Set(),expoSet=new Set();
const pngSignature=Buffer.from('89504e470d0a1a0a','hex');

function pngInfo(file){
 const bytes=readFileSync(file);
 assert.ok(bytes.length>1000,'icon missing or nearly empty');
 assert.ok(bytes.subarray(0,8).equals(pngSignature),'invalid PNG signature');
 assert.equal(bytes.toString('ascii',12,16),'IHDR');
 assert.equal(bytes.readUInt32BE(16),1024,'icon must be 1024px wide');
 assert.equal(bytes.readUInt32BE(20),1024,'icon must be 1024px tall');
 assert.equal(bytes[24],8,'8-bit PNG required');
 assert.equal(bytes[28],0,'interlaced PNG not supported');
 assert.equal(bytes.toString('ascii',bytes.length-8,bytes.length-4),'IEND','truncated PNG');
 return bytes[25];
}
for(const role of roles){
 test(role+' Android build identity, icons and security',()=>{
  const base='apps/'+role+'/';
  const read=(name)=>JSON.parse(readFileSync(new URL(base+name,root),'utf8'));
  const app=read('app.json').expo;
  const pkg=read('package.json');
  const eas=read('eas.json');
  assert.equal(app.android.allowBackup,false);
  assert.ok(app.android.package.startsWith('com.nexx.eventpass.'));
  assert.ok(!idSet.has(app.android.package),'duplicate package');
  idSet.add(app.android.package);
  assert.ok(!schemeSet.has(app.scheme),'duplicate URL scheme');
  schemeSet.add(app.scheme);
  assert.ok(!expoSet.has(app.extra.eas.projectId),'duplicate Expo project');
  expoSet.add(app.extra.eas.projectId);
  for(const permission of denied){
   assert.ok(app.android.blockedPermissions.includes(permission),role+' missing blocked permission '+permission);
  }
  if(role==='gate'){
   assert.ok(app.android.permissions.includes('CAMERA'),'Gate must explicitly declare camera');
   assert.ok(!app.android.blockedPermissions.includes('android.permission.CAMERA'));
  }else{
   assert.ok(app.android.blockedPermissions.includes('android.permission.CAMERA'));
  }
  const policy=app.plugins.find(x=>Array.isArray(x)&&x[0]==='expo-build-properties')?.[1]?.android;
  assert.ok(policy,'Expo Android security build policy missing');
  assert.equal(policy.usesCleartextTraffic,false);
  assert.ok(policy.targetSdkVersion>=36);
  assert.ok(policy.compileSdkVersion>=36);
  assert.equal(pkg.dependencies['expo-build-properties'],'~1.0.10');
  assert.equal(eas.build.preview.distribution,'internal');
  assert.equal(eas.build.preview.android.buildType,'apk');
  assert.equal(eas.build.production.distribution,'store');
  assert.equal(eas.build.production.android.buildType,'app-bundle');
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_RELEASE_CHANNEL,'preview');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_RELEASE_CHANNEL,'production');
  assert.ok(eas.build.preview.env.EXPO_PUBLIC_API_URL.startsWith('https://'));
  assert.match(eas.build.preview.env.EXPO_PUBLIC_API_URL,/staging/);
  assert.equal(eas.build.production.env.EXPO_PUBLIC_API_URL,'https://nexx-eventpass.vercel.app');
  assert.equal(pngInfo(new URL(base+app.icon.replace(/^\.\//,''),root)),2,'opaque RGB launcher icon');
  assert.equal(pngInfo(new URL(base+app.android.adaptiveIcon.foregroundImage.replace(/^\.\//,''),root)),6,'transparent RGBA adaptive icon');
  assert.match(app.android.adaptiveIcon.backgroundColor,/^#[0-9a-fA-F]{6}$/);
 });
}
test('all four apps keep distinct Expo identities and redirect schemes',()=>{
 assert.equal(idSet.size,4);
 assert.equal(schemeSet.size,4);
 assert.equal(expoSet.size,4);
});
test('local debug-signed builds stay in internal preview channel',()=>{
 const flow=readFileSync(new URL('.github/workflows/native-android-preview-apks.yml',root),'utf8');
 assert.match(flow,/EAS_BUILD_PROFILE: preview/);
 assert.match(flow,/EXPO_PUBLIC_RELEASE_CHANNEL: preview/);
 assert.match(flow,/Android Debug/);
 assert.doesNotMatch(flow,/googleplay|upload-to-play|submit.*production/i);
});
