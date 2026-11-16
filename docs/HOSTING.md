# Nexx EventPass hosting

## Preview deployment
The connected Vercel Hobby project is a development preview. Vercel Hobby's terms prohibit commercial use, so do not operate paid ticket sales on the Hobby site.

## Free-plan commercial deployment option
Netlify's Free plan supports Next.js and has been permitted for commercial sites under its usage limits. Import the GitHub repository `NexxHub-Digi/Nexx_EventPass` and deploy the repository root with `npm run build`, using `netlify.toml`.

Configure these as private variables in the Netlify dashboard:
- `DATABASE_URL`: Neon pooled database URI
- `AUTH_SECRET`: existing random secret, at least 32 characters
- `QR_SIGNING_SECRET`: existing random secret, at least 32 characters
- `ORGANISER_INVITE_CODE`: organiser onboarding code, at least 16 characters

Keep AUTH_SECRET and QR_SIGNING_SECRET unchanged when migrating active tickets; rotating QR_SIGNING_SECRET invalidates issued QR codes.

## Organiser account
Choose **Sign in → Create account** on the website, enter a name/email/password and your private organiser invitation code from host settings. Guests register without an organiser code. The organiser can then create events and assign registered gate staff.

## Manual payment
Use payment instructions verified independently with the organiser. The guest submits a transaction reference, the organiser confirms actual funds received in their bank records, then approves or rejects. Signed QR tickets are issued only after approval.

## Before paid admission
Test confirmed and rejected manual payments, QR issuance, concurrent scans, wrong-event codes, unstable connections, device cameras, backups and account recovery. Add rate limiting and email verification before public scale. Review the current hosting terms and monthly limits.
