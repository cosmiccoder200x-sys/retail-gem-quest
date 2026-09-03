import { createFileRoute, Link } from "@tanstack/react-router";
import { siteConfig } from "@/lib/site";

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title: `Shipping Policy | ${siteConfig.name}` },
      { name: "description", content: `Shipping policy for ${siteConfig.name} — free shipping thresholds, dispatch, and tracking.` },
      { property: "og:title", content: `Shipping Policy | ${siteConfig.name}` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${siteConfig.url}/shipping` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/shipping" }],
  }),
  component: ShippingPage,
});

function ShippingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl uppercase">Shipping Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Configurable — threshold and charge are set in Admin → Shipping. Current store values should be read there.</p>
      <div className="mt-8 space-y-6 leading-relaxed">
        <h2 className="font-display text-xl uppercase">Coverage</h2>
        <p className="text-muted-foreground">We ship across India. Cash on Delivery is available where the checkout offers it; some pincodes may be prepaid-only.</p>
        <h2 className="font-display text-xl uppercase">Charges</h2>
        <p className="text-muted-foreground">Free shipping is granted when your subtotal meets the threshold shown at checkout and in Admin. Otherwise the base charge applies. Exact amounts are calculated on the server.</p>
        <h2 className="font-display text-xl uppercase">Dispatch</h2>
        <p className="text-muted-foreground">Orders are typically dispatched within 48 hours of confirmation/payment. You will see forwarding and tracking status on <Link to="/track" className="text-brand hover:underline">Track Order</Link>.</p>
        <h2 className="font-display text-xl uppercase">Tracking</h2>
        <p className="text-muted-foreground">When a carrier and tracking number are assigned, they appear on your order confirmation and on the tracking page. Contact us if tracking does not update in a reasonable time.</p>
        <div className="rounded-2xl bg-brand-soft p-4 ring-1 ring-border">
          <p className="text-sm font-medium">Editable</p>
          <p className="text-sm text-muted-foreground">Thresholds and fees are not hardcoded in text — edit the live values in the app config and update this page only if your operational policy changes.</p>
        </div>
      </div>
    </div>
  );
}
