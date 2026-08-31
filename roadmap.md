# Roadmap

## Now
- [ ] Redesign storefront visual direction (user dislikes current design) — pick palette/type/layout, then apply
- [ ] Audit DB tables (products, categories, product_variants, customers, addresses, orders, order_items, payments)

## Production e-commerce (requested)
- [ ] Admin product CRUD: multi-image upload, enable/disable, SKU, stock, discount %, category, variants, shipping info, featured
- [ ] Cart persistence + totals (subtotal, discount, shipping, total)
- [ ] Checkout: customer details, address, shipping, payment, confirmation
- [ ] Razorpay: server order create, signature verify, webhook, payments table
- [ ] COD flow with payment_status/order_status transitions
- [ ] Order numbers (ORD-YYYY-NNNNNN), historical price snapshot in order_items
- [ ] Admin order management: search, filter, details, status updates
- [ ] Security: admin-only via user_roles, RLS on all tables
- [ ] PDP: gallery, qty selector, Buy Now, shipping info
- [ ] Mobile-first polish + loading/error states
