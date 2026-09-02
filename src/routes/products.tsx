import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ProductGrid } from "@/components/product/ProductGrid";
import { formatINR } from "@/lib/format";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";

const searchSchema = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["featured", "newest", "price-asc", "price-desc"]).optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  inStock: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  page: z.coerce.number().optional(),
});

const PAGE_SIZE = 12;

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
  const navigate = useNavigate();
  const [localQ, setLocalQ] = useState(search.q ?? "");

  const currentPage = search.page ?? 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("name, slug, description")
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: categoryCounts } = useQuery({
    queryKey: ["category-counts"],
    queryFn: async () => {
      const { data: cats } = await supabase.from("categories").select("id, slug").eq("is_active", true);
      if (!cats) return {} as Record<string, number>;
      const { data: products } = await supabase.from("products").select("category_id").eq("is_active", true);
      const counts: Record<string, number> = {};
      for (const cat of cats) counts[cat.slug] = 0;
      for (const p of products ?? []) {
        const cat = cats.find((c) => c.id === p.category_id);
        if (cat) counts[cat.slug] = (counts[cat.slug] ?? 0) + 1;
      }
      return counts;
    },
  });

  const activeCategory = categories?.find((c) => c.slug === search.category);

  // Build products query with all filters
  const { data: result, isPending, error } = useQuery({
    queryKey: ["products", search],
    queryFn: async () => {
      // Need category_id for category filter
      let categoryId: string | undefined;
      if (search.category) {
        const { data: cat } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", search.category)
          .eq("is_active", true)
          .single();
        categoryId = cat?.id;
        if (!categoryId) return { data: [] as ProductCardData[], total: 0 };
      }

      let query = supabase
        .from("products")
        .select(
          "id, name, slug, short_description, price, mrp, image_url, rating, review_count, badge, stock, is_featured, category_id",
          { count: "exact" }
        )
        .eq("is_active", true);

      if (categoryId) query = query.eq("category_id", categoryId);

      if (search.q) {
        const term = search.q.trim();
        query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,sku.ilike.%${term}%`);
      }

      if (search.min !== undefined) query = query.gte("price", search.min);
      if (search.max !== undefined) query = query.lte("price", search.max);
      if (search.inStock) query = query.gt("stock", 0);
      if (search.featured) query = query.eq("is_featured", true);

      switch (search.sort) {
        case "featured":
          query = query.eq("is_featured", true).order("created_at", { ascending: false });
          break;
        case "price-asc":
          query = query.order("price", { ascending: true });
          break;
        case "price-desc":
          query = query.order("price", { ascending: false });
          break;
        case "newest":
        default:
          query = query.order("created_at", { ascending: false });
          break;
      }

      query = query.range(offset, offset + PAGE_SIZE - 1);

      const { data, count, error: qError } = await query;
      if (qError) throw qError;
      return {
        data: (data ?? []) as unknown as ProductCardData[],
        total: count ?? 0,
      };
    },
  });

  const products = result?.data;
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Helpers to update URL via TanStack Router
  const updateSearch = (patch: Record<string, unknown>) => {
    const next = { ...search, ...patch, page: patch.page !== undefined ? patch.page : 1 } as Record<string, unknown>;
    // Remove undefined/null/empty values
    for (const k of Object.keys(next)) {
      if (next[k] === undefined || next[k] === "" || next[k] === false) delete next[k];
      if (k === "page" && next[k] === 1) delete next[k];
    }
    // If patch explicitly sets page, keep it
    if (patch.page !== undefined) next.page = patch.page;
    navigate({ to: "/products", search: next as never });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearch({ q: localQ.trim() || undefined });
  };

  const clearAllFilters = () => {
    setLocalQ("");
    navigate({ to: "/products", search: {} as never });
  };

  const hasActiveFilters =
    !!search.category || !!search.q || search.min !== undefined || search.max !== undefined || !!search.inStock || !!search.featured;

  const activeFilterCount = [
    search.category,
    search.q,
    search.min !== undefined ? "min" : undefined,
    search.max !== undefined ? "max" : undefined,
    search.inStock ? "inStock" : undefined,
    search.featured ? "featured" : undefined,
  ].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
      <Breadcrumb
        items={[{ label: "Home", to: "/" }, { label: activeCategory?.name ?? "Shop All" }]}
      />

      {/* Category Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl uppercase">
          {activeCategory?.name ?? "Shop All"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {activeCategory?.description ??
            (activeCategory
              ? `Browse our ${activeCategory.name.toLowerCase()} collection`
              : "Trending gadgets, all under ₹1000")}
        </p>
      </div>

      {/* Search + Sort Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="relative flex-1 max-w-md flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={localQ}
              onChange={(e) => setLocalQ(e.target.value)}
              placeholder="Search products…"
              className="rounded-full pl-9 pr-8"
            />
            {localQ && (
              <button
                type="button"
                onClick={() => {
                  setLocalQ("");
                  if (search.q) updateSearch({ q: undefined });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button type="submit" size="sm" className="rounded-full shrink-0">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Select
            value={search.sort ?? "newest"}
            onValueChange={(v) => updateSearch({ sort: v })}
          >
            <SelectTrigger className="w-44 rounded-full">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price-asc">Price: Low → High</SelectItem>
              <SelectItem value="price-desc">Price: High → Low</SelectItem>
            </SelectContent>
          </Select>

          {/* Mobile filter drawer trigger */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full lg:hidden">
                <SlidersHorizontal className="size-4 mr-1" /> Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 grid size-5 place-items-center rounded-full bg-brand text-xs text-brand-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[80vh] overflow-y-auto">
              <div className="mx-auto max-w-md p-6">
                <FilterContent
                  categories={categories}
                  categoryCounts={categoryCounts}
                  search={search}
                  onUpdate={updateSearch}
                  onClear={clearAllFilters}
                  hasActiveFilters={hasActiveFilters}
                />
                <DrawerClose asChild>
                  <Button className="mt-4 w-full rounded-full">Show {total} products</Button>
                </DrawerClose>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>

      {/* Result count + active filter pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!isPending && (
          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? "product" : "products"}
            {search.q && <> for "{search.q}"</>}
            {search.category && <> in {activeCategory?.name ?? search.category}</>}
          </span>
        )}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="rounded-full h-7 text-xs" onClick={clearAllFilters}>
            <X className="size-3 mr-1" /> Clear all
          </Button>
        )}
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          {search.category && (
            <FilterPill label={activeCategory?.name ?? search.category} onRemove={() => updateSearch({ category: undefined })} />
          )}
          {search.q && (
            <FilterPill label={`Search: "${search.q}"`} onRemove={() => { setLocalQ(""); updateSearch({ q: undefined }); }} />
          )}
          {(search.min !== undefined || search.max !== undefined) && (
            <FilterPill
              label={`₹${search.min ?? 0} – ₹${search.max ?? "∞"}`}
              onRemove={() => updateSearch({ min: undefined, max: undefined })}
            />
          )}
          {search.inStock && (
            <FilterPill label="In stock" onRemove={() => updateSearch({ inStock: undefined })} />
          )}
          {search.featured && (
            <FilterPill label="Featured" onRemove={() => updateSearch({ featured: undefined })} />
          )}
        </div>
      )}

      <div className="flex gap-8">
        {/* Sidebar Filters (desktop) */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 space-y-6 rounded-2xl bg-card p-5 ring-1 ring-border">
            <FilterContent
              categories={categories}
              categoryCounts={categoryCounts}
              search={search}
              onUpdate={updateSearch}
              onClear={clearAllFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
        </aside>

        {/* Products Grid */}
        <div className="flex-1 min-w-0">
          <ProductGrid
            products={products}
            loading={isPending}
            error={!!error}
            onRetry={() => window.location.reload()}
            emptyMessage={
              search.q
                ? `No products found for "${search.q}"`
                : hasActiveFilters
                  ? "No products match your filters"
                  : "No products found"
            }
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={currentPage <= 1}
                onClick={() => updateSearch({ page: currentPage - 1 } as never)}
              >
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={currentPage >= totalPages}
                onClick={() => updateSearch({ page: currentPage + 1 } as never)}
              >
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
      {label}
      <button onClick={onRemove} className="ml-1 rounded-full hover:bg-brand/10 p-0.5" aria-label={`Remove ${label}`}>
        <X className="size-3" />
      </button>
    </span>
  );
}

function FilterContent({
  categories,
  categoryCounts,
  search,
  onUpdate,
  onClear,
  hasActiveFilters,
}: {
  categories?: { name: string; slug: string }[];
  categoryCounts?: Record<string, number>;
  search: { category?: string; min?: number; max?: number; inStock?: boolean; featured?: boolean };
  onUpdate: (patch: Record<string, unknown>) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
}) {
  const [localMin, setLocalMin] = useState(search.min ?? 0);
  const [localMax, setLocalMax] = useState(search.max ?? 2000);

  return (
    <>
      {/* Categories */}
      <div>
        <h3 className="font-bold text-sm mb-3">Categories</h3>
        <div className="space-y-1">
          <button
            onClick={() => onUpdate({ category: undefined })}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${!search.category ? "bg-brand-soft text-brand font-medium" : "text-muted-foreground hover:bg-brand-soft/50"}`}
          >
            <span>All Products</span>
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => onUpdate({ category: cat.slug })}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${search.category === cat.slug ? "bg-brand-soft text-brand font-medium" : "text-muted-foreground hover:bg-brand-soft/50"}`}
            >
              <span>{cat.name}</span>
              {categoryCounts?.[cat.slug] !== undefined && (
                <span className="text-xs text-muted-foreground">({categoryCounts[cat.slug]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="font-bold text-sm mb-3">Price Range</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={localMin || ""}
              onChange={(e) => setLocalMin(Number(e.target.value) || 0)}
              className="h-8 text-sm"
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type="number"
              placeholder="Max"
              value={localMax || ""}
              onChange={(e) => setLocalMax(Number(e.target.value) || 0)}
              className="h-8 text-sm"
            />
          </div>
          <Slider
            value={[localMin, localMax]}
            min={0}
            max={2000}
            step={50}
            onValueChange={([min, max]) => {
              setLocalMin(min);
              setLocalMax(max);
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatINR(localMin)}</span>
            <span>{formatINR(localMax)}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full rounded-full"
            onClick={() => onUpdate({ min: localMin || undefined, max: localMax === 2000 ? undefined : localMax })}
          >
            Apply
          </Button>
          <div className="flex flex-wrap gap-1">
            {[
              { label: "Under ₹500", min: 0, max: 500 },
              { label: "₹500 – ₹1000", min: 500, max: 1000 },
              { label: "Under ₹1000", min: 0, max: 1000 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setLocalMin(preset.min);
                  setLocalMax(preset.max);
                  onUpdate({ min: preset.min || undefined, max: preset.max });
                }}
                className="rounded-full bg-secondary px-3 py-1 text-xs hover:bg-brand-soft"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Availability */}
      <div>
        <h3 className="font-bold text-sm mb-3">Availability</h3>
        <label className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-secondary cursor-pointer">
          <span className="text-sm">In stock only</span>
          <Switch
            checked={!!search.inStock}
            onCheckedChange={(v) => onUpdate({ inStock: v || undefined })}
          />
        </label>
      </div>

      {/* Featured */}
      <div>
        <h3 className="font-bold text-sm mb-3">Highlights</h3>
        <label className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-secondary cursor-pointer">
          <span className="text-sm">Featured only</span>
          <Switch
            checked={!!search.featured}
            onCheckedChange={(v) => onUpdate({ featured: v || undefined })}
          />
        </label>
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="w-full rounded-full" onClick={onClear}>
          <X className="size-3 mr-1" /> Clear all filters
        </Button>
      )}
    </>
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
  stock: number;
  is_featured?: boolean;
};
