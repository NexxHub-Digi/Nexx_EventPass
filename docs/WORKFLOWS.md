# EventPass workflow specification

## Issue tickets

1. Organiser creates an event with start/end time, capacity, venue, tiers, and gate policy.
2. Guest orders a ticket, or staff creates an authorized complimentary invitation.
3. Payment provider webhook is authenticated and verified server-side. Failed/unsettled payments do not issue tickets.
4. Ticket issuance creates a random non-guessable token, a unique ticket record, and an auditable issuance event.
5. Guest receives the pass by approved delivery method (wallet, email, download).

## Gate admission

1. Staff authenticates and selects a gate assigned to the event.
2. Scanner reads the QR and sends the token to the server over TLS.
3. Server validates cryptographic signature and event, time, payment, ticket status and gate permissions.
4. Ticket status transitions from ISSUED to REDEEMED inside a single atomic transaction (compare-and-set / row lock).
5. API returns an explicit result with short-lived display details. Audit each attempt with event/gate/staff/time.
6. Success: show green APPROVED; existing redemption: amber ALREADY USED with timestamp; invalid/revoked/wrong event: red DENIED.

## Offline caveat

Disconnected gates cannot provide a global duplicate-entry guarantee. MVP is online-only, fail-closed when server verification is unavailable; design offline queue and reconciliation separately if needed.

## Core roles

- Platform Admin: platform and tenants, never routinely bypass ticket redemption.
- Organiser: event policy, inventory, reports, staff invites and ticket issuance.
- Gate Supervisor: assigned events, gate staffing and escalation.
- Gate Operator: assigned events and permitted gates; validate only.
- Guest: access only their own purchases and passes.

## Implementation acceptance tests

- Simultaneous scans for same ticket permit exactly one redemption.
- Altered QR signature fails.
- Refunded, revoked, unpaid and wrong-event passes fail.
- Staff cannot scan tickets for an unassigned event.
- Valid entry logs include actor, gate, event, timestamp, and ticket ID.
- Secrets are server-side only; no sensitive customer information embedded in the token.
