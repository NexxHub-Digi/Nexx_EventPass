# Nexx EventPass

Nexx EventPass is a branded event-discovery, manual ticket-payment approval and secure QR-entry platform with a **Next.js web/API**, **Neon PostgreSQL**, and **four independent Expo Android/iOS projects**.

**Current implementation is a testing MVP, not yet certified for real paid events or published to app stores.**

## Four separate interfaces

| Portal | Sign in | Mobile source | Permissions |
|---|---|---|---|
| **User** | /login/user | apps/user | Discover all published events, use organiser bank instructions, submit transfers + receipt, view approved QR wallet |
| **Event Organiser** | /login/organiser | apps/organiser | Apply for approval, configure bank details, create events, review receipts, verify bank transfers, invite and revoke gate operators |
| **Gate Operator** | /login/gate | apps/gate | Assigned event scans, camera + QR scanner, admission and per-gate activity only |
| **Platform Administrator** | /login/platform-admin | apps/platform-admin | Approve/reject/activate/suspend organisers, create organisers from existing Google-verified Users, platform metrics |

Web workspaces: /dashboard/user, /dashboard/organiser, /dashboard/gate, /dashboard/platform-admin. Login portals **do not grant roles**.

## Administrator and organiser rules

- The default platform administrator is an existing, verified, owner-authorised account provisioned directly in Neon, not a publicly registered account. **No default password is stored or distributed**.
- Only Platform Admin can approve a User's organiser application or create an organiser from an existing Google-verified User account.
- Anyone may apply to be an organiser using Google or email/password. Their organiser dashboard stays **pending** until approval; normal User access remains available during review.
- The Platform Admin can suspend/restore organiser access. Inactive/suspended organisers cannot create events, review payment or assign gates.
- A gate operator is an event-specific *assignment* to an existing User account, **not** a global privileged role. Only the owning organiser may issue or revoke invitations; the invited email must be verified through Google before the assignment is activated.
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
- **Auth**: bcrypt email passwords; JWT web httpOnly cookie and mobile bearer tokens; Google OIDC with authorization code + PKCE, state/nonce validation and Google JWKS audience checks.
- **Roles**: database role and account approval status, organiser ownership, event-scoped gate invitations and scan permissions.
- **QR**: AES-256-GCM encrypted event-specific credentials with organiser keyword and server secret, or legacy signed HMAC tickets; atomic Postgres redemption, fail-closed offline.
- **Web camera**: @zxing/browser and keyboard-style USB/Bluetooth QR readers.
- **Expo**: four separately branded source projects and bundle identifiers. Only the Gate app requests CAMERA. User app uses a document picker for receipts.
- **Google Search Console**: verification HTML preserved in public/; branded favicon and Open Graph metadata.

Separate client IDs for User, Organiser, Gate and Platform Admin are configured in Vercel. Native Google OAuth for the four Expo binaries, app store releases, and production-grade device testing are **not yet complete**. Previously disclosed OAuth client secrets must be rotated in Google Cloud and the replacements entered directly into Vercel.

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
