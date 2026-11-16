# Nexx EventPass

Nexx EventPass is a branded event-discovery, manual ticket-payment approval and secure QR-entry platform with a **Next.js web/API**, **Neon PostgreSQL**, and **four independent Expo Android/iOS projects**.

**Current implementation is a testing MVP, not yet certified for real paid events or published to app stores.**

## Four separate interfaces

| Portal | Sign in | Mobile source | Permissions |
|---|---|---|---|
| **User** | /login/user | apps/user | Search and filter verified events, view uploaded posters/videos, request tickets and show themed encrypted QR wallet |
| **Event Organiser** | /login/organiser | apps/organiser | Apply for approval, design multiple events, upload media, choose/import ticket graphics, verify payments and invite gate staff |
| **Gate Operator** | /login/gate | apps/gate | Google invitation-only access, select assigned event → camera scan → immediate admit/reject decision |
| **Platform Administrator** | /login/platform-admin | apps/platform-admin | Approve organisers and listings/media, publish new ticket themes, configure access and review platform metrics |

Web workspaces: /dashboard/user, /dashboard/organiser, /dashboard/gate, /dashboard/platform-admin. Login portals **do not grant roles**.

## Event marketplace, verification and ticket themes

- Approved organisers can create multiple events, but **new event posts remain draft/pending until Platform Admin verifies them**.
- Organisers may upload posters, galleries, custom ticket art (up to 2 MB each), and small video previews (up to 3.5 MB). Pending media remains hidden publicly until approved.
- User marketplace supports search, categories, animations, poster/video discovery and manual ticket requests.
- Gate mobile prioritises assigned event selection, runtime camera permission, QR validity and rapid repeat scanning.
- Ticket designs use a **live, Platform Admin-managed catalogue** with six built-in themes plus additional themes added without deploying new app code. Custom artwork imports are available.
- See [Event Studio Guide](docs/EVENT_STUDIO_GUIDE.md) for detailed workflows and production limitations.

## Administrator and organiser rules

- The default platform administrator is an existing, verified, owner-authorised account provisioned directly in Neon, not a publicly registered account. **No default password is stored or distributed**.
- Only Platform Admin can approve a User's organiser application or create an organiser from an existing Google-verified User account.
- Anyone may apply to be an organiser using Google only. Their organiser dashboard stays **pending** until approval; normal User access remains available during review.
- The Platform Admin can suspend/restore organiser access. Inactive/suspended organisers cannot create events, review payment or assign gates.
- A gate operator is an event-specific assignment to a Google-verified identity, **not** a separate public registration or privileged global role. Only the owning organiser may issue or revoke invitations; the invited email must be verified through Google before the assignment is activated.
- Organisers can scan their own event tickets and view gate activity. Gate operators may scan only their assigned events and cannot create events, approve payments, view other organisers' data or access platform administration.

## Manual bank-transfer and receipt workflow

1. Organiser publishes a verified bank name, account name and account number from their private organiser dashboard.
2. User discovers any published event from any active organiser, independently confirms the bank details and transfers funds to the organiser.
3. User submits the ticket order, payment reference and **PNG/JPG/WebP/PDF receipt (max 2 MB)** through the secured backend.
4. Order remains *pending*. Organiser views the receipt privately and independently verifies bank settlement; the receipt/reference alone is **not** confirmation of payment.
5. Organiser approves or rejects the pending order. Paid orders **cannot be approved until a receipt has been submitted**.
6. On approval, the backend atomically checks event capacity and creates ticket records. The User wallet displays server-issued signed or encrypted, event-bound QR codes.
7. Event-assigned operator (or owning organiser) verifies QR with an online server request. Atomic redemption approves the first valid scan and denies a duplicate. Audit logs record the operator, gate and outcome.

No online payment processor is configured. Never approve a receipt without independently checking actual funds.

## Security and stack

