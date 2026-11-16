# Nexx EventPass — End-to-end workflow verification
Date: 16 November 2026

## Evidence and scope
- Source repository: NexxHub-Digi/Nexx_EventPass
- Latest application-code commit in this audit: `19e006a943b00cfdb897eba8b08cffde18d7a3ef`.
- GitHub Actions: **EventPass CI** and **EventPass PostgreSQL API E2E** both completed successfully for that commit.
- E2E suite starts an actual Next.js production build and disposable PostgreSQL 17 database, applying schema and migrations then sending HTTP requests to the application's real API endpoints.
- Separate Neon child branch `eventpass-e2e-audit-20261116` was used to verify database-level order → ticket → invite → atomic redemption invariants without modifying production customer records.

## HTTP flows verified
1. Four dedicated role login pages return successfully.
2. User and organiser applicant registration; organiser initially lacks privileged API access.
3. Existing Platform Administrator login; organiser directory and approval; role transitions.
4. Admin organiser profile and bank-account configuration.
5. Organiser event creation and publishing; unauthorised organiser denied.
6. Published event discovery with configured bank-transfer instructions; paid booking without bank instructions denied.
7. User ticket order; organiser-only payment approval; receipt mandatory for paid orders; wrong user cannot access receipt; duplicate approval denied.
8. Encrypted EVP2 QR issued to User wallet.
9. Organiser invitation of unregistered email; wrong-recipient acceptance denied, correct recipient acceptance succeeds, repeated token rejected.
10. Two simultaneous HTTP scans of the same ticket return **one approved, one duplicate**; audit log records both.
11. Direct addition of existing Google-verified account to another event; unverified direct-add denied.
12. QR scanned against the wrong event returns `wrong_event` and is not admitted.
13. Gate access revoked; revoked operator cannot scan that event.
14. Platform Admin suspension blocks organiser event creation and gate access; restore allowed.
15. Logged-out JWT bearer token is invalidated by server-side revocation and cannot fetch the User wallet.

## Fixes made in this audit
- Added PostgreSQL-backed HTTP E2E GitHub Action, not just static contract tests.
- Corrected wrong-event QR feedback; actual cryptographic QR checks and atomic redemption remain mandatory for admission.
- Added `auth_session_revocations` table, unique JWT session IDs, server-side logout revocation; updated four independent Expo apps to request logout before local token deletion.
- Mobile gate camera scan-lock prevents repeated hardware callbacks from submitting overlapping scan requests.
- Restricted QR keyword configuration to active organisers; added organiser-only event-order listing and UUID validation for ticket reviews.
- Updated CI fixture/migrations and made logout fail transparently when revocation storage fails.
- Kept production data and test data separate.

## What is not yet verified
- Real Google provider sign-in and callback completion with human accounts in all four roles; Google account-linking and consent/cancellation need live interactive testing.
- Actual bank settlement cannot be checked automatically. The organiser must independently confirm funds; the platform verifies only recorded receipt/approval flow.
- Browser UI clicking, layout, full payment-receipt preview, and camera permissions have not been tested through Playwright or a physical device; HTTP and TypeScript coverage is not equivalent.
- Expo APK/IPA build/signing and physical Android/iOS scanner/torch/USB-Bluetooth testing.
- Email-password registration does **not** currently verify mailbox ownership. A private invitation token plus matching account email is required, but production should add verified-email activation and notification delivery.
- Credential abuse protection, full security dependency audit, receipt malware scanning, backups and restore drills.
- JWTs issued by older releases without session IDs cannot be revoked through the new table until they naturally expire (7-day JWT lifetime).
- Production deployment must be confirmed against the latest commit. At report creation, Vercel's latest READY deployment was `e30cf9f4`, while current tested source was `19e006a9`.

## Business rules preserved
- Platform Admin alone grants organiser privileges.
- Organisers approve/reject only their own payment orders and invite/add/revoke operators only for their own events.
- Operators scan only assigned events for active organisers and cannot access organiser or admin functions.
- Users can discover events across active organisers; paid tickets are released only after organiser manual review.
- QR credentials are encrypted/signed and server-verified; offline checking fails closed.

**Result:** The automated end-to-end backend suite passes. Production acceptance is **not complete** until current code is deployed and live browser/Google OAuth/physical scanner verification passes.
