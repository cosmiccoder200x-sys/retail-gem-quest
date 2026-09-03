import { createFileRoute, Link } from "@tanstack/react-router";
import { siteConfig } from "@/lib/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `About Us | ${siteConfig.name}` },
      { name: "description", content: `Learn about ${siteConfig.name} — curated home and lifestyle gadgets, quality tested, affordable, shipped across India.` },
      { property: "og:title", content: `About Us | ${siteConfig.name}` },
      { property: "og:description", content: `The story and promise behind ${siteConfig.name}.` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${siteConfig.url}/about` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl uppercase">About Us</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <div className="mt-8 space-y-6 leading-relaxed">
        <p>
          <strong>{siteConfig.name}</strong> is a curated store for trending home and lifestyle gadgets — mini coolers, kitchen tech, smart
          lighting, and everyday helpers. We keep prices accessible and quality verifiable.
        </p>
        <h2 className="font-display text-xl uppercase">What we do</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Source useful, current-season products from trusted suppliers.</li>
          <li>Verify key specs and keep pricing transparent (MRP, selling price, discount).</li>
          <li>Ship across India with Cash on Delivery where available.</li>
        </ul>
        <h2 className="font-display text-xl uppercase">What we promise</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Published products show real images, current prices, and stock status.</li>
          <li>Reviews and ratings are from genuine customer submissions only.</li>
          <li>Policies on this site reflect our current operations — see Shipping, Returns, Privacy, and Terms.</li>
        </ul>
        <div className="rounded-2xl bg-brand-soft p-4 ring-1 ring-border">
          <p className="text-sm font-medium">Business information — editable</p>
          <p className="mt-1 text-sm text-muted-foreground">{siteConfig.address} · Email: {siteConfig.email} · Phone: {siteConfig.phone}</p>
          <p className="text-xs text-muted-foreground mt-1">Update <code>src/lib/site.ts</code> for your registered name and contacts.</p>
        </div>
        <p>
          <Link to="/contact" className="text-brand hover:underline">Contact us</Link> for questions, or browse <Link to="/products" className="text-brand hover:underline">all products</Link>.
        </p>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: siteConfig.name,
            url: siteConfig.url,
            description: siteConfig.description,
          }),
        }}
      />
    </div>
  );
}
