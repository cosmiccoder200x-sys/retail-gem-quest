-- =========================================================
-- 008 — Coupons + Shipping (Production)
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- Coupons: extend to spec
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS maximum_discount NUMERIC(10,2);
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS per_user_limit INT;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill updated_at where null (already has trigger but ensure column)
UPDATE public.coupons SET updated_at = now() WHERE updated_at IS NULL;

-- Normalize codes: upper, no spaces
CREATE OR REPLACE FUNCTION public.normalize_coupon_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.code := upper(trim(NEW.code));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_coupon_normalize ON public.coupons;
CREATE TRIGGER trg_coupon_normalize BEFORE INSERT OR UPDATE OF code ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.normalize_coupon_code();

-- Existing codes to upper
UPDATE public.coupons SET code = upper(trim(code)) WHERE code <> upper(trim(code));

-- Ensure max_uses / per_user_limit positive where set
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='coupons_max_uses_check') THEN
    ALTER TABLE public.coupons ADD CONSTRAINT coupons_max_uses_check CHECK (max_uses IS NULL OR max_uses > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='coupons_per_user_check') THEN
    ALTER TABLE public.coupons ADD CONSTRAINT coupons_per_user_check CHECK (per_user_limit IS NULL OR per_user_limit > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active) WHERE is_active;

-- ─────────────────────────────────────────────────────────
-- Shipping config (single active row; values configurable)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shipping_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_shipping_charge NUMERIC(10,2) NOT NULL DEFAULT 79 CHECK (base_shipping_charge >= 0),
  free_shipping_threshold NUMERIC(10,2) NOT NULL DEFAULT 999 CHECK (free_shipping_threshold >= 0),
  cod_min_order_value NUMERIC(10,2) DEFAULT 0 CHECK (cod_min_order_value >= 0),
  pincode_restrictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read shipping config" ON public.shipping_config;
CREATE POLICY "Public read shipping config" ON public.shipping_config FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage shipping config" ON public.shipping_config;
CREATE POLICY "Admins manage shipping config" ON public.shipping_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.shipping_config TO anon, authenticated;
GRANT ALL ON public.shipping_config TO service_role;

CREATE TRIGGER shipping_config_updated BEFORE UPDATE ON public.shipping_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.shipping_config (base_shipping_charge, free_shipping_threshold, is_active)
SELECT 79, 999, true
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_config WHERE is_active = true);

