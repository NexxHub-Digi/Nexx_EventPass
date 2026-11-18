# Paystack integration — test-only feature branch
This is a partial foundation, NOT a ready-to-deploy payment implementation.
Implemented in source: test-secret guard; server-side split commission calculation; organiser subaccount lookup; payment initialization; read-only provider verification; signed webhook handler with independent provider verification and deduplication; proposed schema; source-contract tests.
Not implemented: applying migration to Neon, Paystack organiser subaccount onboarding and account verification, admin commission UI, native and web checkout, refunds API, reconciliation jobs, user notifications, atomic ticket fulfilment on confirmed payment, deployment and end-to-end tests.
**Do not enable Paystack checkout or merge this branch until ticket fulfilment is integrated and verified.**
Required environment variables: PAYSTACK_SECRET_KEY=sk_test_... and optionally PAYSTACK_WEBHOOK_SECRET=whsec_... for new signature mode. Never put secrets in EXPO_PUBLIC_ variables.
Migration is not applied automatically. Back up the database and validate schema compatibility before applying.
Paystack webhook endpoint after deployment: /api/payments/paystack/webhook. Configure in test dashboard only.
Existing manual payment and QR routes remain unchanged.
