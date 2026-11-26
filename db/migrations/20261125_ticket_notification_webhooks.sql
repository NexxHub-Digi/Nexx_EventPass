-- Additive notification delivery observability; no customer email addresses or message bodies.
BEGIN;
ALTER TABLE ticket_email_outbox ADD COLUMN IF NOT EXISTS request_fingerprint text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_email_provider_id
  ON ticket_email_outbox(provider_id) WHERE provider_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS ticket_email_webhook_events (
  webhook_id text PRIMARY KEY,
  provider_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('email.sent','email.delivered','email.delivery_delayed','email.bounced','email.failed','email.complained','email.suppressed')),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_email_webhook_provider
  ON ticket_email_webhook_events(provider_id,occurred_at DESC);
COMMIT;
