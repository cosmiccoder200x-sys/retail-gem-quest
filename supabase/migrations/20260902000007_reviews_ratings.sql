-- =========================================================
-- 007 — Reviews, Ratings & Trust
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- Reviews table
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL CHECK (char_length(review_text) BETWEEN 5 AND 2000),
  verified_purchase BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public can read visible reviews (published products only via is_active join not needed — products RLS already guards)
CREATE POLICY "Public read visible reviews"
  ON public.reviews FOR SELECT TO anon, authenticated
  USING (is_visible = true);

-- Authenticated can read own reviews even if hidden (for edit)
CREATE POLICY "Users read own reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Authenticated can create own review (verified_purchase forced by trigger, is_visible defaults true)
CREATE POLICY "Users create own reviews"
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update own review but cannot flip verified_purchase or is_visible
CREATE POLICY "Users update own reviews"
  ON public.reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete own review
CREATE POLICY "Users delete own reviews"
  ON public.reviews FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admins manage all reviews (moderation)
CREATE POLICY "Admins manage reviews"
  ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_visible ON public.reviews(product_id) WHERE is_visible = true;
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON public.reviews(created_at DESC);

CREATE TRIGGER reviews_updated BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────
-- Verified purchase — trusted server logic
-- Sets verified_purchase based on order_items existence for
-- a non-cancelled order belonging to the same user.
-- Runs on INSERT and when rating/text changes is not needed —
-- only authoritative; user cannot set it directly via RLS
-- but trigger overwrites anyway.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_verified_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified BOOLEAN := false;
  v_order_id UUID;
BEGIN
  -- Prefer explicit order_id if provided and belongs to user and contains product
  IF NEW.order_id IS NOT NULL THEN
    SELECT true INTO v_verified
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.id = NEW.order_id
      AND o.user_id = NEW.user_id
      AND oi.product_id = NEW.product_id
      AND o.status <> 'cancelled'
    LIMIT 1;
    IF v_verified THEN
      NEW.verified_purchase := true;
      NEW.order_id := NEW.order_id;
      RETURN NEW;
    END IF;
  END IF;

  -- Otherwise auto-detect any qualifying order
  SELECT o.id INTO v_order_id
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.user_id = NEW.user_id
    AND oi.product_id = NEW.product_id
    AND o.status <> 'cancelled'
  ORDER BY o.created_at DESC
  LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    NEW.verified_purchase := true;
    NEW.order_id := v_order_id;
  ELSE
    NEW.verified_purchase := false;
    -- keep provided order_id as-is if not verifiable? clear it
    IF NEW.order_id IS NOT NULL AND v_verified IS DISTINCT FROM true THEN
      NEW.order_id := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_verified_purchase ON public.reviews;
CREATE TRIGGER trg_set_verified_purchase
  BEFORE INSERT OR UPDATE OF product_id, user_id, order_id ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_verified_purchase();

-- Prevent direct verified_purchase manipulation via UPDATE: force re-evaluation
CREATE OR REPLACE FUNCTION public.prevent_verified_tamper()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If non-admin tries to change verified_purchase directly, revert to old
  IF NEW.verified_purchase IS DISTINCT FROM OLD.verified_purchase
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.verified_purchase := OLD.verified_purchase;
  END IF;
  -- Non-admin cannot toggle is_visible
  IF NEW.is_visible IS DISTINCT FROM OLD.is_visible
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_visible := OLD.is_visible;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_verified_tamper ON public.reviews;
CREATE TRIGGER trg_prevent_verified_tamper
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.prevent_verified_tamper();

-- ─────────────────────────────────────────────────────────
-- Keep products.rating / review_count in sync with visible reviews
-- Reuse existing seed values as fallback until first real review
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_avg NUMERIC;
  v_cnt INT;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);
  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(*)::int
    INTO v_avg, v_cnt
  FROM public.reviews
  WHERE product_id = v_product_id AND is_visible = true;

  UPDATE public.products
  SET rating = COALESCE(v_avg, rating),
      review_count = v_cnt,
      updated_at = now()
  WHERE id = v_product_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_rating_insert ON public.reviews;
CREATE TRIGGER trg_refresh_rating_insert AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_product_rating();
DROP TRIGGER IF EXISTS trg_refresh_rating_update ON public.reviews;
CREATE TRIGGER trg_refresh_rating_update AFTER UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_product_rating();
DROP TRIGGER IF EXISTS trg_refresh_rating_delete ON public.reviews;
CREATE TRIGGER trg_refresh_rating_delete AFTER DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_product_rating();

-- Backfill: compute ratings for any products that already have visible reviews (none yet, but safe)
-- Do not overwrite seed ratings where no reviews exist
