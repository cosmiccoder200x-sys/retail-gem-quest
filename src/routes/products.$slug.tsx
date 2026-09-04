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
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { useRecentlyViewed } from "@/lib/recentlyViewed";
import { toast } from "sonner";

import { siteConfig } from "@/lib/site";

export const Route = createFileRoute("/products/$slug")({
  component: ProductPage,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("products")
      .select(
        "name, short_description, description, image_url, price, mrp, stock, rating, review_count",
      )
      .eq("slug", params.slug)
      .eq("is_active", true)
      .maybeSingle();
    return data;
  },
  head: ({ loaderData, params }) => {
    const name = (loaderData as any)?.name ?? params.slug.replace(/-/g, " ");
    const desc =
      (loaderData as any)?.short_description ??
      (loaderData as any)?.description ??
      "Shop this product at GullyGadget.";
    const img = (loaderData as any)?.image_url ?? "";
    const title = `${name} | ${siteConfig.name}`;
    return {
      meta: [
        { title },
        { name: "description", content: String(desc).slice(0, 160) },
        { property: "og:title", content: title },
        { property: "og:description", content: String(desc).slice(0, 160) },
        { property: "og:type", content: "product" },
        { property: "og:url", content: `${siteConfig.url}/products/${params.slug}` },
        ...(img ? [{ property: "og:image", content: img }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: String(desc).slice(0, 160) },
        ...(img ? [{ name: "twitter:image", content: img }] : []),
      ],
      links: [{ rel: "canonical", href: `/products/${params.slug}` }],
    };
  },
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
        .select(
          "id, name, slug, short_description, price, mrp, image_url, rating, review_count, badge, stock",
        )
        .eq("category_id", product!.category_id!)
        .neq("id", product!.id)
        .eq("is_active", true)
        .gt("stock", 0)
        .order("rating", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (variants && variants.length > 0 && !selectedVariantId) {
      const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
      setSelectedVariantId(firstInStock.id);
    }
  }, [variants, selectedVariantId]);

  useRecentlyViewed(product?.id);

  const addToCartWithVariant = useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId?: string }) => {
      await addToCart.mutateAsync({ product_id: productId, variant_id: variantId ?? undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  const selectedVariant = variants?.find((v) => v.id === selectedVariantId) ?? null;
  const displayPrice = selectedVariant?.price ?? product.price;
  const displayMrp = selectedVariant?.mrp ?? product.mrp;
  const displayStock = selectedVariant?.stock ?? product.stock;
  const off = discountPct(displayPrice, displayMrp);

  const images: ProductImage[] =
    (Array.isArray(product.images) && product.images.length > 0
      ? (product.images as any[])
      : null) ||
    (selectedVariant?.image_url ? [{ url: selectedVariant.image_url, alt: product.name }] : null) ||
    (product.image_url ? [{ url: product.image_url, alt: product.name }] : []);

  const specs = (product.specs ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid gap-8 lg:grid-cols-2">
        <ProductImageGallery images={images} productName={product.name} />

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
                      {isOutOfStock && (
                        <span className="text-xs text-destructive">(Out of stock)</span>
                      )}
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
              onClick={() =>
                addToCartWithVariant.mutate({
                  productId: product.id,
                  variantId: selectedVariantId ?? undefined,
                })
              }
              className="flex-1 rounded-full bg-brand font-bold uppercase tracking-tighter hover:bg-accent-cyan"
            >
              <ShoppingBag className="mr-2 size-4" /> Add to Cart
            </Button>
            <Button
              size="lg"
              disabled={displayStock === 0 || addToCartWithVariant.isPending}
              onClick={async () => {
                await addToCartWithVariant.mutateAsync({
                  productId: product.id,
                  variantId: selectedVariantId ?? undefined,
                });
                navigate({ to: "/checkout" });
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
              <Truck className="size-5 text-brand" /> Free shipping —{" "}
              <a href="/shipping" className="underline hover:text-brand">
                details
              </a>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-brand-soft p-3 text-sm">
              <ShieldCheck className="size-5 text-brand" /> 7-day return —{" "}
              <a href="/returns" className="underline hover:text-brand">
                policy
              </a>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Secure checkout · COD available ·{" "}
            <a href="/faq" className="underline hover:text-brand">
              FAQ
            </a>{" "}
            ·{" "}
            <a href="/contact" className="underline hover:text-brand">
              Support
            </a>
          </p>

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
          <div className="overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0">
            <div className="flex gap-4 lg:grid lg:grid-cols-4">
              <div className="contents lg:hidden">
                {related.map((p) => (
                  <div key={p.id} className="w-44 shrink-0">
                    <ProductCard product={p as ProductCardData} />
                  </div>
                ))}
              </div>
              <div className="hidden lg:contents">
                <ProductGrid
                  products={related as ProductCardData[]}
                  loading={false}
                  error={false}
                  emptyMessage="No related products"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {product && <ReviewsSection productId={product.id} />}

      {product && <RecentlyViewed excludeId={product.id} />}

      {/* Structured data — only real values */}
      {product && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: product.name,
                description: product.short_description || product.description || undefined,
                image: product.image_url ? [product.image_url] : undefined,
                sku: (product as any).sku || undefined,
                offers: {
                  "@type": "Offer",
                  price: String(displayPrice),
                  priceCurrency: "INR",
                  availability:
                    displayStock > 0
                      ? "https://schema.org/InStock"
                      : "https://schema.org/OutOfStock",
                  url: `${siteConfig.url}/products/${product.slug}`,
                },
                aggregateRating:
                  product.review_count > 0
                    ? {
                        "@type": "AggregateRating",
                        ratingValue: String(product.rating),
                        reviewCount: String(product.review_count),
                      }
                    : undefined,
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Products",
                    item: `${siteConfig.url}/products`,
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: product.name,
                    item: `${siteConfig.url}/products/${product.slug}`,
                  },
                ],
              }),
            }}
          />
        </>
      )}
    </div>
  );
}
