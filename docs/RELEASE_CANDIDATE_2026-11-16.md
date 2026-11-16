# EventPass Release Candidate — 16 November 2026

## Source and test evidence
- Main source candidate: `563d45b83fdd8d07955046e39cdcceb884a925ae`.
- GitHub EventPass CI run `43894106250`: web build, type checks and all four Expo app type checks passed.
- GitHub EventPass PostgreSQL API E2E run `43894106409`: passed against isolated local PostgreSQL and the actual built Next.js API.
- Production Vercel: **NOT updated**. Deploy API returned `402 payment_required`, code `api-deployments-free-per-day`. The latest READY deployment is older than this release candidate.

## Completed user journeys
1. **Public home:** replaces old password-based combined portal with animated branded event discovery, category filtering and search. Role links lead to dedicated Google sign-in pages.
2. **User app:** searchable event marketplace, event descriptions, posters, short preview video, category filtering, tickets from any verified organiser, manual bank-reference and receipt submission, secure QR wallet with approved artwork and dynamic theme colour.
3. **Organiser:** Google-based application, Platform Admin approval, multi-event creation, video/poster/image upload, 6 built-in themes plus custom artwork and platform-published additional themes; bank-details configuration; manual payment verification; invites/adds gate personnel.
4. **Gate:** invited Google email (does not need prior EventPass registration), event-scoped access, assigned event selection, explicit Start Scanner and OS camera permission, immediate VALID / ALREADY USED / WRONG EVENT / REJECT result, no unrelated administration access.
5. **Platform Admin:** organiser profiles/approval/suspension, event and individual media moderation before public publication, live ticket theme publishing.
6. **Security:** Google-only public new registration, one-time native OAuth exchange with device PKCE verifier, encrypted event QR and atomic redemption, server-side logout JWT revocation.

## Additional bugs fixed in this continuation
- Previously verified events edited to pending verification retained `status='published'`, allowing new ticket orders before reapproval. Changed to `draft`, and order API now checks verified status.
- Organiser content updates would risk silently unpublishing an event with tickets already sold. Such edits now return 409 until a deliberate admin-managed change pathway is implemented.
- Admin verifying an event previously auto-approved every uploaded asset. Now each pending asset requires individual approval/rejection.
- Rejecting a media asset used to leave it permanently pending. Rejected media is now removed.
- Gate assignment listing now hides draft/unverified events.
- Media content cached privately when accessed under authentication.
- The obsolete password-signup combined homepage was replaced with the live event marketplace.

## Launch blockers and limitations
- **Current revision not live on Vercel** due daily Hobby deployment quota. A successful GitHub build does not mean the public website has changed.
- Physical-device Google login and custom URL scheme roundtrip, Android/iOS camera, QR recognition, session persistence and Expo installable builds must still be tested.
- New Google OAuth clients must match configured redirect URLs; previously disclosed secrets must be rotated.
- Video MVP limits: 3.5 MB clips, stored in Neon bytea; longer videos require separate object storage and direct uploads.
- Event/organiser authenticity is manually checked by Platform Admin; no automatic identity verification service is implemented.
- Payment settlement remains manual: organisers must verify funds independently; uploaded receipts alone cannot establish payment.
- No automatic email/SMS invitation dispatch, no commercial hosting certification, limited abuse controls.
- The original older repository prototypes are not deployed application surfaces, and the retired combined Expo entry deliberately excludes login.

## Recommended acceptance sequence
Deploy this passing commit → verify live Google sign-in for all portals → apply event/admin/receipt browser tests → test gate invitations for a previously unregistered Google address → test competing scans on real devices → release signed APK/IPA builds.
