import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductGrid } from "@/components/product/ProductGrid";
import { formatINR } from "@/lib/format";
import { Breadcrumb } from "@/components/common/Breadcrumb";

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
      const { data } = await supabase.from("categories").select("name, slug").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });

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

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <Breadcrumb items={[
        { label: "Home", to: "/" },
        { label: "Shop All" },
      ]} />

      <h1 className="mb-2 font-display text-4xl uppercase">Shop All</h1>
      <p className="mb-8 text-muted-foreground">
        {search.category ? `Category: ${search.category}` : "Trending gadgets, all under ₹1000"}
      </p>

      <ProductGrid
        products={products}
        loading={isPending}
        error={!!error}
        onRetry={() => {}}
        emptyMessage={search.q || search.category ? "No products match your filters" : "No products found"}
      />
    </div>
  );
}