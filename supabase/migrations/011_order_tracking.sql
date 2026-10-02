-- Migration 011: Customer order tracking token
-- REVIEW BEFORE APPLYING — do not auto-run from the app.
-- Depends on 009 + 010.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_token UUID;

UPDATE orders
SET tracking_token = gen_random_uuid()
WHERE tracking_token IS NULL;

ALTER TABLE orders
  ALTER COLUMN tracking_token SET NOT NULL,
  ALTER COLUMN tracking_token SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_token
  ON orders (tracking_token);

-- No public RLS SELECT by token: Next.js server uses service_role only.

COMMENT ON COLUMN orders.tracking_token IS
  'Unpredictable public tracking id. Served only via server route with service_role; never expose full PII.';
