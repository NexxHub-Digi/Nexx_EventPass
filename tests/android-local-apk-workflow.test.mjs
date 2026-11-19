import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../.github/workflows/native-android-preview-apks.yml',import.meta.url),'utf8');
test('local Android workflow provides four installable APK build targets',()=>{
 for(const app of ['user','organiser','gate','platform-admin'])assert.match(source,new RegExp('\\b'+app+'\\b'));
 assert.match(source,/expo prebuild --platform android --clean --no-install/);
 assert.match(source,/assembleRelease --no-daemon/);
 assert.match(source,/apksigner verify --print-certs/);
 assert.match(source,/actions\/upload-artifact@v4/);
 assert.match(source,/EXPO_PUBLIC_RELEASE_CHANNEL: preview/);
 assert.match(source,/nexx-eventpass-git-staging-/);
 assert.doesNotMatch(source,/sk_live_|PAYSTACK_SECRET_KEY|GOOGLE_CLIENT_SECRET/);
});
