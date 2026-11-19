# Paystack test-mode implementation

This integration is **not live payment activation**. It refuses any PAYSTACK_SECRET_KEY not starting `sk_test_`. If the test key or verified Paystack organiser subaccount is absent, Paystack checkout remains disabled. Manual, onsite and complimentary ticketing remain available.

## Activation prerequisites

1. Configure `PAYSTACK_SECRET_KEY` and optionally `PAYSTACK_WEBHOOK_SECRET` as protected **test-only server secrets**. Do not commit or expose them. Set the test webhook destination to `/api/payments/paystack/webhook`.
2. Verify an organiser's genuine bank account through Platform Admin first. Confirm the provider test subaccount maps to precisely the same account number.
3. As an authenticated Platform Admin, call `POST /api/payments/paystack/subaccounts` with `{organiserId,subaccountCode,verificationNote,ownershipConfirmed:true}`. The API verifies the subaccount with Paystack independently and records the admin decision.
4. Apply `db/migrations/20261119_paystack_test_checkout.sql` transactionally before deploying these APIs. Confirm `paystack_payments`, `paystack_events`, `paystack_refunds` and `paystack_organiser_accounts` exist.
5. Test the User web/native checkout, Paystack-return verification, webhook replay, expired reservations, duplicate requests, split commissions and QR admission.

## Fulfilment

Both signed webhooks and authorized buyer status checks use **independent provider verification**. Only test-domain, successful NGN payments matching the order total issue tickets. The transaction locks the event, order and provider record and writes the payment ledger, tickets, delivery, provider status and audit atomically. Replays cannot issue duplicate passes. Paid but expired/invalid orders are flagged for manual reconciliation and refund review.

There is **no automatic provider refund execution in this release**. `paystack_refunds` is reserved for a separately reviewed refund service and related event handlers; do not mark refund settled without provider evidence.

A physical device and actual test transaction are required before enabling the gateway for users. Production has no Paystack test credentials at the time of implementation.

## CI

Run `npm run test:paystack` and the PostgreSQL E2E suite. All four native TypeScript and Expo JS exports remain mandatory. Do not merge older divergent Paystack branches without checking shared fulfilment and migrations.
