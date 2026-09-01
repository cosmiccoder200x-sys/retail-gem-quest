import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Truck, ShieldCheck, BadgeIndianRupee, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-cooler.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GullyGadget — Trending Home Gadgets Under ₹999" },
      {
        name: "description",
        content:
          "Shop trending home appliances and smart gadgets under ₹999. Free shipping over ₹499, Cash on Delivery across India.",
      },
      { property: "og:title", content: "GullyGadget — Trending Home Gadgets Under ₹999" },
      {
        property: "og:description",
        content:
          "Shop trending home appliances and smart gadgets under ₹999. Free shipping over ₹499, Cash on Delivery across India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const productCols =
  "id, name, slug, short_description, price, mrp, image_url, rating, review_count, badge, is_bestseller";

function Index() {
  const { data: featured } = useQuery({
    queryKey: ["home-featured"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(productCols)
        .eq("is_featured", true)
        .order("rating", { ascending: false })
        .limit(4);
      return (data ?? []) as unknown as ProductCardData[];
    },
  });

  const { data: bestsellers } = useQuery({
    queryKey: ["home-bestsellers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(productCols)
        .eq("is_bestseller", true)
        .order("review_count", { ascending: false })
        .limit(8);
      return (data ?? []) as unknown as ProductCardData[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("name, slug").order("sort_order");
      return data ?? [];
    },
  });

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-soft">
          <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2 lg:p-16">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-semibold text-brand shadow-sm ring-1 ring-border">
                <Sparkles className="size-3.5" /> New arrivals every week
              </span>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Smart gadgets for your home.
                <span className="block text-brand">All under ₹999.</span>
              </h1>
              <p className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
                Trending kitchen tech, home comfort and cleaning gadgets — quality tested,
                shipped fast, Cash on Delivery available.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full bg-brand px-7 font-semibold hover:bg-brand/90">
                  <Link to="/products">
                    Shop all gadgets <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full px-7 font-semibold">
                  <Link to="/products" search={{ sort: "rating" }}>
                    Top rated
                  </Link>
                </Button>
              </div>
            </div>
            <div className="relative">
              <img
                src={heroImg}
                alt="Trending home gadget collection"
                className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl ring-1 ring-border"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Truck, title: "Free shipping", sub: "On all orders over ₹499" },
            { icon: BadgeIndianRupee, title: "Cash on Delivery", sub: "Pay when it arrives" },
            { icon: ShieldCheck, title: "Quality tested", sub: "7-day easy replacement" },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <f.icon className="size-5" />
              </div>
              <div>
                <p className="font-semibold">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories && categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-muted-foreground">Browse:</span>
            {categories.map((c) => (
              <Link
                key={c.slug}
                to="/products"
                search={{ category: c.slug }}
                className="rounded-full bg-card px-5 py-2 text-sm font-medium ring-1 ring-border transition hover:bg-brand hover:text-brand-foreground hover:ring-brand"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Featured this week</h2>
            <p className="mt-1 text-muted-foreground">Hand-picked trending gadgets</p>
          </div>
          <Link to="/products" className="hidden items-center gap-1 text-sm font-semibold text-brand hover:underline sm:flex">
            View all <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {(featured ?? []).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Bestsellers */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mb-8">
          <h2 className="font-display text-3xl font-bold tracking-tight">Bestsellers</h2>
          <p className="mt-1 text-muted-foreground">Most loved by thousands of homes</p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {(bestsellers ?? []).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
