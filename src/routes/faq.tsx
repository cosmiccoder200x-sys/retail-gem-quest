import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { siteConfig } from "@/lib/site";
import { faqItems, faqCategories } from "@/lib/faq";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: `FAQ | ${siteConfig.name}` },
      { name: "description", content: `Frequently asked questions about orders, payments, shipping and returns at ${siteConfig.name}.` },
      { property: "og:title", content: `FAQ | ${siteConfig.name}` },
      { property: "og:description", content: `Answers for shoppers of ${siteConfig.name}.` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${siteConfig.url}/faq` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/faq" }],
  }),
  component: FaqPage,
});

function FaqPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return faqItems.filter((f) => {
      if (cat !== "All" && f.category !== cat) return false;
      if (!term) return true;
      return f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term);
    });
  }, [q, cat]);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: filtered.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl uppercase">FAQ</h1>
      <p className="mt-2 text-muted-foreground">Search answers or browse by category. Content is in <code>src/lib/faq.ts</code> — edit there.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input placeholder="Search FAQ…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-sm" aria-label="Search FAQ" />
        <div className="flex flex-wrap gap-1">
          {faqCategories.map((c) => (
            <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} className="rounded-full" onClick={() => setCat(c)}>
              {c}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {filtered.map((f) => (
          <details key={f.q} className="group rounded-2xl bg-white p-4 ring-1 ring-border open:ring-brand/20">
            <summary className="cursor-pointer font-medium list-none flex items-center justify-between gap-4">
              <span>{f.q}</span>
              <span className="text-xs bg-secondary px-2 py-0.5 rounded-full shrink-0">{f.category}</span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
          </details>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No results. Try another keyword or <Link to="/contact" className="text-brand hover:underline">contact us</Link>.</p>}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </div>
  );
}
