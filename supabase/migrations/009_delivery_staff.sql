-- Migration 009: Soft delete, delivery staff, order status expansion, events, claim RPCs
-- REVIEW BEFORE APPLYING — do not auto-run from the app.

-- ========== ORDERS: soft delete + assignment ==========

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON orders (deleted_at);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_active ON orders (status) WHERE deleted_at IS NULL;

-- Expand status CHECK without breaking existing rows
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled'));

-- ========== STAFF ==========

CREATE TABLE IF NOT EXISTS staff (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 100),
  phone TEXT CHECK (phone IS NULL OR char_length(phone) BETWEEN 8 AND 20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_branches (
  staff_id UUID NOT NULL REFERENCES staff(user_id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_branches_branch ON staff_branches (branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff (is_active);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_branches ENABLE ROW LEVEL SECURITY;

-- No public policies: access via service role / SECURITY DEFINER helpers only.
-- Admins manage via service role in Next.js API/actions.

-- ========== ORDER EVENTS ==========

CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'staff', 'system', 'customer')),
  event TEXT NOT NULL CHECK (char_length(event) BETWEEN 1 AND 80),
  from_status TEXT NULL,
  to_status TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events (order_id, created_at DESC);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read order_events"
  ON order_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Staff read events for orders they can see (defined after is_staff helpers)

-- ========== HELPERS ==========

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.user_id = auth.uid() AND s.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_branch_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sb.branch_id
  FROM public.staff_branches sb
  JOIN public.staff s ON s.user_id = sb.staff_id
  WHERE sb.staff_id = auth.uid() AND s.is_active = true;
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_branch_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_branch_ids() TO authenticated, service_role;

-- Staff can read their own staff row
CREATE POLICY "Staff read self"
  ON staff FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_active = true);

CREATE POLICY "Staff read own branches"
  ON staff_branches FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid() AND public.is_staff());

CREATE POLICY "Admin read staff"
  ON staff FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin read staff_branches"
  ON staff_branches FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Staff SELECT on delivery orders in their branches (not deleted)
CREATE POLICY "Staff read delivery orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    AND deleted_at IS NULL
    AND order_type = 'delivery'
    AND branch_id IN (SELECT public.staff_branch_ids())
  );

CREATE POLICY "Staff read order_items for visible orders"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.deleted_at IS NULL
        AND o.order_type = 'delivery'
        AND o.branch_id IN (SELECT public.staff_branch_ids())
    )
  );

CREATE POLICY "Staff read order_events for visible orders"
  ON order_events FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_events.order_id
        AND o.deleted_at IS NULL
        AND o.order_type = 'delivery'
        AND o.branch_id IN (SELECT public.staff_branch_ids())
    )
  );

-- Hide soft-deleted from previous admin policies by tightening admin SELECT
-- (existing FOR ALL / SELECT policies still allow deleted rows for admin trash —
-- soft-deleted filtering is applied in application queries for lists/stats.)

-- ========== ATOMIC CLAIM / DELIVER / RELEASE ==========

CREATE OR REPLACE FUNCTION public.claim_order(p_order_id UUID)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rec public.orders;
BEGIN
  IF uid IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO rec
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF rec.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'order deleted';
  END IF;

  IF rec.order_type <> 'delivery' THEN
    RAISE EXCEPTION 'not a delivery order';
  END IF;

  IF rec.branch_id NOT IN (SELECT public.staff_branch_ids()) THEN
    RAISE EXCEPTION 'branch not allowed';
  END IF;

  IF rec.status <> 'ready' OR rec.assigned_to IS NOT NULL THEN
    RAISE EXCEPTION 'order already claimed or not ready';
  END IF;

  UPDATE public.orders
  SET
    assigned_to = uid,
    claimed_at = now(),
    status = 'on_the_way'
  WHERE id = p_order_id
  RETURNING * INTO rec;

  INSERT INTO public.order_events (order_id, actor_id, actor_role, event, from_status, to_status, meta)
  VALUES (p_order_id, uid, 'staff', 'claimed', 'ready', 'on_the_way', '{}'::jsonb);

  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.deliver_order(p_order_id UUID)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rec public.orders;
BEGIN
  IF uid IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO rec FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF rec.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'order deleted'; END IF;
  IF rec.assigned_to IS DISTINCT FROM uid THEN RAISE EXCEPTION 'not assignee'; END IF;
  IF rec.status <> 'on_the_way' THEN RAISE EXCEPTION 'not on the way'; END IF;

  UPDATE public.orders
  SET
    status = 'delivered',
    delivered_at = now()
  WHERE id = p_order_id
  RETURNING * INTO rec;

  INSERT INTO public.order_events (order_id, actor_id, actor_role, event, from_status, to_status, meta)
  VALUES (p_order_id, uid, 'staff', 'delivered', 'on_the_way', 'delivered', '{}'::jsonb);

  RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_order(p_order_id UUID)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rec public.orders;
BEGIN
  IF uid IS NULL OR NOT public.is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO rec FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF rec.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'order deleted'; END IF;
  IF rec.assigned_to IS DISTINCT FROM uid THEN RAISE EXCEPTION 'not assignee'; END IF;
  IF rec.status <> 'on_the_way' THEN RAISE EXCEPTION 'not on the way'; END IF;

  UPDATE public.orders
  SET
    assigned_to = NULL,
    claimed_at = NULL,
    status = 'ready'
  WHERE id = p_order_id
  RETURNING * INTO rec;

  INSERT INTO public.order_events (order_id, actor_id, actor_role, event, from_status, to_status, meta)
  VALUES (p_order_id, uid, 'staff', 'released', 'on_the_way', 'ready', '{}'::jsonb);

  RETURN rec;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deliver_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_order(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deliver_order(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_order(UUID) TO authenticated, service_role;

COMMENT ON TABLE staff IS 'Delivery staff mapped to auth.users; managed by admin via service role.';
COMMENT ON TABLE order_events IS 'Append-only order timeline; written by server / SECURITY DEFINER RPCs.';
