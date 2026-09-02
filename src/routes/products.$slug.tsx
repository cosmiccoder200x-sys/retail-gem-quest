import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, Star, Truck, ShieldCheck } from "lucide-react";
import { formatINR, discountPct } from "@/lib/format";
import { useAddToCart, useToggleWishlist } from "@/lib/cart";
import { toast } from "sonner";

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

type ProductImage = { url: string; alt?: string };
type ProductVariant = {
  id: string;
  price: number | null;
  mrp: number | null;
  stock: number;
  image_url: string | null;
  attributes: Record<string, unknown>;
};

function ProductPage() {
  const { slug } = Route.useParams();
  const addToCart = useAddToCart();
  const toggleWish = useToggleWishlist();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, slug)")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: variants } = useQuery({
    queryKey: ["product-variants", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", product!.id)
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as ProductVariant[];
    },
  });

  const { data: related } = useQuery({
    queryKey: ["related", product?.category_id, product?.id],
    enabled: !!product?.category_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, short_description, price, mrp, image_url, rating, review_count, badge, stock")
        .eq("category_id", product!.category_id!)
        .neq("id", product!.id)
        .eq("is_active", true)
        .limit(3);
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-8">
        <div className="animate-pulse space-y-8">
          <div className="aspect-square rounded-3xl bg-secondary" />
          <div className="h-8 bg-secondary rounded w-3/4" />
          <div className="h-4 bg-secondary rounded w-1/2" />
          <div className="h-4 bg-secondary rounded w-1/4" />
          <div className="h-12 bg-secondary rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  useEffect(() => {
    if (variants && variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(variants[0].id);
    }
  }, [variants, selectedVariantId]);

  const selectedVariant = variants?.find((v) => v.id === selectedVariantId) ?? null;
  const displayPrice = selectedVariant?.price ?? product.price;
  const displayMrp = selectedVariant?.mrp ?? product.mrp;
  const displayStock = selectedVariant?.stock ?? product.stock;
  const off = discountPct(displayPrice, displayMrp);

  const images: ProductImage[] = (product.images as any[]) ??
    (selectedVariant?.image_url ? [{ url: selectedVariant.image_url, alt: product.name }] : [])
    ?? (product.image_url ? [{ url: product.image_url, alt: product.name }] : []);

  const addToCartWithVariant = useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId?: string }) => {
      await addToCart.mutateAsync({ product_id: productId, variant_id: variantId ?? undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const specs = (product.specs ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductImageGallery
          images={images}
          productName={product.name}
        />

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

          {/* Variant Selector */}
          {variants && variants.length > 0 && (
            <div className="space-y-3 p-4 rounded-2xl bg-background ring-1 ring-border">
              <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Select Variant
              </h4>
              <div className="flex flex-wrap gap-2">
                {variants.map((variant) => {
                  const attrs = variant.attributes as Record<string, string> | null;
                  const label = attrs
                    ? Object.values(attrs).filter(Boolean).join(" / ")
                    : "Default";
                  const isSelected = selectedVariantId === variant.id;
                  const isOutOfStock = variant.stock === 0;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => !isOutOfStock && setSelectedVariantId(variant.id)}
                      disabled={isOutOfStock}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-brand text-brand-foreground ring-2 ring-brand"
                          : "bg-white text-foreground ring-1 ring-border hover:ring-brand/50"
                      } ${isOutOfStock ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {label}
                      {isOutOfStock && <span className="text-xs text-destructive">(Out of stock)</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-baseline gap-3">
            <span className="font-display text-4xl italic">{formatINR(displayPrice)}</span>
            {displayMrp && displayMrp > displayPrice && (
              <>
                <span className="text-muted-foreground line-through">{formatINR(displayMrp)}</span>
                <span className="font-bold text-success">{off}% OFF</span>
              </>
            )}
          </div>

          {displayStock > 0 ? (
            <p className="text-sm font-bold text-success">In stock — ships in 24 hrs</p>
          ) : (
            <p className="text-sm font-bold text-destructive">Out of stock</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              size="lg"
              disabled={displayStock === 0 || addToCartWithVariant.isPending}
              onClick={() => addToCartWithVariant.mutate({ productId: product.id, variantId: selectedVariantId ?? undefined })}
              className="flex-1 rounded-full bg-brand font-bold uppercase tracking-tighter hover:bg-accent-cyan"
            >
              <ShoppingBag className="mr-2 size-4" /> Add to Cart
            </Button>
            <Button
              size="lg"
              disabled={displayStock === 0 || addToCartWithVariant.isPending}
              onClick={async () => {
                await addToCartWithVariant.mutateAsync({ productId: product.id, variantId: selectedVariantId ?? undefined });
                navigate({ to: "/_authenticated/checkout" });
              }}
              className="flex-1 rounded-full bg-accent-cyan font-bold uppercase tracking-tighter hover:bg-brand"
            >
              <ShoppingBag className="mr-2 size-4" /> Buy Now
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => toggleWish.mutate({ product_id: product.id })}
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
        <section className="mt-16">
          <h2 className="mb-8 font-display text-3xl uppercase">Related Products</h2>
          <ProductGrid
            products={related as ProductCardData[]}
            loading={false}
            error={false}
            emptyMessage="No related products"
          />
        </section>
      )}
    </div>
  );
}