# Building standalone Android test APKs without Expo EAS

GitHub Actions workflow: `.github/workflows/native-android-preview-apks.yml`.

The Expo Free-plan quota can prevent new EAS builds. This independent workflow uses Expo's local Android prebuild and Gradle to compile a **standalone bundled release-variant APK signed only with the Android debug/test key**. It is not a signed store release and must not be uploaded to Google Play.

## How to obtain builds

1. Open GitHub Actions → **EventPass standalone Android preview APKs** → **Run workflow**.
2. Choose `all` or `user`, `organiser`, `gate`, or `platform-admin`.
3. After each build succeeds, download the role-specific artifact ZIP from the workflow run. Extract `app-release.apk`, then install it on an Android test device. Keep the run SHA with the test evidence.
4. Confirm the staging site has deployed the matching API before validating live role workflows.

The workflow validates that its API URL points to the isolated **staging** host, never the production hostname. Builds include no production database credentials, no Paystack secret, and no production signing certificates. Generated `android/` and `ios/` directories are not checked in.

## Acceptance

Test Google authentication for the correct portal, persistent sessions, each role's mobile UI, database/API integrations, offline ticket distribution, ticket-studio previews, and Gate camera and duplicate-scan security on a physical device. A successful APK build alone does not verify any of these runtime behaviors.

If native Gradle compilation fails, inspect the **Standalone APK / role** job logs and fix the Expo CNG or Android build root cause in the same app; do not label web JavaScript exports as installable binaries.

iOS internal distribution remains dependent on Apple-managed provisioning and cannot be replaced by this Android-only test workflow. Expo EAS remains the preferred pipeline for signed release binaries.

GitHub-hosted Ubuntu runners already provide an Android SDK and `ANDROID_HOME`. The workflow checks that installation instead of invoking `android-actions/setup-android@v3`, which can attempt to download the deprecated SDK package named `tools` and fail before Gradle starts.
