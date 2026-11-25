# Ticket notification and scan release gate

This additive migration queues one notice per approved order in the same transaction as ticket delivery, including manual and gateway issuance. In-app wallet remains authoritative; no QR, backup code or payment details leave it. No historical backfill. Unverified, suspended, revoked, cancelled and expired orders are not eligible.

Apply db/migrations/20261125_ticket_notifications_gate_rate.sql to an isolated staging database first, verify CI and rehearse rollback before applying to production. Do not enable the worker until verified sender domain, transactional email policy and provider configuration are approved. Resend is a proposed provider; no customer email is sent by default. Its accepted response is not proof of delivery; bounce/webhook reconciliation remains a follow-up.

Set server-only EVENTPASS_TICKET_EMAIL_ENABLED=true, RESEND_API_KEY, EVENTPASS_EMAIL_FROM and EVENTPASS_NOTIFICATION_SECRET (32+ random characters) only after acceptance. A scheduler may call POST /api/internal/ticket-notifications with Authorization: Bearer <secret> every 1–5 minutes; GET is available for a protected scheduler. Configure the scheduler explicitly; none is enabled in this PR. Batch size four, two-minute processing lease, five attempts and 12-hour retry cutoff keep retries within provider idempotency retention. Test using synthetic inboxes only. Do not change sender/recipient during an active retry.

Database-atomic fixed-minute scan limits: 180 QR and 30 manual per event/operator; existing invalid manual-code checks remain. Public OAuth/login and distributed IP abuse protection are separate release gates.

Acceptance: passing typecheck/build and PostgreSQL E2E; database restore drill; isolated approved and rejected orders; provider mock tests; controlled real-email receipt and bounce tests; simultaneous two-device QR admission; four role-specific genuine Google logins; approved real-event rehearsal. No production promotion without these checks.
