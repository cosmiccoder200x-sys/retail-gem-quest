// FAQ content — easy to edit; categories map to filter chips on /faq
export type FaqItem = { q: string; a: string; category: string };

export const faqItems: FaqItem[] = [
  { category: "Orders", q: "How do I place an order?", a: "Browse products, choose a variant if needed, add to cart, go to checkout, enter your shipping address, choose COD or online payment, and confirm. You'll receive an order number and confirmation." },
  { category: "Payments", q: "What payment methods are available?", a: "We support Cash on Delivery (COD) and online payment via Razorpay (UPI, cards, net banking). The final amount is always calculated securely on the server." },
  { category: "Payments", q: "Is COD available?", a: "Yes. Select Cash on Delivery at checkout and pay when the order arrives. COD may have a minimum order value shown at checkout." },
  { category: "Shipping", q: "How long does shipping take?", a: "Orders are typically dispatched within 48 hours. Delivery time depends on your location and courier. See Shipping Policy for the current free-shipping threshold." },
  { category: "Shipping", q: "How do I track my order?", a: "Go to Track Order and enter your order ID/number and email. You'll see fulfillment and forwarding status, carrier, and a tracking link when available." },
  { category: "Returns", q: "What is the return policy?", a: "We offer a 7-day return for unused products in original packaging where applicable. Some categories may be non-returnable for hygiene reasons. See Return & Refund Policy for details." },
  { category: "Returns", q: "How do refunds work?", a: "For online payments, refunds are issued to the original payment method after we receive and inspect the return. COD orders have no online refund; replacement or credit may apply per policy." },
  { category: "Support", q: "How do I contact support?", a: "Use the Contact Us page form or email support@gullygadget.com. Include your order number for faster help. See Contact page for editable business details." },
  { category: "Orders", q: "Can I change or cancel my order?", a: "Orders can be updated only before they are forwarded to the supplier. Contact support quickly with your order number; once shipped, changes are not possible." },
  { category: "Payments", q: "Do you store my payment information?", a: "No. Online payments are processed by Razorpay; we do not store card or UPI details. See Privacy Policy." },
];

export const faqCategories = ["All", ...Array.from(new Set(faqItems.map((f) => f.category)))];
