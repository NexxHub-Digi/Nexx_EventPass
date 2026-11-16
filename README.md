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
- Gate staff permissions assigned by the organiser; server validation of signed QR and atomic, one-time redemption
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
