# EventPass native and web release

The User, Organiser, Gate Operator and Platform Admin apps have separate Expo build roots under `apps/`. Each root has an internal preview profile and a production profile for Android and iOS. Configure the linked EAS project and signing credentials in the corresponding Expo account. Set `EXPO_PUBLIC_API_URL` to the production HTTPS origin in each EAS production environment. The URL is public and must serve the matching EventPass API.

## Production order

1. Confirm the target Neon project and hosting plan. Back up the database and preserve the current authentication and QR signing keys. Check that the earlier migrations in `tests/e2e/setup.mjs` are present.
2. Apply the release migrations in order. The listed files are additive and are exercised by the PostgreSQL acceptance suite.
   1. `20261119_stable_ticket_credentials.sql`
   2. `20261119_ticket_category_inventory.sql`
   3. `20261119_payment_reconciliation.sql`
   4. `20261119_verified_event_bank_accounts.sql`
   5. `20261119_payment_review_notifications.sql`
3. Deploy the matching web revision and verify that public discovery, the four sign-in portals and signed-in API calls work on the production host. Admin should review imported bank accounts before opening new paid checkout for affected events.
4. From each app root, request signed internal builds with `eas build --platform all --profile preview`. On physical iOS and Android devices, verify Google sign-in, the associated role boundaries and the deployed API origin.
5. On Gate devices, check camera permission granted, denied and restored, scan a valid ticket, scan it twice, switch assigned events, background the app, and test manual entry and loss of network. Keep a signed internal build per platform as evidence.
6. Build signed store binaries with `eas build --platform all --profile production` from each app root after acceptance. Publish through the appropriate Expo/App Store/Play Console accounts.

Expo bundle exports validate JavaScript assembly. Camera and sign-in acceptance on a physical device requires an installed signed build. Paystack remains disabled pending provider integration.
