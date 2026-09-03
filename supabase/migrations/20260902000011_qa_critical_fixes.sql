-- =========================================================
-- 011 — QA Critical Fixes: order/stock, inventory, cart, RLS bypass
-- =========================================================

-- ─────────────────────────────────────────────────────────
-- 1. Fix product_variants stock CHECK (was missing, allowed negative)
-- ─────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='product_variants_stock_check') THEN
    ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_stock_check CHECK (stock >= 0);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- 2. Cart / Wishlist: enforce uniqueness for variant_id NULL via NULLS NOT DISTINCT (PG15+)
--    Existing UNIQUE (user_id, product_id, variant_id) treats NULL != NULL, so duplicates possible.
-- ─────────────────────────────────────────────────────────
DROP INDEX IF EXISTS cart_items_user_product_variant_key;
DROP INDEX IF EXISTS wishlist_items_user_product_variant_key;
-- Keep original UNIQUE constraint name for compatibility, replace with nulls not distinct
DO $$ BEGIN
  -- Cart
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cart_items_user_id_product_id_variant_id_key') THEN
    ALTER TABLE public.cart_items DROP CONSTRAINT cart_items_user_id_product_id_variant_id_key;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;
DROP INDEX IF EXISTS cart_items_user_id_product_id_variant_id_key;
DROP INDEX IF EXISTS uq_cart_user_product_variant;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_user_product_variant_nulls
  ON public.cart_items (user_id, product_id, variant_id) NULLS NOT DISTINCT;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wishlist_items_user_id_product_id_key') THEN
    ALTER TABLE public.wishlist_items DROP CONSTRAINT wishlist_items_user_id_product_id_key;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;
DROP INDEX IF EXISTS wishlist_items_user_id_product_id_key;
DROP INDEX IF EXISTS uq_wishlist_user_product_variant;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wishlist_user_product_variant_nulls
  ON public.wishlist_items (user_id, product_id, variant_id) NULLS NOT DISTINCT;

-- ─────────────────────────────────────────────────────────
-- 3. Fix create_order_with_stock_check: correct quantity vs stock shadowing, price math, atomic stock guard
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
    v_item RECORD; v_variant_id UUID; v_requested_qty INT; v_stock INT; v_unit_price NUMERIC(10,2); v_mrp NUMERIC(10,2);
    v_product_name TEXT; v_product_image TEXT; v_variant_label TEXT; v_product_id UUID;
    v_coupon TEXT; v_coupon_discount NUMERIC; v_coupon_err TEXT; v_coupon_id UUID;
    v_rows INT;
