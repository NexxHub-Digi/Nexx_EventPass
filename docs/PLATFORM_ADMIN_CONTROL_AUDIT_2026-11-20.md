# Nexx EventPass — Platform Administrator control audit
**Date:** 20 November 2026  
**Scope:** Actual `src/components/RoleWorkspace.tsx`, `apps/platform-admin/App.tsx`, authenticated API routes, CI contract tests and HTTP PostgreSQL E2E.  
**Acceptance rule:** An interactive button must have a real effect backed by a permission-checked API or meaningful client navigation, with explicit success/error feedback. **Static code inspection and CI are not equivalent to live authenticated UAT, and Android/iOS bundle checks are not installable app tests.**

| Section | Web state | Native state | Backend | Remaining end-to-end acceptance |
| --- | --- | --- | --- | --- |
| Overview | KPI aggregates, real work queue, refresh, shortcuts, support drill-down | KPI grid and shortcuts, open support and bank review alerts | `/api/platform/overview`, `/api/platform/events`, `/api/support/cases`, `/api/refunds` | Authenticate and click every dashboard link; confirm new data after mutation and reload; visually compare all breakpoints |
| Organisers | Verified User onboarding; application approve/reject with reason; profile, permissions, suspend/restore | Approval/rejection, profile, capabilities; confirmed suspension/restoration | `/api/platform/organisers`, `/api/organiser/payment-account` | Real Google-verified test account lifecycle, bank beneficiary verification evidence, audit review |
| Users & access | Search, role filter, page, profiles, edit, soft suspend/deactivate, audit | Search, role filter, pagination, profile, Google link status, confirmed access changes | `/api/platform/users` | Save/reload, cross-role denial, old sessions invalidated and native re-authenticated tests |
| Event moderation | Publish/reject pending events, approve/reject media, audited owner correction | Same primary controls | `/api/platform/events` | Authenticated real event/media actions, image preview and refund-safe cancellation remains a gap |
| Events & analytics | Search, event operational detail with issued/offline/check-in/refund figures | Event search, counts and moderation links | `/api/platform/event-directory` | Real dataset cross-check, download/export requests if required, mobile layout comparison |
| Payments & refunds | Bank review, verified finance ledger, commission reconciliation, evidence-based staged refund | Bank review (under Organisers), refund worklist; **native parity with full finance ledger is incomplete** | `/api/finance`, `/api/refunds`, `/api/organiser/payment-account` | Supervised refund of issued ticket not implemented; Paystack end-to-end and reconciliation acceptance pending |
| Support | **Repaired in this PR:** per-case priority, response, investigate, resolve, reopen and close; refresh | **Repaired in this PR:** same actionable case editor, status updates and feedback | `/api/support/cases` with atomic audit | Verify live admin + organiser + buyer visibility, concurrent edits, reply/notification delivery; not a full threaded messaging system |
| Ticket themes | Create and view published themes | Create, preview and view | `/api/ticket-themes` | Theme editing/revocation, draft-to-issuance snapshot and PDF export still incomplete |
| Audit logs | Read administrator activity and details | Read latest activity and rejection reason | `/api/platform/audit` | Pagination, advanced filtering/export and cross-referenced action tests outstanding |
| Settings | Edit whitelisted platform configuration | Set key/value on backend | `/api/platform/settings` | Per-setting validation, safe defaults, sensitive configuration controls, reload and accessibility verification |

## Confirmed defects repaired by this PR
1. Support resolution was previously shared among cases in both web and Expo. It is now scoped to each case ID.
2. A case previously could be marked resolved with an empty response; backend now requires at least ten characters and stores an actor/audit record atomically.
3. Web Overview previously had mostly summary values and no operational work queue; it now offers real counts and navigation to the corresponding workflows.
4. Native Overview lacked support/bank-review workload alerts. Those now come from authenticated loaded records.
5. The web organiser-create control was moved from an unrelated Overview card to the Organisers section, preserving its original backend action.
6. Native organiser suspend and restore now require confirmation and produce success/error feedback.

## Required release acceptance
- Create dedicated non-production accounts for all four roles; perform genuine authenticated user, organiser and gate transactions; test tenant isolation and permission denial.
- Exercise every visible web and native administrator control: click, submit validation, persist, refresh, audit entry, denied role, and error recovery; document evidence for each.
- Capture **actual** web screenshots at 320, 375, 430, 768, 1024 and 1440 widths and actual Android/iOS screens, then compare with the approved Nexx Future design.
- Treat installed EAS builds and device-level QR admissions as separate gates from JavaScript bundling.
- Confirm deployed production Git SHA and live smoke tests; do not assume a passing preview deploy proves an action.
- Keep financial actions audited and restricted to authorised test accounts; do not fabricate approvals, refunds or transfers.

## Remaining critical blockers
- Supervised cancellation/revocation/refund for already-issued tickets.
- End-to-end Paystack test payment, split-payment webhook and settlement reconciliation verification.
- Ticket Studio draft versions are not yet fully bound to category-specific ticket issuance and immutable rendered snapshots.
- Full visual parity across the ten admin sections and installable physical-device acceptance.
