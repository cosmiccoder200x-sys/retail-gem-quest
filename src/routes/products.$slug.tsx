import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductTile } from "@/components/ProductTile";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, Star, Truck, ShieldCheck } from "lucide-react";
import { formatINR, discountPct } from "@/lib/format";
import { useAddToCart, useToggleWishlist } from "@/lib/cart";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";

export const Route = createFileRoute("/products/$slug")({
  component: ProductPage,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — GullyGadget` },
      { property: "og:url", content: `/products/${params.slug}` },
    ],
    links: [{ rel: "canonical", href: `/products/${params.slug}` }],
  }),
});

function ProductPage() {
  const { slug } = Route.useParams();
  const addToCart = useAddToCart();
  const toggleWish = useToggleWishlist();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, slug)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: related } = useQuery({
    queryKey: ["related", product?.category_id, product?.id],
    enabled: !!product?.category_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, short_description, price, mrp, image_url, rating, review_count, badge")
        .eq("category_id", product!.category_id!)
        .neq("id", product!.id)
        .limit(3);
      return (data ?? []) as ProductCardData[];
    },
  });

  if (isLoading) return <div className="mx-auto max-w-7xl p-12">Loading…</div>;
  if (!product) return null;
  const off = discountPct(product.price, product.mrp);
  const specs = (product.specs ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-[40px] bg-white shadow-xl shadow-brand/10 ring-1 ring-brand/5">
          <ProductTile name={product.name} imageUrl={product.image_url} />
        </div>

        <div className="space-y-5">
          {product.badge && (
            <span className="inline-block rounded-full bg-offer-soft px-3 py-1 text-xs font-bold uppercase tracking-widest text-offer">
              {product.badge}
            </span>
          )}
          <h1 className="font-display text-4xl uppercase">{product.name}</h1>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              <Star className="size-4 fill-offer text-offer" />
              <span className="font-bold">{product.rating}</span>
            </div>
            <span className="text-muted-foreground">({product.review_count} reviews)</span>
          </div>
          <p className="text-lg text-muted-foreground">{product.short_description}</p>

          <div className="flex items-baseline gap-3">
            <span className="font-display text-4xl italic">{formatINR(product.price)}</span>
            {product.mrp && product.mrp > product.price && (
              <>
                <span className="text-muted-foreground line-through">{formatINR(product.mrp)}</span>
                <span className="font-bold text-success">{off}% OFF</span>
              </>
            )}
          </div>

          {product.stock > 0 ? (
            <p className="text-sm font-bold text-success">In stock — ships in 24 hrs</p>
          ) : (
            <p className="text-sm font-bold text-destructive">Out of stock</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              size="lg"
              disabled={product.stock === 0 || addToCart.isPending}
              onClick={() => addToCart.mutate({ productId: product.id })}
              className="flex-1 rounded-full bg-brand font-bold uppercase tracking-tighter hover:bg-accent-cyan"
            >
              <ShoppingBag className="mr-2 size-4" /> Add to Cart
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => toggleWish.mutate(product.id)}
              className="rounded-full"
            >
              <Heart className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="flex items-center gap-2 rounded-2xl bg-brand-soft p-3 text-sm">
              <Truck className="size-5 text-brand" /> Free shipping
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-brand-soft p-3 text-sm">
              <ShieldCheck className="size-5 text-brand" /> 1Y warranty
            </div>
          </div>

          <div className="pt-6">
            <h3 className="mb-3 font-display text-xl uppercase">Description</h3>
            <p className="text-muted-foreground">{product.description}</p>
          </div>

          {Object.keys(specs).length > 0 && (
            <div className="pt-2">
              <h3 className="mb-3 font-display text-xl uppercase">Specifications</h3>
              <dl className="divide-y divide-border rounded-2xl bg-white ring-1 ring-brand/5">
                {Object.entries(specs).map(([k, v]) => (
                  <div key={k} className="flex justify-between px-4 py-3 text-sm">
                    <dt className="font-medium text-muted-foreground">{k}</dt>
                    <dd className="font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {related && related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-8 font-display text-3xl uppercase">Related Products</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}