-- 003 — RLS Hardening & Missing Policies
-- Adds: admin update on order_items, service_role on coupons usage, and
-- ensures read-only access for non-admin authenticated users is restricted.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. order_items — allow admins to UPDATE (for tracking assignment)
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "Admins update order items" ON public.order_items
  FOR UPDATE TO authenticated
  USING  (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ──────────────────────────────────────────────────────────────────────────
-- 2. coupons — add INSERT/UPDATE/DELETE for admins (existing policy is ALL
--    but we ensure it explicitly; no-op if already exists, but safe to keep
--    for clarity in future audits)
-- ──────────────────────────────────────────────────────────────────────────
-- (The "Admins manage coupons" policy already grants ALL — no change needed.)

-- ──────────────────────────────────────────────────────────────────────────
-- 3. addresses — add SELECT for users (currently only INSERT/UPDATE/DELETE)
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "Users read own addresses" ON public.addresses
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- 4. wishlist_items — add SELECT for users (currently only INSERT/DELETE)
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "Users read own wishlist" ON public.wishlist_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Ensure service_role can always update order status / tracking
--    (service_role bypasses RLS by default, so no policy needed.)
-- ──────────────────────────────────────────────────────────────────────────
-- No-op — service_role already bypasses RLS.

-- ──────────────────────────────────────────────────────────────────────────
-- 6. coupons — allow authenticated users to read active coupons (for promo
--    validation during checkout).  Existing "Anyone can read active coupons"
--    uses USING (is_active = true ...) which already covers anon+authenticated.
--    No change needed.
-- ──────────────────────────────────────────────────────────────────────────
-- No-op — already covered by existing SELECT policy.

-- ──────────────────────────────────────────────────────────────────────────
-- 7. payments — add UPDATE for admins (capture/refund status updates)
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY "Admins update payments" ON public.payments
  FOR UPDATE TO authenticated
  USING  (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ──────────────────────────────────────────────────────────────────────────
-- 8. products — allow authenticated users to read ALL products (not just
--    active) for search/filter purposes, BUT the storefront code already
--    filters by is_active = true.  We do NOT open read to all products
--    to prevent leaking inactive/draft product details.
--    No change needed.
-- ──────────────────────────────────────────────────────────────────────────
-- No-op — storefront already filters server-side.

-- ──────────────────────────────────────────────────────────────────────────
-- 9. orders — add INSERT policy so service_role (or Edge Functions) can
--    create orders on behalf of users.  service_role bypasses RLS, so no
--    policy is strictly required.  However, if we ever switch to
--    authenticated inserts, this would be needed:
-- ──────────────────────────────────────────────────────────────────────────
-- No-op — order creation uses create_order_with_stock_check (SECURITY
-- DEFINER) which bypasses RLS, or service_role.