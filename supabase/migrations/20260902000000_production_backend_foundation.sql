-- =========================================================
-- GULLYGADGET PRODUCTION BACKEND & DATABASE FOUNDATION
-- Comprehensive migration addressing all schema gaps, security, and performance
-- =========================================================

-- =========================================================
-- EXTENSIONS
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ENUMS
-- =========================================================
-- Payment status enum (separate from order status)
CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'authorized',
    'captured',
    'failed',
    'refunded',
    'cancelled'
);

-- Fulfillment status enum (separate from order status)
CREATE TYPE public.fulfillment_status AS ENUM (
    'pending',
    'processing',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'returned',
    'cancelled'
);

-- Provider enum for payments
CREATE TYPE public.payment_provider AS ENUM (
    'razorpay',
    'cod',
    'manual'
);

-- =========================================================
-- PROFILES - Add avatar_url and ensure updated_at trigger
-- =========================================================
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- =========================================================
-- CATEGORIES - Add is_active, description, updated_at
-- =========================================================
ALTER TABLE public.categories
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Update existing categories to be active
UPDATE public.categories SET is_active = true WHERE is_active IS NULL;

CREATE TRIGGER categories_updated BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for active categories
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(is_active) WHERE is_active;

-- =========================================================
-- PRODUCTS - Add missing fields and constraints
-- =========================================================
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS weight_grams INT,
    ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '{}'::jsonb;

-- Ensure mrp >= price constraint
ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS products_mrp_check;

ALTER TABLE public.products
    ADD CONSTRAINT products_mrp_check CHECK (mrp IS NULL OR mrp >= price);

-- Update existing products to be active
UPDATE public.products SET is_active = true WHERE is_active IS NULL;

-- Partial indexes for active products
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_products_active_category ON public.products(category_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- =========================================================
-- PRODUCT IMAGES - New table for normalized image storage
-- =========================================================
CREATE TABLE public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT ALL ON public.product_images TO service_role;

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product images"
    ON public.product_images FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage product images"
    ON public.product_images FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON public.product_images(product_id, is_primary) WHERE is_primary;

-- Migrate existing images from products.images jsonb to product_images table
DO $$
DECLARE
    prod RECORD;
    img RECORD;
    idx INT := 0;
BEGIN
    FOR prod IN SELECT id, images FROM public.products WHERE images IS NOT NULL AND jsonb_array_length(images) > 0 LOOP
        idx := 0;
        FOR img IN SELECT * FROM jsonb_array_elements(prod.images) WITH ORDINALITY AS elem(val, ord) LOOP
            INSERT INTO public.product_images (product_id, image_url, alt_text, sort_order, is_primary)
            VALUES (
                prod.id,
                img.val->>'url',
                COALESCE(img.val->>'alt', prod.name),
                (img.ord - 1)::int,
                (img.ord = 1)
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- =========================================================
-- PRODUCT VARIANTS - Add is_active, attributes JSONB, SKU uniqueness
-- =========================================================
ALTER TABLE public.product_variants
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';

-- Add unique constraint on SKU (where not null)
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variants_sku
    ON public.product_variants(sku)
    WHERE sku IS NOT NULL;

-- Update existing variants
UPDATE public.product_variants SET is_active = true WHERE is_active IS NULL;

-- Migrate option fields to attributes JSONB
UPDATE public.product_variants
SET attributes = jsonb_build_object(
    'option1', jsonb_build_object('name', option1_name, 'value', option1_value),
    'option2', jsonb_build_object('name', option2_name, 'value', option2_value),
    'option3', jsonb_build_object('name', option3_name, 'value', option3_value)
)
WHERE attributes = '{}'::jsonb OR attributes IS NULL;

-- Index for active variants
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON public.product_variants(product_id, is_active) WHERE is_active;

-- =========================================================
-- ADDRESSES - Add missing fields, updated_at trigger
-- =========================================================
ALTER TABLE public.addresses
    ADD COLUMN IF NOT EXISTS landmark TEXT,
    ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'India',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add unique partial index for default address per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_addresses_default_per_user
    ON public.addresses(user_id)
    WHERE is_default = true;

CREATE TRIGGER addresses_updated BEFORE UPDATE ON public.addresses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- CART ITEMS - Add variant support and price snapshot (for display only)
-- =========================================================
-- variant_id already exists from earlier migration
-- Ensure price is recalculated from product/variant at checkout time, not stored

-- =========================================================
-- ORDERS - Add missing fields, proper status separation
-- =========================================================
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS fulfillment_status public.fulfillment_status NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS coupon_code TEXT,
    ADD COLUMN IF NOT EXISTS shipping_address_snapshot JSONB;

-- Migrate existing data
UPDATE public.orders
SET
    shipping_address_snapshot = shipping_address,
    payment_status = CASE
        WHEN payment_method = 'cod' THEN 'pending'
        ELSE 'pending'
    END,
    fulfillment_status = CASE
        WHEN status IN ('shipped', 'delivered') THEN status::public.fulfillment_status
        ELSE 'pending'::public.fulfillment_status
    END
WHERE shipping_address_snapshot IS NULL;

-- Ensure order_number is properly populated (from earlier migration)
-- order_number should already exist with sequence

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- =========================================================
-- ORDER ITEMS - Ensure price snapshots are immutable
-- =========================================================
-- Already has product_name, price, variant_label - good
-- Add mrp snapshot
ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);

-- =========================================================
-- PAYMENTS - New table for payment tracking
-- =========================================================
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    provider public.payment_provider NOT NULL,
    provider_order_id TEXT,
    provider_payment_id TEXT,
    provider_signature TEXT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status public.payment_status NOT NULL DEFAULT 'pending',
    method TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users view own payments"
    ON public.payments FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = payments.order_id
            AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
        )
    );

