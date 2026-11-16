# Nexx EventPass

**Web, Android and iOS ticket issuing and QR gate-verification platform.**

## Source structure

- `apps/web` — Next.js 16 web app, organiser dashboard, guest discovery, staff scanner, protected API endpoints.
- `apps/mobile` — Expo / React Native Android and iOS app with native QR camera scanner and email-code auth.
- `supabase/migrations/20261116100000_eventpass_core.sql` — Postgres schema, ownership RLS, atomic ticket issuing and one-time redemption functions.
- `index.html` — previous standalone UI/UX prototype retained for reference.
- `docs/WORKFLOWS.md` — product workflows.

## Deployment

The Next.js web root directory in Vercel is `apps/web`, attached to GitHub `NexxHub-Digi/Nexx_EventPass` (branch `main`). The web UI displays **Preview mode** when Supabase isn't configured; this must not be used to admit guests.

### Required Supabase setup

1. Create a **dedicated** Supabase project for EventPass. Do not reuse Nexx AI or Nexx Hotel databases. The existing Nexx-Digi org currently has reached its two-project free limit.
2. Apply the SQL migration to that project, review its RLS policies and enable required Auth email templates.
3. Set the following secrets in Vercel for production, preview and development as appropriate:

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Web | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Web | Publishable (not secret) key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Supabase secret/service role key; never put in browser or Expo |
| `EVENTPASS_SIGNING_SECRET` | **Server only** | At least 32 random characters, stored as Vercel encrypted env |

Generate a signing secret using a cryptographically secure random generator. Rotating it invalidates previously issued ticket QR tokens. Do not commit credentials to Git.

4. Configure Supabase Auth redirect allow-list for your Vercel site. For mobile email-code login, adapt the Supabase email template to include `{{ .Token }}`.
5. Deploy a production build; test online scan and double-scan concurrency with authorised accounts before live admission.

### Local web

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

### Expo Android and iOS

```bash
cd apps/mobile
npm install
cp .env.example .env
npx expo start
```

Enter the Expo public API URL and Supabase **publishable** credentials, never server secrets. App Store builds, signing and store account configuration are **not complete**. Test with Expo Go or development builds first.

## Implemented components

- Responsive Next.js event browser and organiser dashboard
- Supabase email-link web sign-in, email-code mobile sign-in (requires template)
- Published event creation (authenticated owner)
- Event-owner manual ticket issue, signed HMAC QR credential
- Event owner or assigned gate staff check-in
- Server signature and event validation; atomic SQL redemption, duplicate detection and auditable result
- Native and browser camera QR scanning (source implemented; device tests pending)

## Not yet complete / disabled

- Dedicated Supabase database provisioning (free-plan capacity limit)
- Payment provider and payment webhook reconciliation
- Guest checkout and verified wallet sync
- Staff invitation administration and advanced multi-tenant organisations
- Offline entry: **not supported**, fails closed
- App Store / Play Store binaries and release
- End-to-end concurrency, security and native device acceptance testing

## Critical security principle

A locally decoded QR code **never** authorises entry. The verifier checks the signed credential, authenticates the operator, validates assignment, then performs atomic server-side one-time redemption. Incomplete or offline verification must deny admission.

For full reference see `docs/WORKFLOWS.md`.

## License

Copyright Nexx EventPass. All rights reserved pending owner licensing decision.
