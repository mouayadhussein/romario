-- Migration 008: Privacy — anonymize old customer PII (REVIEW BEFORE APPLYING)
-- Keeps order totals/status for analytics; clears personal fields after retention.
-- Default retention: 6 months (override via cron argument).

CREATE OR REPLACE FUNCTION public.anonymize_old_order_pii(
  p_retention_months INTEGER DEFAULT 6
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF p_retention_months IS NULL OR p_retention_months < 1 OR p_retention_months > 120 THEN
    RAISE EXCEPTION 'invalid retention months';
  END IF;

  -- Only service_role should call this (no GRANT to anon/authenticated below)
  UPDATE public.orders
  SET
    customer_name = 'محذوف',
    customer_phone = '00000000',
    customer_address = NULL,
    customer_lat = NULL,
    customer_lng = NULL,
    table_number = NULL,
    general_note = NULL
  WHERE created_at < (now() - make_interval(months => p_retention_months))
    AND customer_name IS DISTINCT FROM 'محذوف';

  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE public.order_items oi
  SET note = NULL
  FROM public.orders o
  WHERE oi.order_id = o.id
    AND o.created_at < (now() - make_interval(months => p_retention_months))
    AND oi.note IS NOT NULL;

  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_old_order_pii(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.anonymize_old_order_pii(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.anonymize_old_order_pii(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_old_order_pii(INTEGER) TO service_role;

COMMENT ON FUNCTION public.anonymize_old_order_pii(INTEGER) IS
  'Anonymizes customer PII on orders older than N months. Call from a scheduled job with service_role. Example: SELECT anonymize_old_order_pii(6);';

-- Optional: schedule via pg_cron if available in your Supabase plan:
-- SELECT cron.schedule('anonymize-order-pii', '0 3 1 * *', $$SELECT public.anonymize_old_order_pii(6)$$);
