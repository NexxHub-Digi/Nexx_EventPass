# Role-specific architecture — Nexx EventPass

| Role | Login URL | Web dashboard | Expo project | Bundle ID |
|---|---|---|---|---|
| User | /login/user | /dashboard/user | apps/user | com.nexx.eventpass.user |
| Event Organiser | /login/organiser | /dashboard/organiser | apps/organiser | com.nexx.eventpass.organiser |
| Gate Operator | /login/gate | /dashboard/gate | apps/gate | com.nexx.eventpass.gate |
| Platform Admin | /login/platform-admin | /dashboard/platform-admin | apps/platform-admin | com.nexx.eventpass.admin |

The production web app uses Next.js under src/app. Every Expo application is independent with its own package.json, app.json, app identity and role-scoped screens. The Gate Operator is an **event assignment**, not a global privileged account.

## Role approvals
- Public organiser registration requests an account upgrade, not organiser power. The user can continue buying tickets while pending.
- Platform Admin alone approves/rejects organiser requests and can create an organiser from an existing Google-verified User account. Admin can suspend/restore organisers.
- Organisers invite operators for their own events. Operators verify their invited email via Google; unauthorised Gate sign-in shows an inactive interface.
- Separate UI does not grant authority: the server checks roles, ownership, approval and assignments for all protected operations.
- Owners can scan their events. Operators cannot approve payments, access other events or administer organisers.

## Secure manual payment flow
Organiser publishes bank details → User picks event → transfers funds → uploads receipt and reference → organiser verifies bank settlement → approves → ticket generated → online gate scan → single-entry redemption and audit.

The Next.js API is common to all apps. Session cookies protect web clients; bearer JWTs are used by Expo. User receipts are limited to 2 MB, stored in Neon and accessible only to the ticket purchaser, event organiser and platform administrator.

## CI / release
GitHub Actions runs web typecheck, QR tests and build plus matrix Expo TypeScript checks for each of the four apps. Native builds are not yet signed or installed on devices. Google OIDC for the native Expo apps is separate from the current web OAuth client configuration.

The older apps/mobile, apps/web and supabase/ are legacy prototypes/migrations; the deployed backend is the Neon + Next.js API.


Gate invitations: organisers can invite any email. The new invitation API returns a one-time private 72-hour URL, shareable via WhatsApp/email/etc; the recipient signs in or registers and accepts explicitly. Auto email dispatch is not provided. See [Gate invitations](GATE_INVITATIONS.md).
