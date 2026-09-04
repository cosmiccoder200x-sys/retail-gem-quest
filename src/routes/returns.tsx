import { createFileRoute, Link } from "@tanstack/react-router";
import { siteConfig } from "@/lib/site";

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: `Return & Refund Policy | ${siteConfig.name}` },
      {
        name: "description",
        content: `Return and refund policy for ${siteConfig.name} — eligibility, process, and timelines.`,
      },
      { property: "og:title", content: `Return & Refund Policy | ${siteConfig.name}` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${siteConfig.url}/returns` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/returns" }],
  }),
  component: ReturnsPage,
});

function ReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl uppercase">Return & Refund Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Clear, non-misleading policy. Update with your legal counsel for the final wording.
      </p>
      <div className="mt-8 space-y-6 leading-relaxed">
        <h2 className="font-display text-xl uppercase">Eligibility</h2>
        <p className="text-muted-foreground">
          Returns are accepted within 7 days of delivery for unused products in original packaging.
          Hygiene or personalized items may be non-returnable where applicable.
        </p>
        <h2 className="font-display text-xl uppercase">Process</h2>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>
            Contact{" "}
            <Link to="/contact" className="text-brand hover:underline">
              support
            </Link>{" "}
            with your order number and reason.
          </li>
          <li>We review eligibility and provide instructions.</li>
          <li>Ship or arrange pickup as instructed; keep tracking.</li>
        </ol>
        <h2 className="font-display text-xl uppercase">Refunds</h2>
        <p className="text-muted-foreground">
          For online payments, approved refunds go to the original payment method after inspection.
          COD orders have no online refund; remedy is replacement or policy-specific credit.
          Timelines depend on provider but are communicated at approval.
        </p>
        <h2 className="font-display text-xl uppercase">Damaged or Wrong Item</h2>
        <p className="text-muted-foreground">
          Contact us within 48 hours of delivery with photos and order details for priority
          handling.
        </p>
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="text-sm font-medium">Need help?</p>
          <Link to="/contact" className="text-sm text-brand hover:underline">
            Contact us →
          </Link>
          <span className="mx-2 text-muted-foreground">·</span>
          <Link to="/faq" className="text-sm text-brand hover:underline">
            FAQ →
          </Link>
        </div>
      </div>
    </div>
  );
}
