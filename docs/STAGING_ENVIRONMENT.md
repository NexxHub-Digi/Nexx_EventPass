# Nexx EventPass staging deployment

This branch is the stable source of the Vercel Preview deployment used by internal mobile preview builds. It must never use the live production Neon connection string or production JWT/QR signing secrets.

Vercel Preview uses a separate Neon branch and signing keys. The initial database was cloned from production; any copied records should be treated as sensitive staging data and never exposed to testers who are not authorised to view them. Do not send real payment receipts or run financial transactions on staging.

## Deployment rules
- Fast-forward or merge the most recent tested main commit before each full release acceptance cycle.
- Confirm this branch's Preview alias returns HTTP 200 on /api/events and /api/auth/google/status, and uses the Preview-scoped database.
- Confirm native EAS preview EXPO_PUBLIC_API_URL is exactly the HTTPS Preview branch alias, not the production domain.
- Google callback URLs for this Preview hostname must be configured and tested independently in Google Cloud.
- Use test-only payment credentials; no live charges or automatic refunds.
