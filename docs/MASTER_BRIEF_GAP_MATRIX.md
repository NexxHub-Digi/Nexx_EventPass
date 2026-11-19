# EventPass master brief implementation audit

The baseline is GitHub `main` at `ff5ca56` (PR #10). The existing root Next.js app and the four directories under `apps/{user,organiser,gate,platform-admin}` are the current products. `apps/web`, `apps/mobile` and the old Supabase migrations are reference projects. Development and HTTP verification use isolated PostgreSQL. Neon remains the deployment database.

| Feature | Existing implementation | Current gap | Portal | Backend and database | Priority | Repair and verification |
| --- | --- | --- | --- | --- | --- | --- |
| Sign-in and account lifecycle | Portal-specific Google configuration, OAuth state/PKCE, revocable sessions, organiser approval and verified gate invitations | Live Google client and device acceptance pending | All four | `/api/auth`, `oauth_identities`, session revocation and role tables | High | Verify sign-in, link, denied scopes, deep links and sign-out on configured web and native deployments |
| Event moderation | Owner editing, media approval, platform verification and private external events | Full post-publication cancellation and event lifecycle remain incomplete | Organiser, Admin | `/api/events`, `/api/platform/events`, `events`, `event_media` | High | Event edit and rejection now guard live offline tickets under the event lock. Test moderation, active reservations and timed admission |
| Shared inventory | Reservations, online issue and external batch issue serialize on the event row | Named allocations and General share the event limit. Allocation editing and category-level reporting remain open | Organiser, User, Admin | `ticket_orders`, `tickets`, `offline_tickets` | High | Organisers can allocate named categories from available General capacity. Online web and Expo User clients and the web batch manager can select an allocation. Test a race for the last category seat |
| External batches | Encrypted account-free tickets, activation, distribution, browser export and audit | Design inheritance only. Full design-version selection remains incomplete | Organiser, Ticket Staff | `/api/offline/*`, `offline_ticket_batches`, `offline_tickets`, `offline_ticket_audit` | High | Batch creation now checks verified event state under lock and deduplicates concurrent retries. Inventory can be searched by ticket ID or serial number. PNG and JPEG downloads and a printable PDF flow are available. Add design snapshots and verify QR readability in exported formats |
| Ticket lifecycle | Atomic one-time QR scan, reissue and replacement link for external tickets | Online lifecycle management and more specific gate outcomes remain incomplete | Organiser, Ticket Staff, Gate, User | `/api/scan`, `/api/offline/reissue`, `entry_scans` | High | Standalone external revocation has its own permission and audit reason. Replacements receive a new stored credential, including reissuance after standalone revocation when inventory remains. Test duplicate scans and simultaneous reissues |
| Ticket Staff | Verified Google email grants with selected/all events, fixed expiry and optional future events | Native staff access, event-completion expiry and richer assignment management remain open | Organiser, Ticket Staff | `/ticket-staff`, `/api/offline/assignments`, `offline_ticket_staff` | High | Web staff workspace lists only assigned events and renders allowed operations. Verify grant, read-only access, revocation, and denial of unrelated routes |
| Reports and analytics | Event directory, gate history, approval totals and offline activity | Cross-portal dashboards, reconciliation, export, and distribution reporting remain incomplete | Admin, Organiser, Gate | `/api/platform/event-directory`, scan and order data | Medium | Event directory includes external issuance and admissions. Assert sold-offline entries never alter confirmed revenue |
| Design and native parity | Shared web assets, existing brand guide, four independent Expo apps | Full responsive review, unified tokens, visual parity and screenshot evidence pending | All four | Web workspaces and `apps/*/App.tsx` | Medium | Compare desktop, mobile web, Android and iOS per screen, including loading, empty, denied and offline states |
| Support and notifications | Persisted support cases and in-app ticket delivery | Notification preferences, lifecycle coverage and external delivery remain open | User, Organiser, Admin | `/api/support/cases`, `ticket_deliveries` | Medium | Verify observable delivery and user preferences without external sends in local acceptance |
| Payment expansion | Manual receipts, timed holds, onsite collection, fixed commission snapshots and per-order remittance reconciliation | Live Paystack, automated payouts, grouped remittances and approved-order refunds | User, Organiser, Admin | Order, review, finance and refund routes and migrations | High | Verify onsite approval rules, manual flow regression, finance access and statement matching. Paystack is a disabled placeholder |
| Release evidence | GitHub web/mobile and PostgreSQL CI workflows, Vercel and EAS configuration | Deployment inspection, preview binaries, real-device tests and final release sign-off pending | All four | `.github/workflows`, Neon, Vercel, Expo EAS | High | Verify the exact deployed revision and collect screenshots, build links and device evidence through the corresponding services |

## Screen inventory

| Portal | Current web entry points and work areas | Native entry point |
| --- | --- | --- |
| Platform Administrator | `/login/platform-admin`, `/dashboard/platform-admin` with overview, event directory, users, organisers, moderation, refunds and support | `apps/platform-admin/App.tsx` |
| Event Organiser | `/login/organiser`, `/dashboard/organiser` with overview, events, Ticket Studio, Offline Ticketing, payments, gate management, profile and support | `apps/organiser/App.tsx` |
| User | `/login/user`, `/marketplace`, `/dashboard/user` with event discovery and details, orders, receipts and wallet | `apps/user/App.tsx` |
| Gate Operator | `/login/gate`, `/invite/gate`, `/dashboard/gate` with assigned event, camera/manual input, decision and history | `apps/gate/App.tsx` |
| Ticket Staff | `/ticket-staff` with assigned events, permitted batch and ticket actions and audit | Web workspace |

## Verification on the updated checkout

- Node 22 type checking and the production Next.js build passed.
- The 14 existing QR, workflow guard and invitation unit tests passed.
- The PostgreSQL 17 HTTP acceptance suite passed against the production build. Added coverage checks gate assignments, simultaneous batch retries, standalone revocation and scan denial, export authorization, read-only staff access and removal, and the distinction between declared external sales and confirmed revenue.
- Chromium opened all four sign-in pages and authenticated web workspaces using local fixtures. It also checked a read-only staff assignment, the User Portal link to Ticket Staff, and PNG and JPEG download signatures. Captures include the organiser offline manager on desktop and mobile and read-only Ticket Staff on mobile.
- The print export authorization route passed. PDF output and physical QR readability still need acceptance on printers and devices.
- The managed egress proxy denied a read-only request to the public Vercel homepage. No Vercel, EAS or Neon deployment credentials were present in the cloud task. Production deployment, live Google sign-in and native builds remain unverified.

## Stable QR rollout

Apply `db/migrations/20261119_stable_ticket_credentials.sql` before deploying the matching code. New online and external tickets store their credential in the issuance transaction. Existing issued tickets acquire a stored credential on their first authorised read. Older exported QR codes remain compatible with scanner validation and retain the ticket's redemption and revocation state. Since earlier exports were not recorded, the first stored QR for an older ticket can differ from the one printed before the migration.

Event-wide availability is shared by online reservations, external batch issuance and external replacements after standalone revocation. Named allocations share the event lock across both ticket paths. Existing orders and batches use the General pool by default.


## Category inventory rollout

Apply `db/migrations/20261119_ticket_category_inventory.sql` after the offline ticketing migration and before deploying the matching app. Named allocations reserve seats from General capacity that is still available. Existing orders, reservations and external batches keep their General allocation. Each allocation uses the existing event price. Payment methods and pricing are outside this change.

Category selection is implemented in the web marketplace, web Offline Ticket Manager and Expo User app. Older clients that omit category IDs use General capacity. Category allocation management currently supports creation. Expo binaries, native device acceptance, hosted migration application and a verified hosted deployment remain open.

Local validation passed against the production web build and PostgreSQL 17. Two concurrent requests could claim only one last seat in a named category, and the other General seat remained available. The suite also rejected cross-event categories and over-allocation. Chromium exercised category creation in the organiser workspace and confirmed that two downloads of the same ticket were byte-identical. The Expo User app passed type checking and exported Android and iOS application bundles through Metro. Signed EAS builds and device verification remain pending.

## Onsite collections and reconciliation

Apply `db/migrations/20261119_payment_reconciliation.sql` before deploying the matching app. Onsite collection defaults to disabled. The owning organiser enables it for a public event in payment approvals. Buyers choose Pay onsite and show their order ID at the venue before the reservation expires. A permitted organiser enters the exact collected amount and an event-unique reference. The server records the verified collection and issues the tickets in a single transaction.

Platform Admin sets the commission rate for future approvals. The amount is rounded to the nearest whole naira per verified order, matching EventPass's existing whole-naira accounting. Earlier approvals are imported at zero commission. Each new approval saves the rate used at verification. Changes to the rate affect later approvals.

The finance ledger tracks organiser-collected revenue and the corresponding commission remittance. Platform Admin matches the amount received against a bank statement reference for each order. Partial or excess amounts appear as discrepancies, and corrections are audited. This workflow records an external settlement. It does not move funds, process payouts, or settle refunds on issued tickets. Paystack remains a display-only placeholder with checkout disabled. Provider automation, grouped remittances and payment of approved-order refunds remain open.

## Verified organiser bank accounts

Apply `db/migrations/20261119_verified_event_bank_accounts.sql` before deploying the matching web and mobile clients. The migration imports legacy organiser bank details as pending and links eligible older paid events to their imported account. Platform Admin must verify each account before those events can accept new paid orders. Previously issued tickets and existing receipt workflows remain usable.

Organisers submit one or more accounts for independent Platform Admin review, then select a verified account for each paid event. All ticket categories for an event use that event's account. Free events are exempt. Checkout fetches the current event-specific bank, beneficiary and account number. The manual-order API requires the ID displayed in checkout, preventing stale checkout details from being silently accepted after an account change. An order retains its original account ID, and reviewed bank account records are immutable. Older app builds need an update to place new paid bank-transfer orders.

## Payment review inbox and buyer support

Apply `db/migrations/20261119_payment_review_notifications.sql` before deploying the associated clients. The migration backfills one in-app notification per existing, unexpired payment awaiting receipt review. New receipt uploads create notifications in the same database statement that stores the file. Repeated uploads retain one inbox entry. Organisers see unread receipts and all actionable submissions in Pending Payments. A receipt is evidence submitted by the buyer. The organiser confirms actual funds before approving.

After rejection, a buyer can open a support case from their order. Platform Admin can inspect the original receipt and respond using the support desk. The buyer sees status and resolution in their orders. There is one case per payment order. In-app alerts update while the organiser is using the app. This flow has no email, SMS or device-push delivery.
