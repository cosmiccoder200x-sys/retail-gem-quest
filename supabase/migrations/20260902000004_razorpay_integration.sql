-- =========================================================
-- 004 — Razorpay Integration + RLS Hardening + Orders Enhancement
-- =========================================================

-- =========================================================
-- 1. Ensure order_number sequence exists
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'order_number_seq') THEN
    CREATE SEQUENCE public.order_number_seq START 1001;
  END IF;
END $$;

-- Ensure order_number gets auto-populated on insert
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_order_number ON public.orders;
CREATE TRIGGER trg_assign_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

-- =========================================================
-- 2. Add idx_payments_unique_order to prevent duplicate payments
-- =========================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_razorpay_order
  ON public.payments(provider_order_id)
  WHERE provider_order_id IS NOT NULL;

-- =========================================================
-- 3. RLS Hardening — payments UPDATE only via service_role/Edge Functions
-- =========================================================
-- Remove authenticated UPDATE on payments (only Edge Functions using service_role should update)
DROP POLICY IF EXISTS "Users update own payments" ON public.payments;

-- Add explicit service_role-only update policy for payments
-- (service_role already bypasses RLS, but this is documentation)

-- =========================================================
-- 4. RLS Hardening — prevent customers from updating order totals
-- =========================================================
-- The existing "Users create own orders" INSERT policy is fine.
-- The existing "Admins update orders" UPDATE policy is fine.
-- But ensure no non-admin authenticated user can update orders directly.
-- The current setup already handles this: authenticated users can INSERT
-- but only admins can UPDATE. No changes needed.

-- =========================================================
-- 5. Add payment_status / fulfillment_status to orders (ensure they exist)
-- =========================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS order_number TEXT;

-- =========================================================
-- 6. Add mrp + total to order_items (ensure they exist)
-- =========================================================
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS total NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);

-- =========================================================
-- 7. Create payments table if not exists (from migration 000, but safe to re-run)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_order_id TEXT,
    provider_payment_id TEXT,
    provider_signature TEXT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'pending',
    method TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure RLS is enabled
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 8. Idempotent payment insert — prevent duplicate Razorpay orders
-- =========================================================
-- Add a partial unique index on (order_id, provider) where status = 'pending'
-- This prevents creating multiple pending Razorpay orders for the same order
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_pending_per_order
  ON public.payments(order_id, provider)
  WHERE status = 'pending';

-- =========================================================
-- 9. Indexes for performance
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_order_status ON public.payments(order_id, status);

-- =========================================================
-- 10. Ensure Edge Functions can update payments and orders
-- =========================================================
-- Edge Functions use service_role which bypasses RLS.
-- No additional policies needed for service_role.
-- But we need to ensure the authenticated user policies don't block
-- Edge Function operations. Since Edge Functions use service_role,
-- they bypass all RLS policies.

-- =========================================================
-- 11. Comments for documentation
-- =========================================================
COMMENT ON COLUMN public.orders.payment_status IS 'Payment lifecycle: pending/processing/paid/failed/refunded';
COMMENT ON COLUMN public.orders.fulfillment_status IS 'Fulfillment lifecycle: pending/processing/packed/shipped/delivered';
COMMENT ON COLUMN public.payments.provider IS 'Payment provider: razorpay/cod/manual';
COMMENT ON COLUMN public.payments.provider_order_id IS 'Razorpay order_id (for Razorpay payments)';
COMMENT ON COLUMN public.payments.provider_payment_id IS 'Razorpay payment_id (for Razorpay payments)';
COMMENT ON COLUMN public.payments.provider_signature IS 'Razorpay signature for verification';
COMMENT ON COLUMN public.payments.status IS 'Payment status: pending/processing/paid/failed/refunded';
COMMENT ON COLUMN public.payments.metadata IS 'JSON metadata (webhook events, Razorpay details, etc.)';

-- =========================================================
-- END OF MIGRATION
-- =========================================================
