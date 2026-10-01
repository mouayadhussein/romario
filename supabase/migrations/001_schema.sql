-- Migration 001: Core schema for restaurant menu & ordering

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Branches
CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  map_url TEXT,
  working_hours TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branches_sort ON branches (sort_order);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches (is_active);

-- Per-branch order counters (hidden from public; service role / SECURITY DEFINER only)
CREATE TABLE IF NOT EXISTS branch_counters (
  branch_id UUID PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE branch_counters ENABLE ROW LEVEL SECURITY;
-- No policies on branch_counters: access via service role / SECURITY DEFINER only.

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_branch_id ON categories (branch_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories (branch_id, sort_order);

-- Items
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_items_category_id ON items (category_id);
CREATE INDEX IF NOT EXISTS idx_items_sort ON items (category_id, sort_order);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  order_type TEXT NOT NULL CHECK (order_type IN ('delivery', 'pickup', 'dine_in')),
  table_number TEXT,
  general_note TEXT,
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'preparing', 'delivered', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_orders_branch_created ON orders (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);

-- Order items (with snapshots)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  price_snapshot NUMERIC(10, 2) NOT NULL CHECK (price_snapshot >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_id ON order_items (item_id);

-- Admins (maps Supabase Auth users to admin role)
CREATE TABLE IF NOT EXISTS admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
-- No policies on admins: access via service role only.

CREATE OR REPLACE FUNCTION is_admin()
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

-- Atomic sequential order number per branch (service_role only)
CREATE OR REPLACE FUNCTION generate_order_number(p_branch_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id) THEN
    RAISE EXCEPTION 'branch not found: %', p_branch_id;
  END IF;

  INSERT INTO public.branch_counters (branch_id, last_number)
  VALUES (p_branch_id, 1)
  ON CONFLICT (branch_id) DO UPDATE
    SET last_number = public.branch_counters.last_number + 1
  RETURNING last_number INTO next_num;

  RETURN 'ORD-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION generate_order_number(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION generate_order_number(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION generate_order_number(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION generate_order_number(UUID) TO service_role;

-- Storage bucket for menu images (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true)
-- ON CONFLICT DO NOTHING;
