# EventPass production repair

This repair starts from GitHub `main` at `ef2c744`, the revision identified in the 19 November 2026 system brief.

| Area | Evidence | Result or follow-up |
| --- | --- | --- |
| Paid checkout | Production discovery returned two paid listings. Their payment-instructions requests returned 409 and 404. | Keep bank verification enforced. Ask a Platform Administrator to verify the legitimate beneficiary and attach an eligible account in the organiser workspace. Do not approve or reassign a live account based on the public response. |
| Event ownership | The brief identifies an administrator-owned listing. A PostgreSQL fixture reproduced the discrepancy. | Discovery, public media and moderation now require an eligible owner. The event remains visible to Platform Admin for investigation. Confirm the intended organiser and reconcile related tickets, assignments and payment records before correcting live ownership. |
| Native receipt recovery | An initial upload could fail after an order was saved. | The User app opens Orders after reserving, preserves the receipt error beside the order, and can upload or replace evidence on that same order. |
| Checkout retries | Repeated submissions could reserve more than once. | Current web and native checkout keep one idempotency key per attempt. The API serializes retries and returns the original reservation. |
| Gate audit | Offline admission wrote a null ticket reference to scan history. | New history records link to the appropriate online or offline ticket. Historical records remain available. Cryptographically invalid submissions have no ticket reference. |
| Preview isolation | EAS preview inherited the app's production fallback when no API origin was supplied. | The four preview profiles require an explicit HTTPS staging origin and reject the production hostname. Set the public staging URL in the EAS preview environment. |
| Native signing | The brief reports iOS internal signing failures. | Expo project links are present on the audited branch. Signed previews and physical acceptance still require an accessible Expo project, Apple team, registered devices and working profiles. |
| Paystack | Disabled placeholder in the audited revision. | Provider credentials, test-mode checkout and financial acceptance are still open. |

## Rollout

Apply `20261119_link_offline_entry_scans.sql` and `20261119_reservation_idempotency.sql` after the migrations in [the release runbook](NATIVE_RELEASE.md) and before deploying the matching API. Both schema changes are additive. They retain previously issued QR credentials and orders. Follow the existing verified-bank review process for affected paid events.

For Expo previews, set `EXPO_PUBLIC_API_URL` in the EAS `preview` environment to the staging website origin. If production has a custom hostname, set `EXPO_PUBLIC_PRODUCTION_API_URL` in the preview environment so config validation can reject it too. Link each preview environment to staging data. Verify Google OAuth against staging and install signed preview builds before accepting camera or device behavior.
