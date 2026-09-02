-- =========================================================
-- 006 — Fulfillment Pipeline: tracking timeline, stock alerts
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1. Enforce forwarding_status values (was unconstrained TEXT)
-- ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_forwarding_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_forwarding_status_check
      CHECK (forwarding_status IN ('pending','forwarded','failed','manual'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- 2. Indexes for fulfillment queue and supplier lookups
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_forwarding_status
  ON public.orders (forwarding_status);

CREATE INDEX IF NOT EXISTS idx_orders_supplier_id
  ON public.orders (supplier_id) WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_forwarded_at
  ON public.orders (forwarded_at DESC) WHERE forwarded_at IS NOT NULL;

-- Low-stock helper index (active products with ≤5 stock)
CREATE INDEX IF NOT EXISTS idx_products_low_stock
  ON public.products (stock) WHERE is_active = true AND stock <= 5;

-- ─────────────────────────────────────────────────────────
-- 3. Improve lookup_order RPC — include fulfillment, payment, order_number
--    Keep UUID variant; add order_number variant if missing
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.lookup_order(_order_id UUID, _email TEXT)
RETURNS TABLE (
  id UUID, order_number TEXT, status TEXT, total NUMERIC, created_at TIMESTAMPTZ,
  tracking_carrier TEXT, tracking_number TEXT, tracking_url TEXT,
  forwarding_status TEXT, fulfillment_status TEXT,
  payment_status TEXT, payment_method TEXT, customer_email TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number, o.status::TEXT, o.total, o.created_at,
         o.tracking_carrier, o.tracking_number, o.tracking_url,
         o.forwarding_status, o.fulfillment_status::TEXT,
         o.payment_status::TEXT, o.payment_method, o.customer_email
  FROM public.orders o
  WHERE o.id = _order_id AND lower(o.customer_email) = lower(_email)
  LIMIT 1;
$$;

-- Order-number variant (for human-friendly tracking)
CREATE OR REPLACE FUNCTION public.lookup_order(_order_number TEXT, _email TEXT)
RETURNS TABLE (
  id UUID, order_number TEXT, status TEXT, total NUMERIC, created_at TIMESTAMPTZ,
  tracking_carrier TEXT, tracking_number TEXT, tracking_url TEXT,
  forwarding_status TEXT, fulfillment_status TEXT,
  payment_status TEXT, payment_method TEXT, customer_email TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number, o.status::TEXT, o.total, o.created_at,
         o.tracking_carrier, o.tracking_number, o.tracking_url,
         o.forwarding_status, o.fulfillment_status::TEXT,
         o.payment_status::TEXT, o.payment_method, o.customer_email
  FROM public.orders o
  WHERE o.order_number = _order_number AND lower(o.customer_email) = lower(_email)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_order(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_order(TEXT, TEXT) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────
-- 4. Low-stock helper view (for admin banner)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.low_stock_products AS
SELECT id, name, slug, stock, sku, supplier_id
FROM public.products
WHERE is_active = true AND stock <= 5
ORDER BY stock ASC;

GRANT SELECT ON public.low_stock_products TO authenticated;

-- ─────────────────────────────────────────────────────────
-- 5. Ensure RLS still blocks anon direct select on orders
--    (unchanged — only RPC is allowed)
-- ─────────────────────────────────────────────────────────
-- No change: existing policy USING (false) for anon SELECT is correct.

-- ─────────────────────────────────────────────────────────
-- 6. Trigger: when tracking info is set, auto-bump fulfillment
--    If carrier+number are set and fulfillment still pending/processing,
--    move to shipped. Does not override delivered/returned/cancelled.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_bump_fulfillment_on_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_carrier IS NOT NULL AND NEW.tracking_number IS NOT NULL
     AND NEW.fulfillment_status IN ('pending','processing','packed')
  THEN
    NEW.fulfillment_status := 'shipped';
    -- Also keep legacy status in sync for older UIs
    IF NEW.status = 'pending' OR NEW.status = 'confirmed' THEN
      NEW.status := 'shipped';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_bump_fulfillment ON public.orders;
CREATE TRIGGER trg_auto_bump_fulfillment
  BEFORE UPDATE OF tracking_carrier, tracking_number ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_bump_fulfillment_on_tracking();
