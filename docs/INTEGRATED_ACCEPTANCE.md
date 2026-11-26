# EventPass integrated acceptance candidate

This branch consolidates UI recovery, core functional hardening and notification delivery changes. No production deployment, live payment, mail activation or new schedule is authorized by this document.

## Independently execute
Use Node 22, Docker and curl in an authorized development environment with package registry access. From a clean checkout run `bash scripts/independent-acceptance.sh`. For four Android and iOS bundle exports set `EVENTPASS_TEST_NATIVE=true`. It starts a disposable PostgreSQL database, uses test secrets, disables provider delivery, checks actual builds and HTTP tests, and restores a synthetic database into a separate temporary database. The scripts do not prove a production backup can be restored. Preserve logs and associate them with the exact commit.

## Remaining gates
- Real four-role Google OAuth and browser acceptance; complete UI checks at 320/390/768/1440 widths, keyboard and accessibility.
- Paystack sandbox provider checkout, refunds, settlement and reconciliation with actual sandbox evidence. Live credentials remain prohibited until approved.
- Private email verifier and Resend verified sender, protected test inbox, delivery and webhook confirmation; provider switches remain disabled.
- Signed native builds and physical Android/iOS tests; two independent gate devices.
- Staging backup/restore, production backup and rollback, security review, approval and release synchronization.
- Required GitHub checks remain enforced. If hosted CI or Vercel limits intervene, use independent development validation and queue the release.

No percentage is certified by source changes or build success alone. Record each gate as NOT RUN until evidence exists.
