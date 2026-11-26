# 99% acceptance gate ledger

Target: each area must independently meet its verified acceptance target. Do not equate source commits, mocks, or bundle exports with completed real-world acceptance.

| Area | Evidence already established on 39b55e2 | Required next evidence |
|---|---|---|
| UI/UX | CI + PostgreSQL E2E | Browser screenshots and functional navigation at 320, 390, 768, 1440; keyboard and assistive technology |
| Authentication | Isolated role and access checks | Genuine Google OAuth on four portals + native, session revocation |
| Events and ticketing | HTTP workflows | Real browser event creation, moderation, purchase and ticket design |
| QR/gate | Concurrent HTTP admission tests | Two independent physical scanners with valid, duplicate, revoked and wrong-event cases |
| Offline tickets | HTTP distribution and permissions | Physical printed codes, export and replacement rehearsal |
| Admin | API and native bundle | Privileged browser and native workflows, audit review |
| Payments | Test-only adapter and guards | Real sandbox checkout, refund proof, settlement reconciliation; no live key |
| Mobile | Four Android and iOS JS bundles | Latest signed APK and IPA, physical-device checks; iOS simulator build can aid QA but is not device acceptance |
| Email | Mock provider and HTTP tests | Private verifier, verified sender domain, controlled inbox delivery and webhook outcomes |
| Security/release | Synthetic isolated DB restore | Staging restore, production backup and rollback, security approval, commit-specific release smoke |

Expo evidence checked 2026-11-26: older Android preview APKs exist for all four roles. Older iOS User, Organiser and Platform Admin builds failed because suitable internal distribution credentials were unavailable in non-interactive EAS. Configure Apple signing/provisioning interactively for each role; never put credentials in source. The optional ios-simulator profile inherits preview isolation and avoids device signing; it is not a signed IPA. Build exact source commit only from an approved staging checkout.

Production gate remains locked pending approval. No new scheduling. Vercel and hosted CI quotas are release/validation constraints, not permission to bypass security. Use the independent runner when authorized.
