import { Link } from "@tanstack/react-router";
import { Heart, ShoppingBag, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR, discountPct } from "@/lib/format";
import { ProductTile } from "./ProductTile";
import { useAddToCart, useToggleWishlist } from "@/lib/cart";

export type ProductCardData = {
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
  is_bestseller?: boolean;
  is_featured?: boolean;
};

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="mb-4 aspect-[4/5] rounded-3xl bg-secondary" />
      <div className="h-3 w-16 bg-secondary rounded mb-1" />
      <div className="h-4 w-3/4 bg-secondary rounded mb-1" />
      <div className="h-3 w-1/2 bg-secondary rounded mb-2" />
      <div className="flex items-end justify-between">
        <div className="h-6 w-20 bg-secondary rounded" />
        <div className="h-9 w-9 bg-secondary rounded-full" />
      </div>
    </div>
  );
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const addToCart = useAddToCart();
  const toggleWish = useToggleWishlist();
  const off = discountPct(product.price, product.mrp);

  return (
    <div className="group flex flex-col">
      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        className="relative mb-4 block aspect-[4/5] overflow-hidden rounded-3xl bg-background ring-1 ring-brand/5"
      >
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
          <ProductTile name={product.name} imageUrl={product.image_url} />
        </div>
        {product.badge && (
          <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm">
            {product.badge}
          </span>
        )}
        {product.stock === 0 && (
          <span className="absolute bottom-4 left-4 rounded-full bg-destructive px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-destructive-foreground shadow-sm">
            Out of stock
          </span>
        )}
        {product.stock > 0 && product.stock <= 5 && (
          <span className="absolute bottom-4 left-4 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
            Only {product.stock} left
          </span>
        )}
        <button
          aria-label="Add to wishlist"
          onClick={(e) => {
            e.preventDefault();
            toggleWish.mutate({ product_id: product.id });
          }}
          className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/90 text-brand shadow-sm transition hover:bg-white hover:text-offer"
        >
          <Heart className="size-4" />
        </button>
      </Link>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Star className="size-3 fill-offer text-offer" />
        <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
        <span>({product.review_count})</span>
      </div>
      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        className="mt-1 line-clamp-1 font-bold hover:text-accent-cyan"
      >
        {product.name}
      </Link>
      {product.short_description && (
        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
          {product.short_description}
        </p>
      )}
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl italic">{formatINR(product.price)}</span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatINR(product.mrp)}
            </span>
          )}
          {off > 0 && (
            <span className="text-xs font-bold text-success">{off}% OFF</span>
          )}
        </div>
        <Button
          size="icon"
          variant="default"
          className="rounded-full bg-brand text-brand-foreground hover:bg-accent-cyan disabled:opacity-50"
          aria-label={product.stock === 0 ? "Out of stock" : "Add to cart"}
          onClick={() => addToCart.mutate({ product_id: product.id })}
          disabled={addToCart.isPending || product.stock === 0}
        >
          <ShoppingBag className="size-4" />
        </Button>
      </div>
    </div>
  );
}