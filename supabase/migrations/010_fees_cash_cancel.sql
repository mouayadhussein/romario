-- Migration 010: Delivery fees, cash settlement, cancel reason
-- REVIEW BEFORE APPLYING — do not auto-run from the app.
-- Depends on 009_delivery_staff.sql

-- ========== BRANCH FEES ==========

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_delivery_threshold NUMERIC(10, 2) NULL;

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_delivery_fee_nonneg;
ALTER TABLE branches ADD CONSTRAINT branches_delivery_fee_nonneg CHECK (delivery_fee >= 0);

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_min_order_nonneg;
ALTER TABLE branches ADD CONSTRAINT branches_min_order_nonneg CHECK (min_order_amount >= 0);

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_free_delivery_nonneg;
ALTER TABLE branches ADD CONSTRAINT branches_free_delivery_nonneg
  CHECK (free_delivery_threshold IS NULL OR free_delivery_threshold >= 0);

-- ========== ORDER MONEY ==========

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collected_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill legacy rows
UPDATE orders
SET subtotal = total,
    delivery_fee = 0
WHERE subtotal IS NULL;

ALTER TABLE orders ALTER COLUMN subtotal SET NOT NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_subtotal_nonneg;
ALTER TABLE orders ADD CONSTRAINT orders_subtotal_nonneg CHECK (subtotal >= 0);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_fee_nonneg;
ALTER TABLE orders ADD CONSTRAINT orders_delivery_fee_nonneg CHECK (delivery_fee >= 0);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_cancel_reason_len;
ALTER TABLE orders ADD CONSTRAINT orders_cancel_reason_len
  CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 200);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_collected_amount_nonneg;
ALTER TABLE orders ADD CONSTRAINT orders_collected_amount_nonneg
  CHECK (collected_amount IS NULL OR collected_amount >= 0);

-- ========== CASH SETTLEMENTS ==========

CREATE TABLE IF NOT EXISTS cash_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(user_id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  settled_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_settlements_staff ON cash_settlements (staff_id, created_at DESC);

ALTER TABLE cash_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read cash_settlements"
  ON cash_settlements FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Staff read own cash_settlements"
  ON cash_settlements FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid() AND public.is_staff());

-- Writes only via service role (no INSERT policies for authenticated)

-- ========== DELIVER ORDER WITH CASH ==========

DROP FUNCTION IF EXISTS public.deliver_order(UUID);

CREATE OR REPLACE FUNCTION public.deliver_order(
  p_order_id UUID,
  p_collected_amount NUMERIC DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rec public.orders;
  note_clean TEXT;
  amount NUMERIC(10, 2);
BEGIN
  IF uid IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO rec FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF rec.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'order deleted'; END IF;
  IF rec.assigned_to IS DISTINCT FROM uid THEN RAISE EXCEPTION 'not assignee'; END IF;
  IF rec.status <> 'on_the_way' THEN RAISE EXCEPTION 'not on the way'; END IF;

  amount := COALESCE(p_collected_amount, rec.total);
  IF amount < 0 THEN
    RAISE EXCEPTION 'invalid collected amount';
  END IF;

  note_clean := NULLIF(left(trim(COALESCE(p_note, '')), 200), '');
  IF amount IS DISTINCT FROM rec.total AND note_clean IS NULL THEN
    RAISE EXCEPTION 'note required when amount differs';
  END IF;

  UPDATE public.orders
  SET
    status = 'delivered',
    delivered_at = now(),
    collected_amount = amount,
    collected_at = now()
  WHERE id = p_order_id
  RETURNING * INTO rec;

  INSERT INTO public.order_events (order_id, actor_id, actor_role, event, from_status, to_status, meta)
  VALUES (
    p_order_id,
    uid,
    'staff',
    'delivered',
    'on_the_way',
    'delivered',
    jsonb_build_object(
      'collected_amount', amount,
      'note', note_clean
    )
  );

  RETURN rec;
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_order(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deliver_order(UUID, NUMERIC, TEXT) TO authenticated, service_role;

COMMENT ON COLUMN branches.delivery_fee IS 'Flat delivery fee for delivery orders (0 if free/always free).';
COMMENT ON COLUMN branches.free_delivery_threshold IS 'If subtotal >= threshold, delivery_fee becomes 0. NULL = no free threshold.';
COMMENT ON TABLE cash_settlements IS 'Admin records cash handed in by delivery staff.';
