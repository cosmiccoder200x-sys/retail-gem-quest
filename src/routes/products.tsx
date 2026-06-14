import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const searchSchema = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "rating"]).optional(),
  max: z.coerce.number().optional(),
});

export const Route = createFileRoute("/products")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop All — GullyGadget" },
      { name: "description", content: "Browse trending home appliance gadgets under ₹1000." },
      { property: "og:url", content: "/products" },
    ],
    links: [{ rel: "canonical", href: "/products" }],
  }),
  component: Catalog,
});

function Catalog() {
  const search = Route.useSearch();
  const [maxPrice, setMaxPrice] = useState<number | undefined>(search.max);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("name, slug").order("sort_order");
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products", search, maxPrice],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select(
          "id, name, slug, short_description, price, mrp, image_url, rating, review_count, badge, category_id, categories!inner(slug)",
        );
      if (search.category) q = q.eq("categories.slug", search.category);
      if (search.q) q = q.ilike("name", `%${search.q}%`);
      if (maxPrice) q = q.lte("price", maxPrice);
      switch (search.sort) {
        case "price-asc": q = q.order("price", { ascending: true }); break;
        case "price-desc": q = q.order("price", { ascending: false }); break;
        case "rating": q = q.order("rating", { ascending: false }); break;
        default: q = q.order("created_at", { ascending: false });
      }
      const { data } = await q.limit(40);
      return (data ?? []) as unknown as ProductCardData[];
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-2 font-display text-4xl uppercase">Shop All</h1>
      <p className="mb-8 text-muted-foreground">
        {search.category ? `Category: ${search.category}` : "Trending gadgets, all under ₹1000"}
      </p>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Filters */}
        <aside className="space-y-6">
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Category</h3>
            <div className="flex flex-col gap-1">
              <Link to="/products" className={!search.category ? "font-bold text-brand" : "text-muted-foreground"}>All</Link>
              {(categories ?? []).map((c) => (
                <Link
                  key={c.slug}
                  to="/products"
                  search={{ category: c.slug }}
                  className={search.category === c.slug ? "font-bold text-brand" : "text-muted-foreground hover:text-brand"}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Max Price (₹)</h3>
            <Input
              type="number"
              value={maxPrice ?? ""}
              onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="999"
            />
          </div>
        </aside>

        {/* Grid */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{products?.length ?? 0} products</p>
            <Select
              value={search.sort ?? "newest"}
              onValueChange={(v) => {
                const url = new URL(window.location.href);
                url.searchParams.set("sort", v);
                window.location.href = url.toString();
              }}
            >
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {(products ?? []).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          {products && products.length === 0 && (
            <div className="rounded-3xl bg-white p-12 text-center ring-1 ring-brand/5">
              <p className="text-lg font-bold">No products match your filters</p>
              <Button asChild variant="link"><Link to="/products">Reset</Link></Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}