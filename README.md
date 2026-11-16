# Nexx EventPass

An event ticketing and access-control application with a responsive **Next.js web app**, **Expo React Native (Android/iOS)** client, and **Neon PostgreSQL** backend.

## Current functionality

- Email/password signup and login (bcrypt password hashes, httpOnly signed web session, bearer sessions for Expo)
- Organiser invite-code signup (other users are guests by default)
- Create and publish an event, set ticket price and event capacity
- Guest booking request with bank transfer reference for **manual payment review** (no payment processor)
- Organiser verifies payment independently and approves/rejects the submitted reference
- On approval, the backend atomically checks capacity and issues unique QR credentials signed with HMAC-SHA256
- Guest mobile and web ticket wallet, with QR display
- Explicit role-aware sign-in portals: guest, organiser, assigned gate operator and pre-provisioned platform administrator
- Event-specific organiser QR keyword (8–80 characters), encrypted server-side at rest; tickets use authenticated AES-256-GCM encryption with per-event HKDF-derived keys
- Gate staff permissions assigned by the organiser; server validation of signed/encrypted QR and atomic, one-time redemption
- Android/iOS camera permission prompt, denial/settings recovery, rear-camera QR scanner with torch, external scanner input; browser camera scanning with ZXing and USB/Bluetooth keyboard scanners
- Duplicate, invalid and revoked check-in outcomes with database audit trail
- Legacy UI/UX prototype at `/prototype`

## Architecture

- `src/app`: Next.js App Router frontend and server-side HTTP API
- `src/lib`: Postgres connector, signed-session and QR security
- `db/schema.sql`: Neon/PostgreSQL schema for the event and ticket system
- `apps/mobile`: Expo Android/iOS app using the same authenticated APIs
- `public/prototype.html`: original Figma-inspired design prototype

## Quick start

1. Provision a Neon Postgres database (the dedicated `nexx-eventpass` project is created).
2. Execute `db/schema.sql` if the schema has not yet been applied.
3. Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `AUTH_SECRET`, `QR_SIGNING_SECRET` and `ORGANISER_INVITE_CODE` (keep all secrets server-side).
4. Run `npm install`, `npm run build`, `npm run dev`.
5. Register your organiser account using the private `ORGANISER_INVITE_CODE`. Guests can register without one.
6. For Expo: `cd apps/mobile && npm install && cp .env.example .env && npx expo start`. Set `EXPO_PUBLIC_API_URL` to the deployed Next.js web URL.

## Manual payment workflow

1. Event organiser publishes an event and independently shares trusted bank payment instructions.
2. Guest submits quantity and a bank transfer reference through the web or mobile app.
3. Order stays `pending`. **A reference is not proof of payment.** Organiser confirms money arrived in their bank statement, then approves/rejects the order.
4. Approval issues tickets; an approval cannot exceed event capacity.
5. Gate staff scan the issued QR; online first redemption succeeds, subsequent attempts are denied.

### Important operational safeguards

- Do not approve an order without independently confirming its payment.
- Do not share `DATABASE_URL`, `AUTH_SECRET`, `QR_SIGNING_SECRET` or the organiser invitation code with mobile clients or in Git.
- In the initial version the event organiser also has gate scan permissions, and can assign registered staff accounts.
- Offline admission is **not** supported; a network connection is required to prevent duplicate entries across gates.
- QR codes do not contain attendee personal information.
- Registration and login should receive rate limiting and anti-bot protection before a high-volume public launch.
- Web browser scanning uses `BarcodeDetector` when available; Expo camera scanning is the more consistent option.

## Current release limitations

This is an early full-stack MVP, not a certified production ticketing system. Payment receipt file uploads, refund workflows, invitations by email, multi-ticket tier structures, offline entry reconciliation, notification delivery and app-store publication are not implemented. Perform live end-to-end, concurrency, security and real-device tests before using it to admit paying guests.

## Links

- [GitHub](https://github.com/NexxHub-Digi/Nexx_EventPass)
- [Figma](https://www.figma.com/design/hIcS4ec1F0tX2BIkttaec0)

## Role-based sign-in and encrypted QR (v0.3)

On both web and mobile, the sign-in interface lets an account select **Guest**, **Organiser**, **Gate operator**, or **Platform administrator**. This selection does **not** create or elevate roles. The server enforces the selected portal against the user’s stored role or gate assignment. Public registration creates guest accounts only, unless a valid private organiser invitation is supplied in the organiser flow. Gate operators register as guests, then get assigned to specific events by an organiser. Platform admin accounts must be provisioned privately in the database; the UI has no public admin registration. Once authenticated, admins receive a read-only system summary (accounts, events, orders, issued tickets and redeemed admissions). Privileged administrative mutations remain disabled pending separate security review.

For a new event, an organiser must supply a **private 8–80-character QR keyword**. The server encrypts this keyword at rest under a server-side master secret. Approved tickets receive fresh **EVP2** QR credentials encrypted using AES-256-GCM with a distinct event-derived key generated from the server secret plus the event keyword. QR payloads omit attendee personal details; the keyword is never sent to a guest’s phone or the scanner. The scanner submits the encrypted token to a server that decrypts it and performs the same *atomic single-entry* database check. The keyword is not an access-granting password: organisers cannot admit guests without backend authorisation and a valid ticket.

Existing EVP1 events can enable encryption through the organiser UI **only before any tickets have been issued**. Existing issued EVP1 codes remain supported for events not migrated. Rotating the keyword after ticket issuance is intentionally disabled so previously issued QR codes cannot be silently invalidated.

### Device permissions

- iOS/Android ask for camera access **only when the authorised scanner is started**. Denied permission offers instructions to enable it in Settings.
- Expo uses `expo-camera` for back camera and torch; audio recording permission is disabled.
- Web requires HTTPS and camera permission and uses `@zxing/browser`; physical USB/Bluetooth scanner keyboards can paste tokens and submit with Enter.
- No contacts, location, microphone or photo-library permission is needed to scan tickets.

### Tests

Run `npm run test:qr` to check encrypted ticket roundtrip, fresh nonces, keyword isolation and tampering resistance. Run `npm run typecheck` and `npm run build` in a dependency-enabled environment. Gate admission concurrency and device-camera tests must additionally run against a dedicated staging environment before commercial use.


## Google sign-in (web)
Four role-specific Google OAuth clients support Guest, Organiser, Gate Operator and Platform Administrator sign-in. Verified Google identity alone never elevates roles. First-time Google login can register a **guest** account. Existing accounts must sign in via password first and choose **Link Google account**; privileged roles are not created by Google login. Callback: `/api/auth/google/callback`. See [Google Cloud setup](docs/GOOGLE_OAUTH_SETUP.md). Native Expo Google sign-in is not included in this web integration.

After adding the OAuth client secrets in Vercel, redeploy the app and test successful login, cancellation, role denial, linking, logout and session persistence. Rotate any secrets previously disclosed in a conversation.
