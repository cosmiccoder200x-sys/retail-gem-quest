# Project Roadmap & Implementation Truth

Last Updated: Phase 39 Audit

## 1. Authentication & Profiles
- [x] Email / Password signup and signin via Supabase Auth
- [x] Google OAuth flow integrated (`signInWithOAuth`)
- [x] Role-based access control (`user_roles` table with `admin` / `customer` roles and `has_role` RPC)
- [x] Protected routes with `_authenticated` layout routing and login redirects
- [x] Profile management (name, phone, avatar) with auto-creation on signup
- [x] Address book management (CRUD with default address toggle and pincode)

## 2. Catalog & Discovery
- [x] Products table with full metadata (SKU, pricing, MRP, stock, weight, badges, specs)
- [x] Categories with hierarchical slug-based routing and active filtering
- [x] Multi-variant support (`product_variants` with option names/values, pricing overrides, SKU)
- [x] Multi-image gallery per product (`product_images` with primary image & sort order)
- [x] Full-text product search, category filtering, price range sorting, in-stock filters
- [x] Product reviews & star ratings (`product_reviews` with verified purchase checks)
- [x] Recently viewed products local persistence

## 3. Cart & Wishlist
- [x] Database-backed persistent cart for authenticated users (`cart_items`)
- [x] Variant-level cart selections and quantity modification
- [x] Stock validation RPC (`validate_cart`) before checkout
- [x] User wishlist functionality (`wishlist_items`) with quick add/remove

## 4. Checkout & Pricing Pipeline
- [x] Multi-step checkout (Shipping address selection, Coupon code application, Payment method)
- [x] Dynamic coupon code engine with database validation RPC (`validate_coupon`)
- [x] Shipping charge calculation with configurable thresholds (`calculate_shipping` & `shipping_config`)
- [x] Atomic order creation via PostgreSQL function (`create_order_with_stock_check`)
- [x] Real-time inventory decrementing with concurrency safeguards

## 5. Payments & Orders
- [x] Cash on Delivery (COD) order placement flow
- [x] Razorpay Checkout SDK frontend integration
- [x] Razorpay Order creation Edge Function (`create-razorpay-order`)
- [x] Razorpay Payment verification Edge Function (`verify-razorpay-payment`)
- [x] Razorpay Webhook listener Edge Function (`razorpay-webhook`)
- [x] Transaction records in `payments` table
- [x] Order history and order detail views on Customer Account page
- [x] Public order tracking page (`/track`) via secure lookup RPC (`lookup_order`)
- [x] Order status audit history (`order_status_history`)

## 6. Admin Backoffice
- [x] Admin dashboard with revenue, order count, and customer metrics (`AdminAnalytics`)
- [x] Admin product management (Add/Edit products, images, variants, stock, active status)
- [x] Admin order management (Filter by status, update fulfillment/payment status, tracking info)
- [x] Admin inventory tracking and low-stock indicators (`AdminInventory`)
- [x] Customer directory and order history lookup (`AdminCustomers`)

## 7. Platform, Security & Deployment
- [x] Row Level Security (RLS) policies on all tables
- [x] Secure environment variable handling (Public anon key on client, Service Role key restricted to Edge Functions)
- [x] Production build passes clean with Vite & TanStack Router
- [x] Edge Functions configured with production CORS allowlist for Vercel
- [x] Production Vercel environment variables documented and verified
