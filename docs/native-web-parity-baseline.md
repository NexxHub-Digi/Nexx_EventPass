# Native/Web UI Parity — Phase 1 Baseline (2026-11-18)

## Objective
Rebuild the four Expo native apps to match the previously approved Nexx EventPass mobile-web designs screen-for-screen. Preserve Google OAuth, existing API contracts, role authorization, ticket workflows and native camera scanning.

## Confirmed repository baseline
- Native entry points: apps/user/App.tsx, apps/organiser/App.tsx, apps/gate/App.tsx, apps/platform-admin/App.tsx.
- Native implementations currently use independent React Native views and local StyleSheet styling rather than reusing web layout structure.
- Existing release commit: 95174043103c7a4dcdf0a8e6f8b9743cb63638d6.
- All four Android preview builds finished successfully, but build success is not proof of functional or visual parity.
- Gate Operator uses expo-camera CameraView.
- Native sign-in calls /api/auth/google and /api/auth/mobile and stores the token with expo-secure-store.

## Acceptance criteria
1. Capture the approved web-mobile reference for each role and screen, including authenticated states, empty states, errors and loading.
2. Establish reusable React Native components and tokens matching those references.
3. Implement the role-specific layouts, navigation, forms and interactions.
4. Preserve native OAuth callbacks, session lifecycle, backend calls and role gates.
5. Verify User reservation/payment/QR, Organiser event/ticket studio/payment verification, Gate scan/history and Platform Admin user/organiser/access/audit flows.
6. Record side-by-side web/native snapshots at the same device viewport for every screen.
7. Run TypeScript, Expo Doctor, bundling, APK builds and physical-device acceptance before replacing distributed builds.

## Snapshot policy
Every implementation checkpoint must include actual captured evidence (web reference and native rendering), identifying branch/commit/build. Do not label concept art or a checklist as an application screenshot.

## Current blockers
The approved web-mobile screen captures have not yet been retrieved and compared in this branch. No UI parity or runtime workflow tests have yet passed for the redesign. Do not claim the four apps have been rebuilt.
