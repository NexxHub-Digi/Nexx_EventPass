# Nexx EventPass — Android security and release acceptance (20 November 2026)

Scope: User, Organiser, Gate Operator and Platform Administrator Expo apps.

## Source-level changes

- Unique role-specific Android package names, deep-link schemes and EAS project IDs retained.
- Valid native icon assets inspected: each 1024 × 1024 PNG; adaptive foreground PNGs have alpha transparency.
- Expo SDK 54 with compileSdkVersion and targetSdkVersion pinned at Android API 36.
- Expo build-properties disables cleartext HTTP traffic; app backups disabled to protect local sign-in state.
- High-risk unrelated permissions explicitly excluded. The Gate Operator retains CAMERA with runtime user consent; other roles disallow camera.
- Preview profile produces internal-test APKs using isolated staging HTTPS origin.
- Production profile produces AAB app bundles for Google Play, using production HTTPS origin and Expo-managed release credentials.
- `tests/android-release-security.test.mjs` enforces these rules in GitHub CI.

## Requirements not established by configuration alone

1. Build *each* role's production AAB via EAS and verify the actual package ID, version code, SHA-256 signing certificate, final merged manifest, Android 16 API 36 target and no unsafe exported components.
2. Verify 16 KB native library page compatibility; inspect actual APK/AAB libraries and test on a 16 KB page-size device/emulator.
3. Register developer identity, four package names and signing certificates with the appropriate Android Developer Verification mechanism; use Google Play App Signing.
4. Review Google Play policies for account deletion, privacy policy, Data Safety, declared permissions, user data, ticket payments and refunds.
5. Publish through Google Play internal testing first; install and update each app on real Android devices. Validate role-specific Google OAuth callbacks, secure sessions, Gate camera access, secure ticket scanning and icons.
6. Only publish actual approved Play download/store links when the appropriate review/distribution evidence exists. Current Expo preview APK links are temporary internal test artifacts.

## Security caveat

Google Play Protect checks binaries, certificates, permissions, reputation and installation context. No code change can *guarantee* the absence of sideloading prompts or Play Protect warnings. Never instruct users to disable Play Protect. The local GitHub Android workflow creates **debug-key signed** testing APKs; it must not be used for public release. For smooth customer installations use verified Play Store distribution and production-signed artifacts.

## Verification commands

- `node --test tests/android-release-security.test.mjs`
- For each `apps/<role>`: `npm install`, `npx expo config --type introspect --json`, `npx expo prebuild --platform android --clean --no-install`, `npx tsc --noEmit`
- On actual APK: `apksigner verify --verbose --print-certs app.apk`, `aapt dump badging app.apk`, `zipalign -c -P 16 4 app.apk`
- For production app bundle: build `eas build -p android --profile production`, then verify Play Console App Bundle Explorer and internal-track installation.

iOS remains unreleased; its login-page controls must continue showing Coming soon.
