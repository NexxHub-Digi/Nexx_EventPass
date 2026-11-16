# EventPass launch audit — 16 November 2026

## Audit evidence
- Repository reviewed: password & Google authentication, events, manual payment orders and approvals, encrypted ticket issuance, gate assignment, atomic online scanning, website/Expo UI.
- Neon: 2 account records, 1 Google-linked identity, **0 events, 0 ticket orders, 0 issued tickets, 0 gate scans** at review time. No end-to-end real event acceptance evidence.
- GitHub CI initially failed Expo TypeScript (TS2872: always-truthy array used for organiser navigation); fixed at commit `4b2b724`. Next CI run passed root TypeScript, QR tests, Next.js production build and Expo TypeScript.
- Vercel production deployment READY on earlier commits. Later commits require independent deploy verification.
- Vercel logs previously showed 1 moderate + 1 high dependency advisory. Audit/upgrade pending.
- The public web endpoints could not be independently fetched through the external reader; live-browser behavior not attested.

## Fixes made
1. Scanner rejects malformed event UUIDs and invalid QR input before Postgres casts.
2. Admission now uses a bounded default window (up to 2 hours before event start and no later than 24 hours after start; respects an earlier configured event end time). Organisers still need a configurable policy.
3. Expo organiser navigation condition corrected so guests are not shown organiser tools.
4. CI added and exercised; website and mobile TS checks pass.
5. Consistent EventPass identity exported as brand SVG and Next favicon, reusable color tokens and brand guide; Open Graph preview included.

## Flow evaluation
| Flow | Code coverage | Acceptance |
|---|---|---|
| Guest registration/login | Password and Google routes | Login/logout/refresh test needed |
| Privileged roles | Database role and gate assignment checks | Cross-role denial tests needed |
| Event creation | Keyword encrypted in Neon | Real event test needed |
| Manual payment | Guest reference and organiser review | Bank confirmation is manual; receipt upload missing |
| Ticket issuance | Transaction and capacity check | Sellout concurrency test needed |
| QR credentials | AES-256-GCM, organiser keyword, master key | Unit crypto tests passed; device scan pending |
| Gate scanning | Event-bound, atomic first redemption, audit | Duplicate simultaneous-scan and wrong-event testing pending |
| Expo device access | CAMERA permission, torch and recovery | Real Android/iOS tests and native release builds pending |
| Google OAuth | Role-specific clients & identity mapping | Live provider login, state/nonce, linking and cancellation pending |

## Stop-ship items
1. Rotate four Google OAuth secrets previously shared in chat and replace them directly in Vercel.
2. Resolve dependency advisories and verify patched versions.
3. Run a real organiser → guest → order → approval → QR → assigned gate → first scan → duplicate scan test.
4. Add abuse/rate limiting and monitoring to public authentication and scan endpoints.
5. Validate native camera permissions, USB/Bluetooth scanners, network loss and mobile sessions.
6. Confirm commercial hosting, backups and incident operations before taking payments.

Encryption is not equivalent to anti-copy protection: online, atomic redemption is what denies duplicated tickets. Offline entry remains unsupported.
