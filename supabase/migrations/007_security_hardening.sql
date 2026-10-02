-- Migration 007: Security hardening (REVIEW BEFORE APPLYING — do not auto-run)
-- Adds text length CHECKs, indexes, storage policies for menu-images,
-- and REVOKE hardening notes.
-- NOTE: Public items RLS stays as in 002 (unavailable items remain readable;
-- the app shows them disabled; the orders API rejects them).

-- ========== TEXT LENGTH CONSTRAINTS ==========

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_name_len;
ALTER TABLE branches ADD CONSTRAINT branches_name_len CHECK (char_length(name) BETWEEN 1 AND 100);

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_slug_len;
ALTER TABLE branches ADD CONSTRAINT branches_slug_len CHECK (char_length(slug) BETWEEN 1 AND 50);

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_address_len;
ALTER TABLE branches ADD CONSTRAINT branches_address_len
  CHECK (address IS NULL OR char_length(address) <= 300);

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_phone_len;
ALTER TABLE branches ADD CONSTRAINT branches_phone_len
  CHECK (phone IS NULL OR char_length(phone) <= 20);

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_whatsapp_len;
ALTER TABLE branches ADD CONSTRAINT branches_whatsapp_len
  CHECK (whatsapp_number IS NULL OR char_length(whatsapp_number) <= 25);

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_map_url_len;
ALTER TABLE branches ADD CONSTRAINT branches_map_url_len
  CHECK (map_url IS NULL OR char_length(map_url) <= 500);

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_working_hours_len;
ALTER TABLE branches ADD CONSTRAINT branches_working_hours_len
  CHECK (working_hours IS NULL OR char_length(working_hours) <= 200);

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_len;
ALTER TABLE categories ADD CONSTRAINT categories_name_len CHECK (char_length(name) BETWEEN 1 AND 100);

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_image_url_len;
ALTER TABLE categories ADD CONSTRAINT categories_image_url_len
  CHECK (image_url IS NULL OR char_length(image_url) <= 500);

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_name_len;
ALTER TABLE items ADD CONSTRAINT items_name_len CHECK (char_length(name) BETWEEN 1 AND 100);

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_description_len;
ALTER TABLE items ADD CONSTRAINT items_description_len
  CHECK (description IS NULL OR char_length(description) <= 500);

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_image_url_len;
ALTER TABLE items ADD CONSTRAINT items_image_url_len
  CHECK (image_url IS NULL OR char_length(image_url) <= 500);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_name_len;
ALTER TABLE orders ADD CONSTRAINT orders_customer_name_len
  CHECK (char_length(customer_name) BETWEEN 1 AND 100);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_phone_len;
ALTER TABLE orders ADD CONSTRAINT orders_customer_phone_len
  CHECK (char_length(customer_phone) BETWEEN 8 AND 20);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_address_len;
ALTER TABLE orders ADD CONSTRAINT orders_customer_address_len
  CHECK (customer_address IS NULL OR char_length(customer_address) <= 300);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_table_number_len;
ALTER TABLE orders ADD CONSTRAINT orders_table_number_len
  CHECK (table_number IS NULL OR char_length(table_number) <= 20);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_general_note_len;
ALTER TABLE orders ADD CONSTRAINT orders_general_note_len
  CHECK (general_note IS NULL OR char_length(general_note) <= 500);

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_name_snapshot_len;
ALTER TABLE order_items ADD CONSTRAINT order_items_name_snapshot_len
  CHECK (char_length(name_snapshot) BETWEEN 1 AND 100);

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_quantity_max;
ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_max
  CHECK (quantity > 0 AND quantity <= 20);

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_note_len;
ALTER TABLE order_items ADD CONSTRAINT order_items_note_len
  CHECK (note IS NULL OR char_length(note) <= 200);

-- ========== INDEXES ==========

CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (customer_phone);

-- ========== STORAGE: menu-images ==========
-- Ensure bucket exists (public read for menu display)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read menu images" ON storage.objects;
CREATE POLICY "Public read menu images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Admin upload menu images" ON storage.objects;
CREATE POLICY "Admin upload menu images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'menu-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admin update menu images" ON storage.objects;
CREATE POLICY "Admin update menu images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'menu-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'menu-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admin delete menu images" ON storage.objects;
CREATE POLICY "Admin delete menu images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu-images' AND public.is_admin());

-- ========== FUNCTION HARDENING (re-affirm) ==========

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_order_number(p_branch_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id) THEN
    RAISE EXCEPTION 'branch not found';
  END IF;

  INSERT INTO public.branch_counters (branch_id, last_number)
  VALUES (p_branch_id, 1)
  ON CONFLICT (branch_id) DO UPDATE
    SET last_number = public.branch_counters.last_number + 1
  RETURNING last_number INTO next_num;

  RETURN 'ORD-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_order_number(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_order_number(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_order_number(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number(UUID) TO service_role;

COMMENT ON FUNCTION public.is_admin() IS 'Returns true if auth.uid() is in public.admins. SECURITY DEFINER with fixed search_path.';
