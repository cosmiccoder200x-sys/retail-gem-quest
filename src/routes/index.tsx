import { useState } from "react";
import { ArrowRight, Sparkles, Truck, BadgeIndianRupee, ShieldCheck, Gift, Trash2, RefreshCw, Heart, Sun, ChevronDown, Rocket, ShoppingBag, Star } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductGrid, type ProductCardData } from "@/components/product/ProductGrid";
import { SectionHeader } from "@/components/common/SectionHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GullyGadget — Smart Gadgets for Everyday Life" },
      {
        name: "description",
        content:
          "Shop trending home appliances and smart gadgets under ₹999. Free shipping over ₹499, Cash on Delivery across India.",
      },
      { property: "og:title", content: "GullyGadget — Smart Gadgets for Everyday Life" },
      {
        property: "og:description",
        content:
          "Discover useful, trending gadgets for your home, car and everyday routine without the premium price tag.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const productCols =
  "id, name, slug, short_description, price, mrp, image_url, rating, review_count, badge, is_bestseller, is_featured";

function Index() {
  const { data: featured } = useQuery({
    queryKey: ["home-featured"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(productCols)
        .eq("is_featured", true)
        .eq("is_active", true)
        .order("rating", { ascending: false })
        .limit(6);
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
        .eq("is_active", true)
        .order("review_count", { ascending: false })
        .limit(8);
      return (data ?? []) as unknown as ProductCardData[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("name, slug").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });

  return (
    <div>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand-soft pt-6 sm:pt-12">
        <div className="grid items-center gap-8 p-4 sm:p-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-brand shadow-sm ring-1 ring-border">
              <Sparkles className="size-3" /> New arrivals every week
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl sm:mb-3">
              Smart gadgets for your home.
              <span className="block text-brand">All under ₹999.</span>
            </h1>
            <p className="mt-3 max-w-sm text-base text-muted-foreground sm:text-lg">
              Trending kitchen tech, home comfort and cleaning gadgets — quality tested,
              shipped fast, Cash on Delivery available.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
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
              src="/assets/hero-cooler.jpg"
              alt="Trending home gadget collection"
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-xl ring-1 ring-border"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 bg-brand-soft/20 border-b border-border">
        <div className="mx-auto max-w-7xl grid gap-4 sm:grid-cols-3">
          {[
            { icon: Truck, title: "Free shipping", sub: "On all orders over ₹499" },
            { icon: BadgeIndianRupee, title: "Cash on Delivery", sub: "Pay when it arrives" },
            { icon: ShieldCheck, title: "Quality tested", sub: "7-day easy replacement" },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                {f.icon}
              </div>
              <div>
                <p className="font-semibold">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories Section */}
      {categories && categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <SectionHeader
            title="Browse Categories"
            subtitle="Explore gadgets by type"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                to="/products"
                search={{ category: cat.slug }}
                className="flex flex-col items-center rounded-2xl bg-card p-4 ring-1 ring-border transition hover:bg-brand hover:text-brand-foreground"
              >
                <Sparkles className="size-6 mb-2" /> {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Section */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <SectionHeader
          title="Featured this week"
          subtitle="Hand-picked trending gadgets"
        />
        <ProductGrid
          products={featured}
          loading={false}
          error={false}
          emptyMessage="No featured products"
        />
      </section>

      {/* Bestsellers Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeader
          title="Bestsellers"
          subtitle="Most loved by thousands of homes"
        />
        <ProductGrid
          products={bestsellers}
          loading={false}
          error={false}
          emptyMessage="No bestsellers"
        />
      </section>

      {/* Promotional Section */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 bg-brand-soft">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-1 lg:grid-cols-2">
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <h3 className="font-display text-xl font-bold tracking-tight mb-3">Buy 2 Get 10% Off</h3>
            <p className="text-sm text-muted-foreground">On all home comfort gadgets. Use code COMBO10 at checkout.</p>
          </div>
          <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <h3 className="font-display text-xl font-bold tracking-tight mb-3">Bank Offer</h3>
            <p className="text-sm text-muted-foreground">Up to ₹200 instant discount on orders above ₹999. T&C apply.</p>
          </div>
        </div>
      </section>

      {/* Why GullyGadget Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeader
          title="Why GullyGadget"
          subtitle="Trusted by thousands of Indian homes"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="flex items-start rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex-shrink-0 rounded-full bg-brand-soft text-brand">
              <Sun className="size-4" />
            </div>
            <div className="ml-3 flex-1">
              <h4 className="font-semibold">Quality Tested</h4>
              <p className="text-xs text-muted-foreground">Every product quality checked</p>
            </div>
          </div>
          <div className="flex items-start rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex-shrink-0 rounded-full bg-brand-soft text-brand">
              <Truck className="size-4" />
            </div>
            <div className="ml-3 flex-1">
              <h4 className="font-semibold">Fast Delivery</h4>
              <p className="text-xs text-muted-foreground">Shipped within 48 hrs</p>
            </div>
          </div>
          <div className="flex items-start rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex-shrink-0 rounded-full bg-brand-soft text-brand">
              <ShieldCheck className="size-4" />
            </div>
            <div className="ml-3 flex-1">
              <h4 className="font-semibold">Easy Replacement</h4>
              <p className="text-xs text-muted-foreground">7-day easy replacement</p>
            </div>
          </div>
          <div className="flex items-start rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex-shrink-0 rounded-full bg-brand-soft text-brand">
              <Rocket className="size-4" />
            </div>
            <div className="ml-3 flex-1">
              <h4 className="font-semibold">Secure Payments</h4>
              <p className="text-xs text-muted-foreground">100% secure checkout</p>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Reviews Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeader
          title="Customer Reviews"
          subtitle="What Indian homes say about us"
        />
        <div className="rounded-3xl bg-card p-6 ring-1 ring-border">
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {[4.8, 4.7, 4.9, 4.6, 4.8, 4.7].map((rating, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Star className="size-3 fill-offer text-offer" />
                <span>{rating.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">Example ratings from catalog — see product pages for real reviews</p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeader
          title="Frequently Asked Questions"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <details className="group rounded-2xl bg-card p-4 ring-1 ring-border">
            <summary className="flex items-center justify-between py-2.5 cursor-pointer font-medium text-foreground hover:text-brand transition-colors">
              Do you ship to my city?
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Yes, we ship across India with Cash on Delivery available on all orders.
            </p>
          </details>
          <details className="group rounded-2xl bg-card p-4 ring-1 ring-border">
            <summary className="flex items-center justify-between py-2.5 cursor-pointer font-medium text-foreground hover:text-brand transition-colors">
              What is the return policy?
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              You can return products within 7 days of delivery if unused and in original packaging.
            </p>
          </details>
          <details className="group rounded-2xl bg-card p-4 ring-1 ring-border">
            <summary className="flex items-center justify-between py-2.5 cursor-pointer font-medium text-foreground hover:text-brand transition-colors">
              How can I track my order?
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the Track Order page with your order ID and email address.
            </p>
          </details>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 bg-brand-soft">
        <div className="max-w-md mx-auto text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight mb-3">Subscribe</h2>
          <p className="mb-6 text-base text-muted-foreground">Get exclusive deals, new arrivals and more.</p>
          <form className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <label htmlFor="newsletter-email" className="sr-only">Email</label>
            <input
              id="newsletter-email"
              type="email"
              placeholder="you@email.com"
              className="flex-1 rounded-full bg-white p-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-white/10 focus:ring-brand"
            />
            <button
              type="submit"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>

    </div>
  );
}