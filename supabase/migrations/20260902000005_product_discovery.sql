-- =========================================================
-- 005 — Product Discovery: Search, Filters, Sorting Indexes
-- =========================================================

-- Enable trigram extension for fast fuzzy search (pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────────────────
-- Search indexes — GIN trigram on name, description, sku
-- Allows fast ILIKE / similarity queries without full scan
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_description_trgm
  ON public.products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
  ON public.products USING gin (sku gin_trgm_ops)
  WHERE sku IS NOT NULL;

-- Combined search index for name + description (covers most queries)
CREATE INDEX IF NOT EXISTS idx_products_search_trgm
  ON public.products USING gin ((coalesce(name,'') || ' ' || coalesce(description,'')) gin_trgm_ops);

-- ─────────────────────────────────────────────────────────
-- Filter indexes
-- ─────────────────────────────────────────────────────────
-- Price range filter (active products only)
CREATE INDEX IF NOT EXISTS idx_products_price_active
  ON public.products (price) WHERE is_active = true;

-- Stock / availability filter
CREATE INDEX IF NOT EXISTS idx_products_stock_active
  ON public.products (stock) WHERE is_active = true;

-- Featured filter
CREATE INDEX IF NOT EXISTS idx_products_featured_active
  ON public.products (is_featured) WHERE is_active = true AND is_featured = true;

-- Category + active (already exists as idx_products_active_category, but ensure)
CREATE INDEX IF NOT EXISTS idx_products_category_active
  ON public.products (category_id) WHERE is_active = true;

-- ─────────────────────────────────────────────────────────
-- Sort indexes
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_created_active
  ON public.products (created_at DESC) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_price_asc_active
  ON public.products (price ASC) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_price_desc_active
  ON public.products (price DESC) WHERE is_active = true;

-- ─────────────────────────────────────────────────────────
-- Categories: ensure updated_at trigger exists
-- ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'categories_updated'
  ) THEN
    CREATE TRIGGER categories_updated
      BEFORE UPDATE ON public.categories
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- Helper view: category product counts (active products only)
-- Used by storefront to show counts without extra queries
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.category_product_counts AS
SELECT
  c.id,
  c.name,
  c.slug,
  c.description,
  c.image_url,
  c.sort_order,
  c.is_active,
  COUNT(p.id) AS product_count
FROM public.categories c
LEFT JOIN public.products p ON p.category_id = c.id AND p.is_active = true
GROUP BY c.id;

GRANT SELECT ON public.category_product_counts TO anon, authenticated;
