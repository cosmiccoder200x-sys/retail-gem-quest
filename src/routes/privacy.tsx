import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: `Privacy Policy | ${siteConfig.name}` },
      { name: "description", content: `Privacy Policy for ${siteConfig.name} — what data we collect and how we use it.` },
      { property: "og:title", content: `Privacy Policy | ${siteConfig.name}` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${siteConfig.url}/privacy` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl uppercase">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Template — have counsel review before launch. Business details are editable in <code>src/lib/site.ts</code>.</p>
      <div className="mt-8 space-y-6 leading-relaxed text-sm">
        <h2 className="font-display text-lg uppercase">What we collect</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Account: email, name, phone you provide.</li>
          <li>Orders: shipping address, items, payment status (not card/UPI — handled by Razorpay).</li>
          <li>Contact messages you submit.</li>
          <li>Basic usage analytics if enabled (no selling of personal data).</li>
        </ul>
        <h2 className="font-display text-lg uppercase">How we use it</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>To fulfill and support orders, and communicate about them.</li>
          <li>To improve catalog and service.</li>
          <li>To comply with law.</li>
        </ul>
        <h2 className="font-display text-lg uppercase">Sharing</h2>
        <p className="text-muted-foreground">We share order data only with services needed to run the store (e.g., Supabase for hosting, Razorpay for payments, couriers for delivery). No sale of personal data.</p>
        <h2 className="font-display text-lg uppercase">Retention & rights</h2>
        <p className="text-muted-foreground">You may request access or deletion of your account data via {siteConfig.email}. Contact messages are retained for support history and accessible to admins only.</p>
        <h2 className="font-display text-lg uppercase">Contact</h2>
        <p className="text-muted-foreground">Questions: {siteConfig.email}, {siteConfig.address}</p>
      </div>
    </div>
  );
}