BEGIN
    v_coupon := NULLIF(upper(trim(p_coupon_code)), '');
    IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := NULLIF((v_item->>'variant_id')::text, '')::uuid;
        v_requested_qty := (v_item->>'quantity')::int;
        IF v_requested_qty IS NULL OR v_requested_qty < 1 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

        IF v_variant_id IS NOT NULL THEN
            SELECT pv.price, pv.mrp, pv.stock, pv.product_id, p.name, p.image_url,
                   COALESCE(pv.option1_value, '') || COALESCE(' - ' || pv.option2_value, '')
            INTO v_unit_price, v_mrp, v_stock, v_product_id, v_product_name, v_product_image, v_variant_label
            FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id
            WHERE pv.id = v_variant_id AND pv.is_active = true AND p.is_active = true FOR UPDATE OF pv;
            IF NOT FOUND THEN RAISE EXCEPTION 'Variant not found or inactive: %', v_variant_id; END IF;
            IF v_stock < v_requested_qty THEN RAISE EXCEPTION 'Insufficient stock for variant % (only % available)', v_variant_id, v_stock; END IF;
            IF v_unit_price IS NULL THEN RAISE EXCEPTION 'Variant price missing'; END IF;
        ELSE
            v_product_id := (v_item->>'product_id')::uuid;
            IF v_product_id IS NULL THEN RAISE EXCEPTION 'Product id missing'; END IF;
            SELECT p.price, p.mrp, p.stock, p.id, p.name, p.image_url
            INTO v_unit_price, v_mrp, v_stock, v_product_id, v_product_name, v_product_image
            FROM public.products p WHERE p.id = v_product_id AND p.is_active = true FOR UPDATE OF p;
            IF NOT FOUND THEN RAISE EXCEPTION 'Product not found or inactive: %', v_product_id; END IF;
            IF v_stock < v_requested_qty THEN RAISE EXCEPTION 'Insufficient stock for product % (only % available)', v_product_id, v_stock; END IF;
            v_variant_label := NULL;
        END IF;
        v_subtotal := v_subtotal + (v_unit_price * v_requested_qty);
    END LOOP;

    v_shipping := public.calculate_shipping(v_subtotal);

    IF v_coupon IS NOT NULL THEN
      SELECT discount, error, coupon_id INTO v_coupon_discount, v_coupon_err, v_coupon_id FROM public.validate_coupon(v_coupon, p_user_id, v_subtotal);
      IF v_coupon_err IS NOT NULL THEN RAISE EXCEPTION '%', v_coupon_err; END IF;
      v_discount := COALESCE(v_coupon_discount, 0);
      UPDATE public.coupons SET used_count = used_count + 1, updated_at = now() WHERE id = v_coupon_id AND (max_uses IS NULL OR used_count < max_uses);
      IF NOT FOUND THEN RAISE EXCEPTION 'Coupon just reached usage limit'; END IF;
    END IF;

    v_total := v_subtotal + v_shipping - v_discount;
    IF v_total < 0 THEN v_total := 0; END IF;

    INSERT INTO public.orders (user_id, subtotal, shipping, discount_amount, total, currency, shipping_address, shipping_address_snapshot, payment_method, payment_status, fulfillment_status, status, customer_email, coupon_code, notes)
    VALUES (p_user_id, v_subtotal, v_shipping, v_discount, v_total, 'INR', p_shipping_address, p_shipping_address, p_payment_method, 'pending'::public.payment_status, 'pending'::public.fulfillment_status, 'pending'::public.order_status, p_customer_email, v_coupon, NULL)
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := NULLIF((v_item->>'variant_id')::text, '')::uuid;
        v_requested_qty := (v_item->>'quantity')::int;
        IF v_variant_id IS NOT NULL THEN
            SELECT pv.price, pv.mrp, pv.product_id, p.name, p.image_url, COALESCE(pv.option1_value, '') || COALESCE(' - ' || pv.option2_value, '')
            INTO v_unit_price, v_mrp, v_product_id, v_product_name, v_product_image, v_variant_label
            FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id WHERE pv.id = v_variant_id;
            UPDATE public.product_variants SET stock = stock - v_requested_qty WHERE id = v_variant_id AND stock >= v_requested_qty;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            IF v_rows = 0 THEN RAISE EXCEPTION 'Concurrent stock update failed for variant %', v_variant_id; END IF;
        ELSE
            v_product_id := (v_item->>'product_id')::uuid;
            SELECT p.price, p.mrp, p.id, p.name, p.image_url INTO v_unit_price, v_mrp, v_product_id, v_product_name, v_product_image FROM public.products p WHERE p.id = v_product_id;
            v_variant_label := NULL;
            UPDATE public.products SET stock = stock - v_requested_qty WHERE id = v_product_id AND stock >= v_requested_qty;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            IF v_rows = 0 THEN RAISE EXCEPTION 'Concurrent stock update failed for product %', v_product_id; END IF;
        END IF;
        INSERT INTO public.order_items (order_id, product_id, variant_id, product_name, product_image, sku, quantity, unit_price, mrp, total)
        VALUES (v_order_id, v_product_id, v_variant_id, v_product_name, v_product_image, NULL, v_requested_qty, v_unit_price, v_mrp, v_unit_price * v_requested_qty);
    END LOOP;

    DELETE FROM public.cart_items WHERE user_id = p_user_id;
    RETURN v_order_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock_check(UUID, JSONB, JSONB, TEXT, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_order_with_stock_check(UUID, JSONB, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC;

-- ─────────────────────────────────────────────────────────
-- 4. Lock down direct order/payment forgery: revoke INSERT on orders/order_items/payments from authenticated
--    Checkout must go via RPC or Edge Function (service_role). Keep SELECT/UPDATE where needed.
-- ─────────────────────────────────────────────────────────
REVOKE INSERT ON public.orders FROM authenticated;
REVOKE INSERT ON public.order_items FROM authenticated;
REVOKE INSERT ON public.payments FROM authenticated;
REVOKE UPDATE ON public.payments FROM authenticated;
-- Keep SELECT for RLS-based reads, UPDATE for admin via RLS (already admin policy)
-- Ensure service_role retains ALL
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.payments TO authenticated;

-- Drop overly permissive policies that allowed direct INSERT
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
DROP POLICY IF EXISTS "Users insert own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users insert own payments" ON public.payments;

-- Replace with no-insert policies (explicit deny, RPC is SECURITY DEFINER so bypasses)
CREATE POLICY "No direct order insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct order_items insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct payments insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (false);

-- ─────────────────────────────────────────────────────────
-- 5. Fix public categories leak: only active categories visible to anon
-- ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read active categories" ON public.categories FOR SELECT TO anon, authenticated USING (is_active = true);

-- ─────────────────────────────────────────────────────────
-- 6. Harden prevent_verified_tamper trigger (add DEFINER + search_path)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_verified_tamper()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.verified_purchase IS DISTINCT FROM OLD.verified_purchase AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.verified_purchase := OLD.verified_purchase;
  END IF;
  IF NEW.is_visible IS DISTINCT FROM OLD.is_visible AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_visible := OLD.is_visible;
  END IF;
  RETURN NEW;
END; $$;
