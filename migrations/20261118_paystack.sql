-- Apply only after reviewing existing production schema and backup.
CREATE TABLE IF NOT EXISTS paystack_organiser_accounts (
 organiser_id uuid PRIMARY KEY REFERENCES app_users(id),
 subaccount_code text NOT NULL UNIQUE,
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS paystack_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 commission_basis_points integer NOT NULL DEFAULT 500 CHECK(commission_basis_points BETWEEN 0 AND 10000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO paystack_settings(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS paystack_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES ticket_orders(id),
 buyer_id uuid NOT NULL REFERENCES app_users(id),
 organiser_id uuid NOT NULL REFERENCES app_users(id),
 reference text NOT NULL UNIQUE,
 amount_kobo bigint NOT NULL CHECK(amount_kobo>0),
 commission_kobo bigint NOT NULL CHECK(commission_kobo>=0),
 subaccount_code text NOT NULL,
 status text NOT NULL DEFAULT 'initialized' CHECK(status IN ('initialized','success','failed','refund_pending','refunded','disputed','reconciliation_required')),
 provider_transaction_id text,
 provider_paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paystack_payments_order_idx ON paystack_payments(order_id);
CREATE TABLE IF NOT EXISTS paystack_events (
 event_key text PRIMARY KEY,
 reference text,
 event_type text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS paystack_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_id uuid NOT NULL REFERENCES paystack_payments(id),
 requested_by uuid NOT NULL REFERENCES app_users(id),
 reason text NOT NULL,
 provider_refund_id text,
 status text NOT NULL DEFAULT 'requested',
 created_at timestamptz NOT NULL DEFAULT now()
);
