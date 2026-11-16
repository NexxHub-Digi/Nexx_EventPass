# Deploy Nexx EventPass on Netlify alongside Vercel

The Next.js App Router code serves the public site, role workspaces and backend route handlers. Netlify automatically builds SSR/API handlers with its OpenNext adapter. Both hosts should use the *same* Neon Postgres database: users, organisers, events, tickets, QR scans, support cases and settings remain central.

## 1. Connect the repository
- Open https://app.netlify.com/start → Import an existing project → GitHub → `NexxHub-Digi/Nexx_EventPass` → branch `main`.
- Base directory is repository root; use `npm run build`, publish `.next`, Node 22. The committed `netlify.toml` provides these defaults.
- Do NOT add a `/* /index.html 200` redirect; it would override Next.js API routes.

## 2. Configure secrets on the Netlify site
Create environment variables with **Build + Functions** runtime scopes (no secrets in Git).
- `DATABASE_URL`: the **same dedicated EventPass Neon PostgreSQL connection string** as Vercel.
- `AUTH_SECRET`, `QR_SIGNING_SECRET`: the SAME keys as the existing working EventPass host.
- Each role's `GOOGLE_USER_CLIENT_ID` and `GOOGLE_USER_CLIENT_SECRET`; likewise `GOOGLE_ORGANISER_*`, `GOOGLE_GATE_*`, `GOOGLE_PLATFORM_*`.
- `NEXT_PUBLIC_SITE_URL` and `AUTH_PUBLIC_ORIGIN`: the exact final Netlify HTTPS origin, e.g. `https://YOUR-SITE.netlify.app` (NOT Vercel).

## 3. Update Google Cloud redirect URIs
Add `https://YOUR-SITE.netlify.app/api/auth/google/callback` to **Authorized redirect URIs** for all four role-specific Google Web OAuth clients; retain `https://nexx-eventpass.vercel.app/api/auth/google/callback`. Google does not allow wildcard redirect URLs. Rotate Client Secrets that have previously been copied into chat and update both platforms.

## 4. Deploy and validate
Deploy the latest GitHub main branch. In Netlify Deploys, ensure a successful build, check `/api/events` and `/api/ticket-themes`, then test Google sign-in and callback on the Netlify host. Verify Platform Admin account access, organiser approval, creating/approving an event, a receipt-backed order and in-app QR release, an invitation, gate scan, and duplicate prevention.

The four native Expo apps are separate codebases. Once Netlify is proven stable, set each mobile app's `EXPO_PUBLIC_API_URL` to the chosen permanent Netlify API origin and rebuild the signed binaries. Keep the apps on one configured backend URL rather than silently switching an in-flight authenticated session between domains.

## Production considerations
- The two hosts share Neon data, **not cookies**: users sign in separately on each domain.
- Ticket delivery currently means **immediate in-app availability** after organiser-confirmed payment. No email/SMS provider is yet connected, so do not promise an emailed QR.
- Same event-specific signed/encrypted QR is generated from the stable server secret and event private reference; graphics are a separate visual layer.
- Netlify does not create an independent CRM database; the admin service continues via the shared Neon backend.
- Environment variable changes require a new build and deployment for both SSR functions and the client bundle.
- Before launch: test real Google OAuth, physical camera scanning, receipt malware scanning, durable media storage and rate limits.

The source is configured for Netlify, but a deployment in the user's Netlify account requires linking the site and supplying environment values. No working Netlify deployment can be claimed before provider build confirmation.
