# EventPass Multi-tenant Platform Admin / Netlify Release

## Tenant model
- The organiser is the operational tenant. Organisers control only owned events, bank details, receipts, gate assignments and their own support requests.
- Users can buy tickets from any approved organiser; their account is shared across the marketplace.
- Gate operators are event-scoped Google-verified identities, not platform-wide admins.
- Platform Admin has a unified read directory and audited controls. The underlying production database is one dedicated Neon PostgreSQL project, accessed from the same Next.js backend on Vercel or Netlify.

## Platform Admin features (implemented in src/app/dashboard/platform-admin)
1. Overview counts across Users, Events, Orders, Tickets, Check-ins.
2. Search/filter all accounts by name/email/role, pages of 40; open details for Google verification status, membership, order count, ticket count, hosted events and gate assignments.
3. Modify display names, suspend/restore or deactivate non-admin accounts. Deactivation is **soft**: the account is disabled, while paid transaction, QR and gate audit history is preserved. Hard deletion is intentionally unsupported in this version.
4. Organiser approvals/rejections and restoration/suspension; edit organiser name and bank settings. All organiser changes remain audited.
5. Review event listings and individual media before marketplace publication.
6. Platform-managed ticket themes, including custom colour palettes.
7. Tenant-scoped support cases: organisers create tickets, Admin can investigate/resolve, and organisers can view the resolution.
8. Approved allowlist of operational setting keys: support email, organiser verification policy, event verification policy, help text. Secret API keys, SMTP and financial credentials are not stored as operational settings.

## Automatic payment confirmation / tickets
- The payment gateway is **manual bank transfer**. The User supplies transfer details and a receipt, but receipt upload alone never approves a payment.
- The owning organiser verifies the actual bank credit and clicks **Approve**.
- One PostgreSQL transaction marks the order approved, issues exactly the ordered number of tickets, and stores their in-app delivery entries with the chosen event theme and approved ticket artwork.
- The User wallet supplies each ticket's secure QR using the configured per-event encrypted EVP2 code, or the legacy signed EVP1 format for legacy events, with the same signing/encryption keys on Vercel and Netlify.
- User web and Expo wallets refresh approximately every 12 seconds while signed in, so newly issued tickets are displayed without a manual reload.
- In-app delivery is implemented; **email/WhatsApp/SMS transmission is NOT implemented**. Those require a provider and template/queue integration. Do not claim messages were externally sent.

## Runtime deployment
- Netlify `netlify.toml` and Node 22 pin are committed. Netlify should be connected to the SAME GitHub main branch and SAME Neon database as Vercel.
- Netlify automatically configures Next.js SSR API routes through its OpenNext adapter.
- Netlify site linking and setting environment variables in the Netlify account are still required; no Netlify connected deploy tool was available in the current chat.
- Configure Google Cloud OAuth callbacks for both exact hostnames; cookies are host-scoped, so logging in to Vercel does not also log in to Netlify.
- Netlify and Vercel are independent stateless runtimes, not separate databases or CRMs. A chosen mobile API URL must remain stable.
- Both frontend/backend releases must be tested against the actual public domain, rather than inferred from GitHub build success.

## Launch blockers
- Connect Netlify site, server-side secrets, and Google redirect URIs; execute real Netlify deployment.
- Test live Google auth and native Expo custom-scheme redirect on real Android/iOS builds.
- Test camera permission, duplicate admission with two physical devices, purchase receipt, approval and immediate ticket rendering.
- Add bank settlement provider and transactional notification integration if automatic emailed tickets are required.
- Implement a dedicated compliant data-erasure workflow for deletion requests (separate from auditing-preserving deactivation).
- Replace Neon bytea video storage with object storage/CDN for production-scale media.
