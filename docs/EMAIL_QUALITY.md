# Nexx Email Quality Verification (optional integration)

This app integrates **Umut Erturk's MIT-licensed email-verifier** as an optional, self-hosted API. It checks syntax, domain/MX and known disposable domains; it does **not** establish an inbox exists or that a person owns it. Google OAuth / email confirmation must remain mandatory for identity.

## Deployment
Deploy the Go verifier as an internal service behind HTTPS with authentication, request limits, logging redaction and network restrictions. Do not point production at the public Fly.io demo.

- `NEXX_EMAIL_VALIDATOR_URL=https://your-private-validator.example/api/validate`
- `NEXX_EMAIL_VALIDATOR_TOKEN=...` (optional bearer token used by a trusted proxy; upstream Go application does not independently enforce it)
- HTTP is only allowed for local loopback sidecars: `http://127.0.0.1:8080/api/validate`.

The application only POSTs from the server, never from a client. Requests use a 2.5s deadline, reject redirects, and never persist the verification result or email in diagnostic logs. If the endpoint is missing, misconfigured or unreachable, existing invitation flow continues unchanged.

## Policy
- `INVALID_FORMAT` and `DISPOSABLE`: reject new invitations.
- `INVALID_DOMAIN`, `NO_MX_RECORDS`, `INVALID`: advisory/review; don't block Google-verified users because DNS can be inconclusive.
- `VALID`, `PROBABLY_VALID`: quality check only; **never evidence of identity**.
- Unknown/mismatched/failed response: fail open for this *advisory* check.

No live email checks, third-party data sharing, SMTP probing, user-provisioning, payment modifications or production deployment happen until the private service is provisioned and an environment variable is configured.
