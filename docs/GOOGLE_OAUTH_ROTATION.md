# Google OAuth Client Rotation and Callback Verification

**Security status: action required in Google Cloud.** Four client secrets were previously shared in a chat and should be treated as compromised. The GitHub repository must not contain secret values. Do not send new secrets by email or in chat.

## Four independent OAuth clients

Each portal uses a **Google Web application OAuth client**:

| Role | Server variable prefix | Web login path |
| --- | --- | --- |
| User | `GOOGLE_USER` (legacy `GOOGLE_GUEST` fallback) | `/login/user` |
| Organiser | `GOOGLE_ORGANISER` | `/login/organiser` |
| Gate Operator | `GOOGLE_GATE` | `/login/gate` |
| Platform Admin | `GOOGLE_PLATFORM` | `/login/platform-admin` |

Each client must register the exact same callback on every intended deployed origin:
- Vercel production: `https://nexx-eventpass.vercel.app/api/auth/google/callback` **only if that hostname is actually attached/serving the project**.
- Vercel team alias: `https://nexx-eventpass-nexxs-projects-903f5c1d.vercel.app/api/auth/google/callback` **if this is the actual active domain**.
- Netlify: `https://YOUR-ASSIGNED-SITE.netlify.app/api/auth/google/callback` — replace only after connecting the site.

Google Cloud Console → Google Auth Platform → Clients:
1. Open each of the four existing client records.
2. Replace the exposed client secret using Google's available rotation controls, or create a replacement Web OAuth client if replacement is unavailable.
3. Set its exact authorised HTTPS redirect URIs (and web origins if the client type needs them).
4. Add replacement `_CLIENT_ID` and `_CLIENT_SECRET` values directly in **Vercel Project → Settings → Environment Variables** and **Netlify Site configuration → Environment variables**. Secrets must only be available to server functions; never `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.
5. Deploy both hosts and test every role with Google sign-in, cancelled login, refresh persistence and logout. Confirm an unapproved User cannot access Platform Admin or Organiser workspace.
6. After successful replacement, revoke the exposed credentials/client. Keep an audit trail of rotation date in a secure operations record.

**Google client secret changes cannot be made through the GitHub or Vercel connector alone.** A Google Cloud owner must complete the Cloud Console action. The Google callback test in CI validates redirect construction using fake client IDs; it cannot prove Cloud Console configuration or a live interactive Google login.

## Native callback schemes

The server completes Google OIDC at the HTTPS callback and returns a short-lived PKCE-bound code to one of:
`eventpassuser://oauth`, `eventpassorganiser://oauth`, `eventpassgate://oauth`, `eventpassplatformadmin://oauth`.

Use signed development/standalone builds for tests, not Expo Go. Verify Android and iOS deep links on devices; never put Google client secrets in Expo app code. Device acceptance matrix: `docs/MOBILE_ANDROID_IOS_ACCEPTANCE.md`.

Reference: Google Cloud OAuth Web Application documentation: https://developers.google.com/identity/protocols/oauth2/web-server
