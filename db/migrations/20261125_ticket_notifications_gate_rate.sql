-- Additive only. Review and apply before releasing the dependent code.
BEGIN;
CREATE TABLE IF NOT EXISTS eventpass_gate_rate_windows (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  entry_method text NOT NULL CHECK (entry_method IN ('qr','manual')),
  window_started timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (event_id,actor_id,entry_method)
);
CREATE TABLE IF NOT EXISTS ticket_email_outbox (
  order_id uuid PRIMARY KEY REFERENCES ticket_orders(id),
  recipient_id uuid NOT NULL REFERENCES app_users(id),
  event_id uuid NOT NULL REFERENCES events(id),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','accepted','skipped','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  first_attempt_at timestamptz,
  lease_until timestamptz,
  claim_token uuid,
  provider_id text,
  completed_at timestamptz,
  last_result text
);
CREATE INDEX IF NOT EXISTS idx_ticket_email_outbox_due
  ON ticket_email_outbox(next_attempt_at) WHERE state IN ('pending','sending');
CREATE OR REPLACE FUNCTION eventpass_enqueue_ticket_email() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO ticket_email_outbox(order_id,recipient_id,event_id)
    VALUES (NEW.order_id,NEW.recipient_id,NEW.event_id)
    ON CONFLICT (order_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS eventpass_ticket_email_enqueue ON ticket_deliveries;
CREATE TRIGGER eventpass_ticket_email_enqueue
AFTER INSERT ON ticket_deliveries FOR EACH ROW EXECUTE FUNCTION eventpass_enqueue_ticket_email();
COMMIT;