-- Users can insert payments for their own orders (during checkout)
CREATE POLICY "Users insert own payments"
    ON public.payments FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = payments.order_id
            AND o.user_id = auth.uid()
        )
    );

-- Admins can manage all payments
CREATE POLICY "Admins manage payments"
    ON public.payments FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_order ON public.payments(provider_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- =========================================================
-- COUPONS - Add updated_at trigger
-- =========================================================
ALTER TABLE public.coupons
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER coupons_updated BEFORE UPDATE ON public.coupons
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SUPPLIERS - Ensure updated_at trigger
-- =========================================================
-- Already has trigger from earlier migration

-- =========================================================
-- SECURITY: FUNCTION GRANTS
-- =========================================================
-- Ensure functions are only executable by authenticated/service_role, not PUBLIC
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.assign_order_number() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_order_number() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.lookup_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_order(uuid, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.lookup_order(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_order(text, text) TO anon, authenticated;

-- =========================================================
-- DATABASE FUNCTIONS FOR ATOMIC OPERATIONS
-- =========================================================

-- Function: Validate and create order atomically with stock check
CREATE OR REPLACE FUNCTION public.create_order_with_stock_check(
    p_user_id UUID,
    p_items JSONB, -- [{product_id, variant_id, quantity}]
    p_shipping_address JSONB,
    p_payment_method TEXT DEFAULT 'cod',
    p_coupon_code TEXT DEFAULT NULL,
    p_customer_email TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_subtotal NUMERIC(10,2) := 0;
    v_shipping NUMERIC(10,2) := 0;
    v_discount NUMERIC(10,2) := 0;
    v_total NUMERIC(10,2);
    v_item RECORD;
    v_product RECORD;
    v_variant RECORD;
    v_variant_id UUID;
    v_quantity INT;
    v_unit_price NUMERIC(10,2);
    v_mrp NUMERIC(10,2);
    v_product_name TEXT;
    v_product_image TEXT;
    v_variant_label TEXT;
BEGIN
    -- Validate each item and calculate totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := (v_item->>'variant_id')::uuid;
        v_quantity := (v_item->>'quantity')::int;

        IF v_variant_id IS NOT NULL THEN
            -- Variant-based item
            SELECT pv.price, pv.mrp, pv.stock, pv.product_id, p.name, p.image_url,
                   COALESCE(pv.option1_value, '') || COALESCE(' - ' || pv.option2_value, '')
            INTO v_unit_price, v_mrp, v_quantity, v_product_id, v_product_name, v_product_image, v_variant_label
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            WHERE pv.id = v_variant_id AND pv.is_active = true AND p.is_active = true
            FOR UPDATE OF pv;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Variant not found or inactive: %', v_variant_id;
            END IF;

            IF v_quantity > (SELECT stock FROM public.product_variants WHERE id = v_variant_id) THEN
                RAISE EXCEPTION 'Insufficient stock for variant %', v_variant_id;
            END IF;
        ELSE
            -- Product-based item (no variant)
            SELECT p.price, p.mrp, p.stock, p.id, p.name, p.image_url
            INTO v_unit_price, v_mrp, v_quantity, v_product_id, v_product_name, v_product_image
            FROM public.products p
            WHERE p.id = (v_item->>'product_id')::uuid AND p.is_active = true
            FOR UPDATE OF p;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Product not found or inactive: %', (v_item->>'product_id');
            END IF;

            IF v_quantity > (SELECT stock FROM public.products WHERE id = (v_item->>'product_id')::uuid) THEN
                RAISE EXCEPTION 'Insufficient stock for product %', (v_item->>'product_id');
            END IF;
            v_variant_label := NULL;
        END IF;

        -- Calculate subtotal
        v_subtotal := v_subtotal + (v_unit_price * v_quantity);
    END LOOP;

    -- Calculate shipping
    v_shipping := CASE WHEN v_subtotal >= 499 THEN 0 ELSE 49 END;

    -- Apply coupon if provided
    IF p_coupon_code IS NOT NULL THEN
        -- Coupon validation logic here (simplified)
        -- In production, validate against coupons table
        IF p_coupon_code = 'WELCOME10' AND v_subtotal >= 299 THEN
            v_discount := ROUND(v_subtotal * 0.10, 2);
        ELSIF p_coupon_code = 'FLAT50' AND v_subtotal >= 499 THEN
            v_discount := 50;
        END IF;
    END IF;

    v_total := v_subtotal + v_shipping - v_discount;

    -- Create order
    INSERT INTO public.orders (
        user_id,
        subtotal,
        shipping,
        discount_amount,
        total,
        currency,
        shipping_address,
        shipping_address_snapshot,
        payment_method,
        payment_status,
        fulfillment_status,
        status,
        customer_email,
        coupon_code,
        notes
    ) VALUES (
        p_user_id,
        v_subtotal,
        v_shipping,
        v_discount,
        v_total,
        'INR',
        p_shipping_address,
        p_shipping_address,
        p_payment_method,
        CASE WHEN p_payment_method = 'cod' THEN 'pending'::public.payment_status ELSE 'pending'::public.payment_status END,
        'pending'::public.fulfillment_status,
        'pending'::public.order_status,
        p_customer_email,
        p_coupon_code,
        NULL
    )
    RETURNING id INTO v_order_id;

    -- Create order items and decrement stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := NULLIF((v_item->>'variant_id')::text, '')::uuid;
        v_quantity := (v_item->>'quantity')::int;

        IF v_variant_id IS NOT NULL THEN
            -- Variant-based
            SELECT pv.price, pv.mrp, pv.product_id, p.name, p.image_url,
                   COALESCE(pv.option1_value, '') || COALESCE(' - ' || pv.option2_value, '')
            INTO v_unit_price, v_mrp, v_product_id, v_product_name, v_product_image, v_variant_label
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            WHERE pv.id = v_variant_id;

            -- Decrement variant stock
            UPDATE public.product_variants
            SET stock = stock - v_quantity
            WHERE id = v_variant_id;
        ELSE
            -- Product-based
            SELECT p.price, p.mrp, p.id, p.name, p.image_url
            INTO v_unit_price, v_mrp, v_product_id, v_product_name, v_product_image
            FROM public.products p
            WHERE p.id = (v_item->>'product_id')::uuid;

            v_variant_label := NULL;

            -- Decrement product stock
            UPDATE public.products
            SET stock = stock - v_quantity
            WHERE id = (v_item->>'product_id')::uuid;
        END IF;

        INSERT INTO public.order_items (
            order_id,
            product_id,
            variant_id,
            product_name,
            product_image,
            sku,
            quantity,
            unit_price,
            mrp,
            total
        ) VALUES (
            v_order_id,
            v_product_id,
            v_variant_id,
            v_product_name,
            v_product_image,
            NULL, -- SKU would come from product/variant
            v_quantity,
            v_unit_price,
            v_mrp,
            v_unit_price * v_quantity
        );
    END LOOP;

    -- Clear user's cart
    DELETE FROM public.cart_items WHERE user_id = p_user_id;

    RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_stock_check(uuid, jsonb, jsonb, text, text, text) TO authenticated, service_role;

-- Function: Validate cart against current stock/prices
CREATE OR REPLACE FUNCTION public.validate_cart(p_user_id UUID)
RETURNS TABLE (
    product_id UUID,
    variant_id UUID,
    name TEXT,
    image_url TEXT,
    quantity INT,
    available_stock INT,
    unit_price NUMERIC(10,2),
    mrp NUMERIC(10,2),
    is_valid BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_stock INT;
    v_price NUMERIC(10,2);
    v_mrp NUMERIC(10,2);
    v_name TEXT;
    v_image TEXT;
    v_is_valid BOOLEAN;
    v_error TEXT;
BEGIN
    FOR v_item IN
        SELECT ci.product_id, ci.variant_id, ci.quantity
        FROM public.cart_items ci
        WHERE ci.user_id = p_user_id
    LOOP
        v_is_valid := true;
        v_error := NULL;

        IF v_item.variant_id IS NOT NULL THEN
            SELECT pv.stock, pv.price, pv.mrp, p.name, p.image_url
            INTO v_stock, v_price, v_mrp, v_name, v_image
            FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            WHERE pv.id = v_item.variant_id AND pv.is_active = true AND p.is_active = true;

            IF NOT FOUND THEN
                v_is_valid := false;
                v_error := 'Variant no longer available';
                v_stock := 0;
                v_price := 0;
                v_mrp := NULL;
                v_name := 'Unknown';
                v_image := NULL;
            ELSIF v_stock < v_item.quantity THEN
                v_is_valid := false;
                v_error := 'Insufficient stock (only ' || v_stock || ' available)';
            END IF;
        ELSE
            SELECT p.stock, p.price, p.mrp, p.name, p.image_url
            INTO v_stock, v_price, v_mrp, v_name, v_image
            FROM public.products p
            WHERE p.id = v_item.product_id AND p.is_active = true;

            IF NOT FOUND THEN
                v_is_valid := false;
                v_error := 'Product no longer available';
                v_stock := 0;
                v_price := 0;
                v_mrp := NULL;
                v_name := 'Unknown';
                v_image := NULL;
            ELSIF v_stock < v_item.quantity THEN
                v_is_valid := false;
                v_error := 'Insufficient stock (only ' || v_stock || ' available)';
            END IF;
        END IF;

        RETURN QUERY SELECT v_item.product_id, v_item.variant_id, v_name, v_image,
            v_item.quantity, v_stock, v_price, v_mrp, v_is_valid, v_error;
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_cart(uuid) TO authenticated, service_role;

-- Function: Decrement stock atomically (for non-order operations)
CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_product_id UUID, p_quantity INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.products
    SET stock = stock - p_quantity
    WHERE id = p_product_id
    AND stock >= p_quantity
    AND is_active = true;

    IF FOUND THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, int) TO service_role;

CREATE OR REPLACE FUNCTION public.decrement_variant_stock(p_variant_id UUID, p_quantity INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.product_variants
    SET stock = stock - p_quantity
    WHERE id = p_variant_id
    AND stock >= p_quantity
    AND is_active = true;

    IF FOUND THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_variant_stock(uuid, int) TO service_role;

-- =========================================================
-- STORAGE POLICIES FOR PRODUCT IMAGES
-- =========================================================
-- Note: Storage bucket creation must be done via Supabase Dashboard or CLI
-- This section documents the required policies

-- Bucket: product-images (public)
-- Policies:
-- 1. Public read access to product-images bucket
-- 2. Authenticated users (admins) can upload
-- 3. Authenticated users (admins) can update/delete their uploads

-- These policies need to be created in Supabase Dashboard > Storage > Policies
-- Example SQL for reference (run in Supabase SQL editor):

/*
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Public read for product-images
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Admin upload to product-images
CREATE POLICY "Admin upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
);

-- Admin update product images
CREATE POLICY "Admin update product images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
);

-- Admin delete product images
CREATE POLICY "Admin delete product images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
);
*/

-- =========================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- =========================================================
-- Addresses
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_postal_code ON public.addresses(postal_code);

-- Cart items
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items(product_id);

-- Wishlist
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON public.wishlist_items(user_id);

-- Order items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- Products search
CREATE INDEX IF NOT EXISTS idx_products_name_search ON public.products USING gin(to_tsvector('english', name));

-- =========================================================
-- ROW LEVEL SECURITY IMPROVEMENTS
-- =========================================================

-- Ensure all tables have RLS enabled (some may have been missed)
ALTER TABLE IF EXISTS public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

-- Verify products table RLS - ensure only active products are publicly visible
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read active products"
    ON public.products FOR SELECT TO anon, authenticated
    USING (is_active = true);

-- Verify product_variants table RLS - ensure only active variants are publicly visible
DROP POLICY IF EXISTS "Variants are publicly readable" ON public.product_variants;
CREATE POLICY "Public read active variants"
    ON public.product_variants FOR SELECT TO anon, authenticated
    USING (is_active = true);

-- Ensure coupons are only readable when active
DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;
CREATE POLICY "Anyone can read active coupons"
    ON public.coupons FOR SELECT TO anon, authenticated
    USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- =========================================================
-- SEED DATA FOR DEVELOPMENT (safe - won't overwrite existing)
-- =========================================================
-- Additional categories
INSERT INTO public.categories (name, slug, description, sort_order, is_active) VALUES
    ('Home Comfort', 'home-comfort', 'Cozy essentials for your living space', 5, true),
    ('Cleaning', 'cleaning', 'Smart cleaning gadgets for effortless maintenance', 6, true)
ON CONFLICT (slug) DO NOTHING;

-- Ensure demo supplier exists
INSERT INTO public.suppliers (name, platform, notes, is_active)
VALUES ('In-House (Manual)', 'manual', 'Default supplier for self-fulfilled orders', true)
ON CONFLICT DO NOTHING;

-- =========================================================
-- CLEANUP: Remove any test/dummy data that shouldn't be in production
-- =========================================================
-- This migration doesn't delete existing data - only adds/improves

-- =========================================================
-- COMMENTS FOR DOCUMENTATION
-- =========================================================
COMMENT ON TABLE public.products IS 'Core product catalog with pricing, inventory, and metadata';
COMMENT ON TABLE public.product_variants IS 'Product variants with independent pricing and stock';
COMMENT ON TABLE public.product_images IS 'Normalized product image storage with ordering and primary flag';
COMMENT ON TABLE public.orders IS 'Customer orders with separate payment and fulfillment status';
COMMENT ON TABLE public.order_items IS 'Order line items with price snapshots at purchase time';
COMMENT ON TABLE public.payments IS 'Payment records supporting multiple providers (razorpay, cod, manual)';
COMMENT ON TABLE public.coupons IS 'Discount codes with usage tracking';
COMMENT ON TABLE public.addresses IS 'Customer shipping addresses with Indian address support';

COMMENT ON COLUMN public.orders.order_number IS 'Human-friendly order number: ORD-YYYY-NNNNNN';
COMMENT ON COLUMN public.orders.payment_status IS 'Payment lifecycle: pending/authorized/captured/failed/refunded/cancelled';
COMMENT ON COLUMN public.orders.fulfillment_status IS 'Fulfillment lifecycle: pending/processing/packed/shipped/out_for_delivery/delivered/returned/cancelled';
COMMENT ON COLUMN public.orders.status IS 'Legacy order status - use payment_status and fulfillment_status instead';
COMMENT ON COLUMN public.products.mrp IS 'Maximum Retail Price (Indian pricing standard)';
COMMENT ON COLUMN public.products.sku IS 'Stock Keeping Unit - unique per product';

-- =========================================================
-- END OF MIGRATION
-- =========================================================