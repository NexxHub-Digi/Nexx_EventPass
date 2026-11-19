# Nexx EventPass — evidence-based repair status (19 November 2026)

Baseline: main `f4b5d005a3f9f7319fac8aea320e50e65428d3ff`. This report differentiates source inspection, live database state, cloud build state and actual E2E acceptance. Do not mark unexecuted tests as passed.

## Verified current evidence

- **P0-001 bank account assignment:** The published "Masked party" event has a verified bank account owned by its active organiser (read-only Neon query). Previous pending-account blocker is no longer present for this event. **Status: database eligibility passed; authenticated customer checkout not tested.**
- **P0-002 event ownership:** Both events now belong to active organiser accounts. One is published/verified and the other is draft/pending. The earlier administrator-owned public event is no longer present. **Status: database eligibility passed; public UI acceptance not tested.**
- **P0-003 iOS:** The latest recorded internal-preview iOS builds on baseline `ef2c744...` errored. Expo log for User build `dff45686-89c5-44be-abba-08d79fbddd84` explicitly states no signing credentials for internal distribution in non-interactive mode. It also warns about missing `ios.infoPlist.ITSAppUsesNonExemptEncryption` classification. **Status: blocked on secure interactive Apple certificate/provisioning and export-compliance determination.** Do not set an arbitrary encryption declaration merely to dismiss the warning.
- **P0-004 transactions:** Live Neon contains one approved manual order, one online ticket, ten offline tickets, zero entry scans, and one verified organiser bank account. **Status: production E2E gate admission and refunds not tested.** Do not create synthetic financial transactions in production.
- **Scanner offline audit:** `src/app/api/scan/route.ts` now writes separate `ticket_id` and `offline_ticket_id` references and inserts offline audit entries. **Status: source fix confirmed; two-device concurrency acceptance not tested.**
- **Gate activity SQL:** Current `src/app/api/gates/route.ts` uses the declared aliases `g`, `e`, `o` and `a` in inspected GET queries; previous missing alias `u` is not present in these inspected queries. **Status: current source no longer exhibits reported SQL typo; authenticated runtime test not executed.**
- **Paystack:** Commit `3cb383d244358865ed58a29467bdfecccfcba595` adds test-only split checkout and verified issuance. **Status: committed; real test-mode transaction/webhook/refund acceptance not verified here; live charging must remain gated.**
- **Staging isolation:** Commit `f4b5d005a3f9f7319fac8aea320e50e65428d3ff` points Expo preview to Vercel staging; checked User `eas.json`. **Status: configuration present; test data and end-to-end environment isolation require verification.**
- **Web deployment:** Vercel production `dpl_DKvy89Z3keq5gomjzh8KgoF2nkDk` reports READY for the exact main SHA above. No error/fatal log records surfaced in the checked recent 50-minute window. This does **not** constitute functional acceptance.
- **Android:** Four baseline-revision preview APK builds on `ef2c744...` completed. Four latest `f4b5d005...` Android preview builds were **IN_QUEUE** at inspection, so do not label the older APKs current.

## Next execution sequence

1. Resolve Apple signing *interactively* through EAS for four app bundle identifiers, confirm export-compliance setting using actual dependencies and Apple requirements, rebuild and install.
2. Wait for and inspect Android current-commit artifacts; install and exercise actual Google sign-in, navigation, API calls and scanner on hardware.
3. Run an authenticated staging E2E for a paid manual reservation, approved payment, QR issue and admission, followed by duplicate and concurrent scan denial.
4. Test Paystack with legitimate test subaccount and test API keys, HMAC webhooks, replay protection, settlement split, failed/retried payment, and refunds; verify ledger reconciliation.
5. Re-validate all four portals and responsive/native visual parity with actual screenshots; do not substitute prototypes.
6. Re-run inventory concurrency tests, role and cross-organiser access denial, refunds, offline bulk operations and complete payment-mode matrix.
7. Require CI/reviews/staging approval before a new production release.

## Source evidence

- GitHub: https://github.com/NexxHub-Digi/Nexx_EventPass/commit/f4b5d005a3f9f7319fac8aea320e50e65428d3ff
- Vercel: https://vercel.com/nexxs-projects-903f5c1d/nexx-eventpass/DKvy89Z3keq5gomjzh8KgoF2nkDk
- Expo User iOS build ID: `dff45686-89c5-44be-abba-08d79fbddd84`
- Latest Android queued build IDs: User `5689f8fb-ce89-4b1f-9368-4f6462c797f4`; Organiser `7e962b38-799b-4d55-ac57-b0a4b6cc7caa`; Gate `d9481a51-8e11-4356-b3f6-7ad96c28f6cf`; Platform Admin `ddafeb45-722e-464a-b90c-616fd7cd7bf7`.

No production data was modified by this audit.
