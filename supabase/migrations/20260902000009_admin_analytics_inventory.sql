-- =========================================================
-- 009 — Admin Analytics, Inventory Threshold, Performance Indexes
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- App config: low-stock threshold (configurable, not hardcoded)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read app_config" ON public.app_config;
CREATE POLICY "Public read app_config" ON public.app_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage app_config" ON public.app_config;
CREATE POLICY "Admins manage app_config" ON public.app_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL ON public.app_config TO service_role;

CREATE TRIGGER app_config_updated BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_config (key, value) VALUES ('low_stock_threshold', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- Indexes for analytics (avoid N+1, avoid over-indexing)
-- ─────────────────────────────────────────────────────────
-- Orders: date range + payment/status filters are hot paths
CREATE INDEX IF NOT EXISTS idx_orders_created_range ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON public.orders(payment_method);

-- Order items: product performance needs product_id aggregation
CREATE INDEX IF NOT EXISTS idx_order_items_product_order ON public.order_items(product_id, order_id);

-- Profiles: customer list needs created_at sort + search on full_name
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles(created_at DESC);

-- Products: inventory filters (stock, is_active already indexed but add stock active)
CREATE INDEX IF NOT EXISTS idx_products_stock_active ON public.products(stock) WHERE is_active = true;

-- Variants: SKU search + stock
CREATE INDEX IF NOT EXISTS idx_variants_sku_trgm ON public.product_variants USING gin (sku gin_trgm_ops) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_variants_stock ON public.product_variants(stock);

-- Coupons: analytics needs code lookup (already idx_coupons_code)
-- No new coupon indexes

-- ─────────────────────────────────────────────────────────
-- Ensure CHECK stock cannot become negative (already via CHECK stock >=0 on products/variants)
-- But add trigger to prevent negative via concurrent updates racing past CHECK?
-- CHECK is sufficient at DB level; keep FOR UPDATE in create_order ensures atomic.
-- No change.
-- ─────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────
-- Helper view: product performance materialized as query (not materialized view to keep fresh)
-- Provides per-product sold stats for admin; underlying query uses order_items + orders join.
-- Not granting directly; admin will query via service logic.
-- ─────────────────────────────────────────────────────────
-- No view — keep client aggregation to avoid stale data, indexes above cover it.
