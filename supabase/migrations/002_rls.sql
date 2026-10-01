-- Migration 002: Row Level Security policies

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ========== PUBLIC READ (active/available only) ==========

CREATE POLICY "Public can read active branches"
  ON branches FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Public can read active categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM branches b
      WHERE b.id = categories.branch_id AND b.is_active = true
    )
  );

CREATE POLICY "Public can read available items"
  ON items FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM categories c
      JOIN branches b ON b.id = c.branch_id
      WHERE c.id = items.category_id
        AND c.is_active = true
        AND b.is_active = true
    )
  );

-- ========== ADMIN ACCESS (via is_admin()) ==========

CREATE POLICY "Admin full access branches"
  ON branches FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin full access categories"
  ON categories FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin full access items"
  ON items FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin read orders"
  ON orders FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admin update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin read order_items"
  ON order_items FOR SELECT
  TO authenticated
  USING (is_admin());

-- Orders INSERT is done via service role in API route only (bypasses RLS).
-- No public INSERT policy on orders / order_items.

-- ========== STORAGE POLICIES (menu-images bucket) ==========
-- Run after creating the bucket:
--
-- CREATE POLICY "Public read menu images"
--   ON storage.objects FOR SELECT
--   TO anon, authenticated
--   USING (bucket_id = 'menu-images');
--
-- CREATE POLICY "Admin upload menu images"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'menu-images' AND is_admin());
--
-- CREATE POLICY "Admin update menu images"
--   ON storage.objects FOR UPDATE
--   TO authenticated
--   USING (bucket_id = 'menu-images' AND is_admin())
--   WITH CHECK (bucket_id = 'menu-images' AND is_admin());
--
-- CREATE POLICY "Admin delete menu images"
--   ON storage.objects FOR DELETE
--   TO authenticated
--   USING (bucket_id = 'menu-images' AND is_admin());
