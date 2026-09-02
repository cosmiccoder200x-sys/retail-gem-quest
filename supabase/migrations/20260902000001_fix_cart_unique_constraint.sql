-- =========================================================
-- FIX: Cart items unique constraint should include variant_id
-- =========================================================

-- Drop old unique constraint
ALTER TABLE public.cart_items
    DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;

-- Add new unique constraint including variant_id
ALTER TABLE public.cart_items
    ADD CONSTRAINT cart_items_user_product_variant_unique
    UNIQUE (user_id, product_id, variant_id);

-- =========================================================
-- FIX: Wishlist unique constraint should include variant_id
-- =========================================================
ALTER TABLE public.wishlist_items
    DROP CONSTRAINT IF EXISTS wishlist_items_user_id_product_id_key;

ALTER TABLE public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_product_variant_unique
    UNIQUE (user_id, product_id, variant_id);

-- =========================================================
-- ADD: Wishlist updated_at column
-- =========================================================
ALTER TABLE public.wishlist_items
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER wishlist_updated BEFORE UPDATE ON public.wishlist_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();