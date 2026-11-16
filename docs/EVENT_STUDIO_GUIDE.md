# Nexx EventPass — Discover, Gate and Organiser Studio

Last updated: 16 November 2026.

## User experience
- Google-only new registration and authentication; successful User web login opens `/dashboard/user` and Expo User app uses browser-based Google OAuth with a PKCE-bound, one-use server token exchange.
- Marketplace opens with all **verified, published** events of active organisers.
- Search event names, venues and descriptions. Filter by category and sort by date or ticket price (web). The Expo User app supports search and category selection.
- Animated poster cards, event descriptions, event image galleries and short video clips. The web app plays video previews inline; on Expo User, tapping a preview opens the clip in the device browser.
- User can request tickets for any organiser's verified event. Paid requests require bank transfer and uploaded receipt. Organiser independently verifies actual funds before ticket issuance. A free ticket may still require organiser approval.
- Wallet receives server-generated encrypted QR and approved ticket artwork/themes. The visual design **never** replaces the cryptographic QR credential.

## Organiser experience
- Register/apply **only using Google**. A new applicant retains User access but cannot manage organiser events until Platform Admin approval.
- Create unlimited events with name, venue, schedule, category, description, ticket price, capacity, and private encrypted QR keyword. Client validates dates and server checks future date, cost, capacity and keyword.
- New events are created as **draft / pending verification**. Admin reviews event authenticity, submitted information and media before making the listing public.
- Upload event posters/photos (JPG/PNG/WebP up to 2 MB), short MP4/WebM teasers (up to **3.5 MB**) and custom ticket-art images (2 MB). Media uploaded after publication stays hidden from the public until reviewed.
- Choose from central ticket theme catalogue or import a custom image. Theme catalogue is expandable in the Platform Admin dashboard: new themes become available to web and Expo Organisers without rebuilding either app.
- Organisers manage bank details, verify manual payment receipts, approve/reject ticket orders, and invite or revoke gate staff only for owned published events.
- Email invitations are generated as expiring, single-use links for private sharing, not automatically emailed.

## Gate Operator experience
- No independent User registration. The organiser sends an invitation to **any Google email**, whether the recipient previously used EventPass or not.
- Recipient signs in with that verified Google email through the Gate app, or follows the private link and confirms. A basic internal identity is created for access logging; this does **not** promote the operator to User purchasing or Organiser privileges.
- The Gate app prioritises only assigned-event selection and **Start Scanner**. Camera permission is requested at runtime. Opening the camera is tied to an explicit operator tap.
- After each scan, show a large immediate decision: **VALID — ADMIT**, **ALREADY USED**, **WRONG EVENT**, **REVOKED** or **ENTRY REJECTED**. Tap **Scan next ticket** to resume. Camera decode callbacks are guarded against accidental overlapping submissions.
- Validation requires a signed/encrypted event-scoped QR, active organiser, published event, valid ticket and server-side atomic one-time redemption. No offline admissions.
- Gate staff cannot access other events, organiser management or Platform Admin.

## Platform Admin
- Approves/rejects/suspends/restores organisers and manages organiser profiles.
- Reviews event listings and uploaded promotional content before publication; can approve/reject media without exposing unreviewed content.
- Adds new catalogue ticket themes with a name, category label and validated hex colours. Built-in themes: Aurora Glow, Midnight Gold, Sunset Social, Neon Pulse, Minimal Ivory, Custom Artwork.

## Authentication and backend
- Neon PostgreSQL migrations in `db/migrations/20261116_event_studio_mobile_oauth.sql`.
- Public `POST /api/auth/register` is disabled. An internal legacy password **sign-in** route remains solely for existing accounts during migration; it is not shown in current interfaces.
- Google login with separate role OAuth clients, verified Google email and OAuth state/nonce. For Expo, server issues a 2-minute single-use mobile code that can only be exchanged with the originating device's SHA-256 verifier; the Google client secret never enters the mobile app.
- Gate invitation email must match Google's verified email before assignment. Invitation tokens expire and are invalidated on acceptance.

## Limits before public launch
- Native Google OAuth, deep links and camera permissions require **EAS development/standalone builds on physical Android and iOS**. TypeScript/HTTP tests alone do not validate actual phone behaviour. Expo Go may not support the custom scheme as configured.
- Video previews are capped at 3.5 MB because serverless request payload limits apply. Long-form video hosting should move to object storage + direct resumable uploads; Neon bytea is an MVP storage solution, not recommended for video at scale.
- No automatic identity/document checks, manual bank-settlement integration, or automatic invitation emails. Platform Admin must verify organiser and event authenticity manually.
- Test all flows on the deployed commit, rotate previously exposed Google client secrets, add rate limits and abuse monitoring before commercial production.
