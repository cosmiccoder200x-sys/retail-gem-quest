import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: `Terms & Conditions | ${siteConfig.name}` },
      { name: "description", content: `Terms and Conditions for shopping at ${siteConfig.name}.` },
      { property: "og:title", content: `Terms & Conditions | ${siteConfig.name}` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${siteConfig.url}/terms` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl uppercase">Terms & Conditions</h1>
      <p className="mt-2 text-sm text-muted-foreground">Template — have counsel review. Update for your jurisdiction.</p>
      <div className="mt-8 space-y-6 leading-relaxed text-sm">
        <h2 className="font-display text-lg uppercase">Acceptance</h2>
        <p className="text-muted-foreground">By using {siteConfig.name} you agree to these terms and our Privacy, Shipping, and Return policies.</p>
        <h2 className="font-display text-lg uppercase">Products & pricing</h2>
        <p className="text-muted-foreground">Product information, prices, and availability may change before order confirmation. Final amounts are calculated on the server at checkout.</p>
        <h2 className="font-display text-lg uppercase">Orders</h2>
        <p className="text-muted-foreground">We may refuse or cancel orders for reasons including stock, pricing errors, or risk review. You will be notified.</p>
        <h2 className="font-display text-lg uppercase">Limitation</h2>
        <p className="text-muted-foreground">To the extent permitted by law, our liability is limited to the order value. No inflated guarantees are made.</p>
        <h2 className="font-display text-lg uppercase">Contact</h2>
        <p className="text-muted-foreground">{siteConfig.email} · {siteConfig.address}</p>
      </div>
    </div>
  );
}
