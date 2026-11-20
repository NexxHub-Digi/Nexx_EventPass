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
| Payments & refunds | Bank review, verified finance ledger, commission reconciliation, evidence-based staged refund | Bank review (under Organisers), verified payment ledger, future commission policy, per-order bank-statement reconciliation with confirmation and refund worklist (**PR #48**) | `/api/finance`, `/api/refunds`, `/api/organiser/payment-account` | Supervised refund of issued ticket not implemented; Paystack end-to-end and reconciliation acceptance pending |
| Support | **Repaired in PR #47:** per-case priority, response, investigate, resolve, reopen and close; refresh | **Repaired in this PR:** same actionable case editor, status updates and feedback | `/api/support/cases` with atomic audit | Verify live admin + organiser + buyer visibility, concurrent edits, reply/notification delivery; not a full threaded messaging system |
| Ticket themes | Create and view published themes | Create, preview and view | `/api/ticket-themes` | Theme editing/revocation, draft-to-issuance snapshot and PDF export still incomplete |
| Audit logs | Read administrator activity and details | Read latest activity and rejection reason | `/api/platform/audit` | Pagination, advanced filtering/export and cross-referenced action tests outstanding |
| Settings | Edit whitelisted platform configuration | Set key/value on backend | `/api/platform/settings` | Per-setting validation, safe defaults, sensitive configuration controls, reload and accessibility verification |

## Confirmed defects repaired by PR #47
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

## PR #48 — native finance parity, code complete
- Exposes the existing verified finance API in the Expo Platform Administrator payments screen, including gross collections, platform commission, organiser net, received and outstanding commission, and discrepancy counts.
- Allows editing the **future** commission policy only after explicit confirmation; historical payment snapshot rates remain unchanged.
- Allows an authorised platform admin to reconcile a specific verified payment using a real integer received amount and bank statement reference, with explicit confirmation and matched/discrepancy state.
- CI and disposable PostgreSQL E2E passed; no live financial records were changed during implementation.
- Native screenshots and on-device action acceptance remain unverified.

## Release-state caveat (checked 20 November 2026)
- GitHub main includes the fixes from PR #47 (commit `29fd05d`) and PR #48 (commit `16bad52`).
- Vercel production still reported last READY commit `4767bac` when checked. A Git-based deployment was explicitly attempted but the Vercel API returned **402 daily deployment allowance exhausted**; no project-linked CLI/source checkout was present to use its fallback. These changes must not be described as live.
- The latest available Expo Android Platform Admin preview APK was built at commit `f4b5d00`, before either repair; the new native code is not present in that installed archive.
- Recheck production and native delivery after the deployment/build limits are resolved; then complete live acceptance for all ten sections.

## Live click-through acceptance status
No live browser-control session or authenticated screenshots were available in this repair turn. API integration tests verify selected flows, not each individual visible control. Status of all ten-screen screenshot parity and button-by-button production UAT is **OPEN**.
