# Nexx EventPass — Workflow debug and acceptance report
_Date: 16 November 2026_

## Scope inspected
Next.js authentication and Google OAuth, public event discovery, role-specific dashboard access, Platform Admin approval/configuration, manual bank-transfer checkout and receipt upload, organiser-only approval and ticket issuance, signed/encrypted QR, event-scoped gate assignments and scanner redemption, and independent Expo User/Organiser/Gate/Admin app source.

## Fixes in this cycle
- **Invite any email**: organiser receives a 72-hour private invitation link. The invited person can create a User account or sign in using password or Google, then explicitly accept for that event. Tokens are 32 random bytes, SHA-256 hashed in Neon, single-use and invalidated on acceptance/revocation. The invited email must match the authenticated user.
- **Direct addition**: organiser may immediately add an existing active Google-verified User by email to an owned event. This does not promote the user's role.
- **Revocation**: organiser revokes event-specific assignments and pending links. Re-invitation cannot be issued while the same person remains assigned; first revoke or update the existing assignment.
- **Event ownership**: only active owning organisers may invite/add/revoke gate access. Suspended organiser events cannot be scanned.
- **Web UX**: displays the one-time invitation URL for private copying, pending/accepted/revoked invitation states and an acceptance screen with password registration/sign-in and Google.
- **Native organiser UX**: shares the private URL through the device's share sheet; also supports immediate addition of existing verified operators.
- **Google invitation return**: OAuth redirects back to the invitation page only for a signed, strictly validated same-origin return path; failed role OAuth returns to the matching sign-in page.
- **Account switching**: invited recipient can sign out if the current account has the wrong email.
- **CI**: added source-contract regression tests for invitation creation, acceptance, revocation, scoped access and safe OAuth return.

## Automated checks and limitations
GitHub Actions includes web TypeScript/build, QR encryption tests, workflow guard tests, gate invitation tests and four Expo TypeScript checks. Type checks and source-contract tests do not prove successful runtime camera or ticket flows.

Neon migration verified:
- gate_invitations.token_hash, token_expires_at, accepted_by, accepted_at present
- unique token hash index created
- original invitation and event foreign-key constraints preserved

At audit time: **1 event**, **0 orders**, **0 tickets**, **0 entry scans**, **0 invitations**, **0 assignments** in production Neon. Therefore **no live end-to-end ticket or gate acceptance has been completed**.

## End-to-end tests still required
1. Admin approval/rejection of applicant; check suspended organiser can't publish, approve, or scan.
2. Organiser configures bank account; User submits order and valid receipt; organiser confirms real bank settlement and approves; wallet displays QR.
3. Gate test with two concurrent devices scanning the same QR: exactly one admission, second duplicate, both logged; wrong-event and revoked-ticket tests.
4. Invite an unregistered email; register via link; accept once; retry expired/revoked link; test mismatch and cross-organiser access.
5. Direct-add a registered Google-verified operator; revoke; verify access stops without session logout.
6. Google sign-in for every role, account-linking, callback cancellation, browser/mobile navigation and session persistence.
7. Real iOS/Android camera permission + scanner tests; build signed APK/IPA. Native Google sign-in is not yet implemented.
8. Dependency security audit, auth/scan abuse rate limiting, receipt malware scanning/object storage, production backups and monitoring.

## Deployment
GitHub contains fixes. Vercel Hobby deployment API reported the daily free deployment quota exceeded; production site is **not independently verified to contain this cycle's commits**. Do not use the public URL as proof of this revision.
No automatic invitation email/SMS is configured; organiser manually shares the generated private link. No payment gateway is configured—organiser manually confirms bank settlement.
