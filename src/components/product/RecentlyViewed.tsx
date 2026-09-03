import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ProductTile } from "./ProductTile";
import { formatINR } from "@/lib/format";
import { getRecentlyViewedIds } from "@/lib/recentlyViewed";

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const ids = typeof window !== "undefined" ? getRecentlyViewedIds(excludeId) : [];
  const displayIds = ids.slice(0, 6);

  const { data: products } = useQuery({
    queryKey: ["recently-viewed", displayIds.join(",")],
    enabled: displayIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, price, mrp, image_url, badge")
        .in("id", displayIds)
        .eq("is_active", true);
      if (!data) return [];
      // Preserve recently viewed order
      const map = new Map(data.map((p) => [p.id, p]));
      return displayIds.map((id) => map.get(id)).filter(Boolean) as typeof data;
    },
  });

  if (!products || products.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="mb-4 font-display text-xl uppercase">Recently Viewed</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
        {products.map((p) => (
          <Link
            key={p.id}
            to="/products/$slug"
            params={{ slug: p.slug }}
            className="group w-40 shrink-0 snap-start"
          >
            <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-background ring-1 ring-border">
              <ProductTile name={p.name} imageUrl={p.image_url} />
            </div>
            <p className="mt-2 line-clamp-1 text-sm font-medium group-hover:text-brand">{p.name}</p>
            <p className="text-sm font-display italic">{formatINR(Number(p.price))}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
