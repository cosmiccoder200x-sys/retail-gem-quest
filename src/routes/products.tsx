import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductGrid } from "@/components/product/ProductGrid";
import { formatINR } from "@/lib/format";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { Search, SlidersHorizontal, X } from "lucide-react";

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
  const [localQ, setLocalQ] = useState(search.q ?? "");
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("name, slug").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });

  const activeCategory = categories?.find((c) => c.slug === search.category);

  const { data: products, isPending, error } = useQuery({
    queryKey: ["products", search, maxPrice],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select(
          "id, name, slug, short_description, price, mrp, image_url, rating, review_count, badge, category_id, categories!inner(slug, is_active)",
        )
        .eq("is_active", true);
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
      return { data: (data ?? []) as unknown as ProductCardData[], isPending: false };
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQ.trim()) {
      window.location.href = `/products?q=${encodeURIComponent(localQ.trim())}`;
    }
  };

  const clearFilters = () => {
    window.location.href = "/products";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
      <Breadcrumb items={[
        { label: "Home", to: "/" },
        { label: activeCategory?.name ?? "Shop All" },
      ]} />

      {/* Category Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl uppercase">
          {activeCategory?.name ?? "Shop All"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {activeCategory
            ? `Browse our ${activeCategory.name.toLowerCase()} collection`
            : "Trending gadgets, all under ₹1000"}
        </p>
      </div>

      {/* Search + Filters Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Search in this category…"
            className="rounded-full pl-9"
          />
        </form>

        <div className="flex items-center gap-2">
          <Select
            value={search.sort ?? "newest"}
            onValueChange={(v) => {
              const params = new URLSearchParams(window.location.search);
              params.set("sort", v);
              window.location.href = `/products?${params.toString()}`;
            }}
          >
            <SelectTrigger className="w-40 rounded-full">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price-asc">Price: Low → High</SelectItem>
              <SelectItem value="price-desc">Price: High → Low</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="rounded-full lg:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="size-4 mr-1" /> Filters
          </Button>

          {(search.category || search.q || search.max) && (
            <Button variant="ghost" size="sm" className="rounded-full" onClick={clearFilters}>
              <X className="size-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Filters (desktop) */}
        <aside className={`w-56 shrink-0 space-y-6 ${showFilters ? "block" : "hidden"} lg:block`}>
          {/* Categories */}
          <div>
            <h3 className="font-bold text-sm mb-3">Categories</h3>
            <div className="space-y-1">
              <Link
                to="/products"
                className={`block rounded-lg px-3 py-2 text-sm transition ${!search.category ? "bg-brand-soft text-brand font-medium" : "text-muted-foreground hover:bg-brand-soft/50"}`}
              >
                All Products
              </Link>
              {categories?.map((cat) => (
                <Link
                  key={cat.slug}
                  to="/products"
                  search={{ category: cat.slug }}
                  className={`block rounded-lg px-3 py-2 text-sm transition ${search.category === cat.slug ? "bg-brand-soft text-brand font-medium" : "text-muted-foreground hover:bg-brand-soft/50"}`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Price Filter */}
          <div>
            <h3 className="font-bold text-sm mb-3">Max Price</h3>
            <div className="space-y-2">
              {[499, 799, 999].map((price) => (
                <button
                  key={price}
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set("max", String(price));
                    window.location.href = `/products?${params.toString()}`;
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${maxPrice === price ? "bg-brand-soft text-brand font-medium" : "text-muted-foreground hover:bg-brand-soft/50"}`}
                >
                  Under {formatINR(price)}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Products Grid */}
        <div className="flex-1">
          <ProductGrid
            products={products}
            loading={isPending}
            error={!!error}
            onRetry={() => {}}
            emptyMessage={search.q || search.category ? "No products match your filters" : "No products found"}
          />
        </div>
      </div>
    </div>
  );
}

type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  short_description?: string | null;
  price: number;
  mrp: number | null;
  image_url: string | null;
  rating: number;
  review_count: number;
  badge: string | null;
};
