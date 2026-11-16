# EventPass Google sign-in setup

Google OAuth uses **Neon**, not Supabase. Password sign-in continues to work alongside Google.

1. Go to Google Cloud Console → Google Auth Platform. Configure the app branding, consent audience, and required test users if in Testing mode.
2. Create an OAuth Client ID of type **Web application** for EventPass.
3. Add **Authorized JavaScript origin**: `https://nexx-eventpass.vercel.app`
4. Add **Authorized redirect URI**: `https://nexx-eventpass.vercel.app/api/auth/google/callback`.
5. In Vercel → `nexx-eventpass` → Settings → Environment Variables, add server-only `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, plus `NEXT_PUBLIC_SITE_URL=https://nexx-eventpass.vercel.app`. Scope to production/preview/development appropriately. Do not put OAuth client secrets in GitHub or chat.
6. Optionally use separate OAuth clients for each interface: `GOOGLE_GUEST_CLIENT_ID` and `GOOGLE_GUEST_CLIENT_SECRET`, likewise `GOOGLE_ORGANISER_*`, `GOOGLE_GATE_*`, `GOOGLE_PLATFORM_*`. Every configured client must have the same authorized EventPass callback URI.
7. Redeploy after changing environment variables. Check `/api/auth/google/status` to confirm enabled portals.

## Role safety

- Guest: first-time verified Google identities can create **guest-only** accounts.
- Organiser: existing authorised organiser account must be linked while signed in with password.
- Gate operator: existing account must be assigned to a gate by an organiser.
- Platform administrator: must be provisioned by trusted server-side admin operations; no public self-signup.
- Matching a Google email to an existing local account is **never** sufficient to link or elevate that account. Sign in with the original email/password and choose **Link Google account**.
- OAuth authorization-code exchange uses PKCE, a signed short-lived state cookie, nonce, Google JWKS signature verification, audience and issuer checks, and verified email.
- Google client secrets and session signing keys are server-side only.

## Native Android / iOS

This commit implements Google OAuth on the web. Expo native Google authentication requires separate Android/iOS OAuth clients and an application deep-link/redirect handoff designed to keep app tokens out of URLs. Existing mobile email/password login remains available until that flow is integrated and tested.
