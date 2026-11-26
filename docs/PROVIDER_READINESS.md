# Provider configuration readiness
Platform administrators can inspect /api/platform/provider-readiness and the web command centre's integration panel. It reports only configuration presence and expected database objects, not credential values, provider connectivity or acceptance. No external calls or provider activation take place. Actual Paystack sandbox checkout/refund, private validator authentication, verified Resend sender and controlled inbox delivery still require staging evidence.

Browser CI runner pinned to Ubuntu 24.04 after the Ubuntu 26.04 runner was incompatible with Playwright 1.56.1. The browser suite must pass; do not bypass its failure or claim acceptance from installation alone.
