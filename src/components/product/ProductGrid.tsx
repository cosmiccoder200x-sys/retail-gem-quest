import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { type ProductCardData } from "./ProductCard";
import { ShoppingBag } from "lucide-react";

export function ProductGrid({
  products,
  loading,
  error,
  onRetry,
  emptyMessage,
}: {
  products?: ProductCardData[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  emptyMessage?: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8">
        <ErrorState
          title="Failed to load products"
          message="Something went wrong while fetching products."
          onRetry={onRetry}
          action={{ label: "Try again", to: window.location.pathname }}
        />
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          icon={<ShoppingBag className="size-10" />}
          title={emptyMessage ?? "No products found"}
          description="We couldn't find any products matching your criteria. Try adjusting your filters or browse all products."
          action={{ label: "View all products", to: "/products" }}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
