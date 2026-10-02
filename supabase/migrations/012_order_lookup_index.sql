-- Review only — do not auto-apply.
-- Speeds public order lookup by order_number (non-deleted rows).

CREATE INDEX IF NOT EXISTS orders_order_number_active_idx
  ON public.orders (order_number)
  WHERE deleted_at IS NULL;