-- ─────────────────────────────────────────────────────────
-- Helper: calculate shipping (server-side, reads active config)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_shipping(p_subtotal NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_base NUMERIC; v_threshold NUMERIC;
BEGIN
  SELECT base_shipping_charge, free_shipping_threshold INTO v_base, v_threshold
  FROM public.shipping_config WHERE is_active = true ORDER BY updated_at DESC LIMIT 1;
  IF v_base IS NULL THEN v_base := 79; v_threshold := 999; END IF;
  IF p_subtotal IS NULL OR p_subtotal = 0 THEN RETURN 0; END IF;
  IF p_subtotal >= v_threshold THEN RETURN 0; END IF;
  RETURN v_base;
END; $$;
GRANT EXECUTE ON FUNCTION public.calculate_shipping(NUMERIC) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────
-- Validate coupon (preview, no side effects) — server authoritative
-- Returns discount + error if invalid
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_user_id UUID, p_subtotal NUMERIC)
RETURNS TABLE (discount NUMERIC, error TEXT, coupon_id UUID, coupon_code TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_coupon RECORD; v_discount NUMERIC := 0; v_err TEXT := NULL; v_user_count INT := 0;
BEGIN
  IF p_code IS NULL OR trim(p_code) = '' THEN RETURN QUERY SELECT 0::NUMERIC, 'No coupon'::TEXT, NULL::UUID, NULL::TEXT; RETURN; END IF;
  SELECT * INTO v_coupon FROM public.coupons WHERE code = upper(trim(p_code)) LIMIT 1;
  IF NOT FOUND THEN RETURN QUERY SELECT 0::NUMERIC, 'Invalid coupon'::TEXT, NULL::UUID, upper(trim(p_code))::TEXT; RETURN; END IF;
  IF NOT v_coupon.is_active THEN RETURN QUERY SELECT 0::NUMERIC, 'Coupon disabled'::TEXT, v_coupon.id, v_coupon.code; RETURN; END IF;
  IF v_coupon.starts_at IS NOT NULL AND now() < v_coupon.starts_at THEN RETURN QUERY SELECT 0::NUMERIC, 'Coupon not yet active'::TEXT, v_coupon.id, v_coupon.code; RETURN; END IF;
  IF v_coupon.expires_at IS NOT NULL AND now() > v_coupon.expires_at THEN RETURN QUERY SELECT 0::NUMERIC, 'Coupon expired'::TEXT, v_coupon.id, v_coupon.code; RETURN; END IF;
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN RETURN QUERY SELECT 0::NUMERIC, 'Coupon usage limit reached'::TEXT, v_coupon.id, v_coupon.code; RETURN; END IF;
  IF p_user_id IS NOT NULL AND v_coupon.per_user_limit IS NOT NULL THEN
    SELECT COUNT(*)::int INTO v_user_count FROM public.orders WHERE coupon_code = v_coupon.code AND user_id = p_user_id AND status <> 'cancelled';
    IF v_user_count >= v_coupon.per_user_limit THEN RETURN QUERY SELECT 0::NUMERIC, 'You have already used this coupon'::TEXT, v_coupon.id, v_coupon.code; RETURN; END IF;
  END IF;
  IF v_coupon.min_order_total IS NOT NULL AND COALESCE(p_subtotal,0) < v_coupon.min_order_total THEN RETURN QUERY SELECT 0::NUMERIC, format('Minimum order %s required', v_coupon.min_order_total)::TEXT, v_coupon.id, v_coupon.code; RETURN; END IF;
  -- Calculate discount
  IF v_coupon.discount_type = 'percent' THEN
    v_discount := round(COALESCE(p_subtotal,0) * v_coupon.discount_value / 100, 2);
    IF v_coupon.maximum_discount IS NOT NULL AND v_discount > v_coupon.maximum_discount THEN v_discount := v_coupon.maximum_discount; END IF;
  ELSE
    v_discount := LEAST(v_coupon.discount_value, COALESCE(p_subtotal,0));
  END IF;
  IF v_discount < 0 THEN v_discount := 0; END IF;
  RETURN QUERY SELECT v_discount, NULL::TEXT, v_coupon.id, v_coupon.code;
END; $$;
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, UUID, NUMERIC) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────
-- Patch create_order_with_stock_check to use real coupon + shipping_config
-- Replaces hardcoded WELCOME10/FLAT50 with coupons table lookup
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_order_with_stock_check(
    p_user_id UUID,
    p_items JSONB,
    p_shipping_address JSONB,
    p_payment_method TEXT DEFAULT 'cod',
    p_coupon_code TEXT DEFAULT NULL,
    p_customer_email TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_order_id UUID; v_subtotal NUMERIC(10,2) := 0; v_shipping NUMERIC(10,2) := 0; v_discount NUMERIC(10,2) := 0; v_total NUMERIC(10,2);
    v_item RECORD; v_variant_id UUID; v_quantity INT; v_unit_price NUMERIC(10,2); v_mrp NUMERIC(10,2);
    v_product_name TEXT; v_product_image TEXT; v_variant_label TEXT; v_product_id UUID;
    v_coupon TEXT; v_coupon_discount NUMERIC; v_coupon_err TEXT; v_coupon_id UUID;
BEGIN
    v_coupon := NULLIF(upper(trim(p_coupon_code)), '');
    -- Validate items and calc subtotal (same as before, stock checks)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := (v_item->>'variant_id')::uuid;
        v_quantity := (v_item->>'quantity')::int;
        IF v_variant_id IS NOT NULL THEN
            SELECT pv.price, pv.mrp, pv.stock, pv.product_id, p.name, p.image_url,
                   COALESCE(pv.option1_value, '') || COALESCE(' - ' || pv.option2_value, '')
            INTO v_unit_price, v_mrp, v_quantity, v_product_id, v_product_name, v_product_image, v_variant_label
            FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id
            WHERE pv.id = v_variant_id AND pv.is_active = true AND p.is_active = true FOR UPDATE OF pv;
            IF NOT FOUND THEN RAISE EXCEPTION 'Variant not found or inactive: %', v_variant_id; END IF;
            IF v_quantity > (SELECT stock FROM public.product_variants WHERE id = v_variant_id) THEN RAISE EXCEPTION 'Insufficient stock for variant %', v_variant_id; END IF;
        ELSE
            SELECT p.price, p.mrp, p.stock, p.id, p.name, p.image_url
            INTO v_unit_price, v_mrp, v_quantity, v_product_id, v_product_name, v_product_image
            FROM public.products p WHERE p.id = (v_item->>'product_id')::uuid AND p.is_active = true FOR UPDATE OF p;
            IF NOT FOUND THEN RAISE EXCEPTION 'Product not found or inactive: %', (v_item->>'product_id'); END IF;
            IF v_quantity > (SELECT stock FROM public.products WHERE id = (v_item->>'product_id')::uuid) THEN RAISE EXCEPTION 'Insufficient stock for product %', (v_item->>'product_id'); END IF;
            v_variant_label := NULL;
        END IF;
        v_subtotal := v_subtotal + (v_unit_price * v_quantity);
    END LOOP;

    v_shipping := public.calculate_shipping(v_subtotal);

    -- Real coupon validation
    IF v_coupon IS NOT NULL THEN
      SELECT discount, error, coupon_id INTO v_coupon_discount, v_coupon_err, v_coupon_id FROM public.validate_coupon(v_coupon, p_user_id, v_subtotal);
      IF v_coupon_err IS NOT NULL THEN RAISE EXCEPTION '%', v_coupon_err; END IF;
      v_discount := COALESCE(v_coupon_discount, 0);
      -- Atomically bump used_count
      UPDATE public.coupons SET used_count = used_count + 1, updated_at = now() WHERE id = v_coupon_id;
    END IF;

    v_total := v_subtotal + v_shipping - v_discount;
    IF v_total < 0 THEN v_total := 0; END IF;

    INSERT INTO public.orders (user_id, subtotal, shipping, discount_amount, total, currency, shipping_address, shipping_address_snapshot, payment_method, payment_status, fulfillment_status, status, customer_email, coupon_code, notes)
    VALUES (p_user_id, v_subtotal, v_shipping, v_discount, v_total, 'INR', p_shipping_address, p_shipping_address, p_payment_method, 'pending'::public.payment_status, 'pending'::public.fulfillment_status, 'pending'::public.order_status, p_customer_email, v_coupon, NULL)
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := NULLIF((v_item->>'variant_id')::text, '')::uuid;
        v_quantity := (v_item->>'quantity')::int;
        IF v_variant_id IS NOT NULL THEN
            SELECT pv.price, pv.mrp, pv.product_id, p.name, p.image_url, COALESCE(pv.option1_value, '') || COALESCE(' - ' || pv.option2_value, '')
            INTO v_unit_price, v_mrp, v_product_id, v_product_name, v_product_image, v_variant_label
            FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id WHERE pv.id = v_variant_id;
            UPDATE public.product_variants SET stock = stock - v_quantity WHERE id = v_variant_id;
        ELSE
            SELECT p.price, p.mrp, p.id, p.name, p.image_url INTO v_unit_price, v_mrp, v_product_id, v_product_name, v_product_image FROM public.products p WHERE p.id = (v_item->>'product_id')::uuid;
            v_variant_label := NULL;
            UPDATE public.products SET stock = stock - v_quantity WHERE id = (v_item->>'product_id')::uuid;
        END IF;
        INSERT INTO public.order_items (order_id, product_id, variant_id, product_name, product_image, sku, quantity, unit_price, mrp, total)
        VALUES (v_order_id, v_product_id, v_variant_id, v_product_name, v_product_image, NULL, v_quantity, v_unit_price, v_mrp, v_unit_price * v_quantity);
    END LOOP;

    DELETE FROM public.cart_items WHERE user_id = p_user_id;
    RETURN v_order_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_check(UUID, JSONB, JSONB, TEXT, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_order_with_stock_check(UUID, JSONB, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC;

-- Seed example coupons (idempotent)
INSERT INTO public.coupons (code, description, discount_type, discount_value, maximum_discount, min_order_total, max_uses, per_user_limit, is_active, starts_at, expires_at)
VALUES
  ('WELCOME10', '10% off for new customers (max ₹500)', 'percent', 10, 500, 299, 1000, 1, true, now() - interval '1 day', now() + interval '60 days'),
  ('SAVE200', 'Flat ₹200 off', 'flat', 200, NULL, 999, 500, 2, true, now() - interval '1 day', now() + interval '30 days')
ON CONFLICT (code) DO NOTHING;