- **Next.js** App Router API routes: src/app/api
- **Neon PostgreSQL**: app_users, oauth_identities, events, organiser_payment_accounts, ticket_orders, tickets, entry_scans, gate_assignments, gate_invitations
- **Auth**: Google-only new-account sign-up on all role interfaces; Google OIDC with PKCE/state/nonce and JWKS audience verification; web httpOnly JWT sessions and Expo bearer sessions via short-lived, device-PKCE-bound one-use codes. Legacy password sign-in remains only for migration and is not shown publicly.
- **Roles**: database role and account approval status, organiser ownership, event-scoped gate invitations and scan permissions.
- **QR**: AES-256-GCM encrypted event-specific credentials with organiser keyword and server secret, or legacy signed HMAC tickets; atomic Postgres redemption, fail-closed offline.
- **Web camera**: @zxing/browser and keyboard-style USB/Bluetooth QR readers.
- **Expo**: four separately branded source projects and bundle identifiers. Only the Gate app requests CAMERA. User app uses a document picker for receipts.
- **Google Search Console**: verification HTML preserved in public/; branded favicon and Open Graph metadata.

Separate client IDs for User, Organiser, Gate and Platform Admin are configured in Vercel. Native browser Google OAuth and one-use PKCE token exchange are implemented in source, but signed APK/IPA distribution, physical-device OAuth/camera verification and production acceptance are **not yet complete**. Previously disclosed OAuth client secrets must be rotated in Google Cloud and the replacements entered directly into Vercel.

## Dual-host deployment and central Platform Admin

- **Vercel and Netlify** run the same full-stack Next.js website/API; both connect to one dedicated Neon Postgres project. Do **not** make Netlify a static export or create a second production database.
- Platform Administrator can browse all accounts, search/filter, open profiles, update names, suspend/restore and deactivate while preserving transactional audit records, approve organisers and events, configure operational help settings and manage organiser support requests.
- **Payment confirmation and ticket release:** an organiser verifies funds and approves the order. In the same database transaction, secure tickets and per-ticket in-app delivery records are created. User wallets refresh approximately every 12 seconds and display the event artwork/theme and encrypted/signed QR. Automatic external email/SMS delivery is **not yet configured**.
- Netlify hosting requires linking the repository and supplying environment secrets and the exact Netlify Google OAuth redirect URIs. See [Netlify Setup](docs/NETLIFY_DEPLOYMENT.md) and [Platform Admin / CRM](docs/PLATFORM_ADMIN_MULTITENANT.md).

## Start locally

Configure Neon DATABASE_URL, AUTH_SECRET (32+ chars), QR_SIGNING_SECRET (32+ chars), Next.js NEXT_PUBLIC_SITE_URL, and Google client credentials in an untracked .env.local (see .env.example). Never place private API keys in EXPO_PUBLIC_ variables.

Web: npm install && npm run dev

CI: npm run typecheck && npm run test:qr && npm run build

Individual mobile app (example): cd apps/gate && npm install && EXPO_PUBLIC_API_URL=https://nexx-eventpass.vercel.app npx expo start

Repeat for apps/user, apps/organiser and apps/platform-admin. Native installable binaries require EAS Build and signing credentials.

## Operational caveats

- **Live web release:** Vercel Hobby has a daily deployment quota; the most recent GitHub code can be ahead of the production deployment. Inspect deployments before claiming the site is updated.
- Vercel Hobby use is noncommercial; commercial hosting must be arranged before public paid admissions.
- Complete real-device camera/USB scanner testing, cross-role negative tests, Google login + session/link testing, payment approval and receipt upload validation, and concurrent duplicate QR scans before launch.
- Add public login and gate-scan rate limiting/anti-abuse controls, audit monitoring, dependency vulnerability remediation, automated backups and recovery tests.
- Historical apps/mobile and apps/web are pre-split reference prototypes, **not** the current role-specific applications. Old Supabase migrations are historical references; production DB is Neon.

## Docs

- [Role applications](docs/ROLE_APPS.md)
- [Google OAuth setup](docs/GOOGLE_OAUTH_SETUP.md)
- [Brand guide](docs/BRAND_GUIDE.md)
- [Previous technical audit](docs/PROJECT_AUDIT_2026-11-16.md)
- [Original Figma design](https://www.figma.com/design/hIcS4ec1F0tX2BIkttaec0)
