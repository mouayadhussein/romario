-- Migration 005: Optional customer geolocation on delivery orders

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_lat NUMERIC(9, 6) NULL,
  ADD COLUMN IF NOT EXISTS customer_lng NUMERIC(9, 6) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_customer_lat_range_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_customer_lat_range_check
      CHECK (customer_lat IS NULL OR (customer_lat >= -90 AND customer_lat <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_customer_lng_range_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_customer_lng_range_check
      CHECK (customer_lng IS NULL OR (customer_lng >= -180 AND customer_lng <= 180));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_customer_location_pair_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_customer_location_pair_check
      CHECK (
        (customer_lat IS NULL AND customer_lng IS NULL)
        OR (customer_lat IS NOT NULL AND customer_lng IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN orders.customer_lat IS
  'Optional customer latitude for delivery orders (WGS84). Must be set with customer_lng.';
COMMENT ON COLUMN orders.customer_lng IS
  'Optional customer longitude for delivery orders (WGS84). Must be set with customer_lat.';
