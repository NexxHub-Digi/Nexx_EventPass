# Android and iOS Acceptance Matrix — Nexx EventPass

Last updated: 18 November 2026.

## Test approach and evidence standards

Four independent Expo apps: User, Organiser, Gate Operator and Platform Admin.
GitHub CI must pass TypeScript plus Android and iOS Metro JavaScript exports for each app. These are **build checks, not signed binaries or device acceptance**.
The test team must install signed EAS builds on a real Android phone and an iPhone, each with real Google accounts (never production secret values in source). Keep test account IDs in private QA records.

## Required manual/device acceptance before release

| Role | Android | iOS | Required result |
|---|---|---|---|
| User: Google sign-in + cancel + repeat | NOT RUN | NOT RUN | correct app deep link, stable session, no password UI |
| User: search/filter verified events & media | NOT RUN | NOT RUN | only approved listings, posters/videos load |
| User: bank instructions, receipt, 45-minute hold | NOT RUN | NOT RUN | clear countdown, no oversold capacity |
| User: approved themed encrypted QR wallet | NOT RUN | NOT RUN | correct 5 masquerade layouts; artwork preserved, QR scannable |
| Organiser: request approval and inactive interface | NOT RUN | NOT RUN | not privileged before admin approval |
| Organiser: create/edit event and ticket/poster themes | NOT RUN | NOT RUN | 5 ticket + 2 poster selections persist |
| Organiser: payment review, refund/settlement workflow | NOT RUN | NOT RUN | paid QR only issued after bank verification |
| Gate: Google sign-in before invitation acceptance | NOT RUN | NOT RUN | access denied; no automatic assignment |
| Gate: accept one-use invitation then assigned events | NOT RUN | NOT RUN | only assigned events visible |
| Gate: camera request, deny/retry, background/foreground | NOT RUN | NOT RUN | permission and lifecycle handled safely |
| Gate: valid, duplicate, revoked, wrong-event QR | NOT RUN | NOT RUN | one admission only, clear reject states |
| Gate: simultaneous scan on **two real devices** | NOT RUN | NOT RUN | exactly one approved and one duplicate |
| Admin: Google sign-in with privileged account | NOT RUN | NOT RUN | public Google cannot self-elevate |
| Admin: organiser profiles/permissions/support/audit | NOT RUN | NOT RUN | tenant-scoped changes, audit trace |
| All apps: logout, token expiry, session revocation | NOT RUN | NOT RUN | secure logout, repeat login works |

## Automated coverage

- CI: Next.js build, TypeScript, four Expo TypeScript checks, Android and iOS Metro bundle export (if configured in workflow).
- PostgreSQL API E2E: authorised role flows, manual payment receipts, concurrency-safe ticket reservation, ticket designs, QR issuance, atomic competing scans (two simultaneous HTTP requests), refund management and event access.
- Automated HTTP concurrency is **not** a substitute for two physical gate devices scanning the same code over cellular/Wi-Fi.
- Google OAuth redirect initiation can be tested with dummy CI clients. Actual Google redirect/callback **requires real Google Cloud configuration and interactive end-to-end testing**.

## Build/deployment prerequisites

- Four separate EAS projects (unique slug, Android package and iOS bundle identifier).
- Configure each app's `EXPO_PUBLIC_API_URL` to the exact HTTPS production origin. Never ship OAuth client secrets inside the APK or IPA.
- The corresponding Google Web OAuth client requires the server HTTPS callback `/api/auth/google/callback` registered exactly for both Vercel and any Netlify hostname.
- The backend redirects to role-specific custom schemes `eventpassuser://oauth`, `eventpassorganiser://oauth`, `eventpassgate://oauth`, `eventpassplatformadmin://oauth`.
- Camera permission is required only by Gate; test Android/iOS privacy prompts.
- User and Organiser devices must not receive gate/admin capabilities from UI route choices alone.

## Sign-off

A real release requires device screenshots, device model + OS versions, EAS build IDs, Google OAuth success/cancel paths, a full event purchase/approval transaction, and two-device duplicate scan evidence. Leave an item marked NOT RUN unless evidence exists. Do not call the project device-verified based only on GitHub CI.
