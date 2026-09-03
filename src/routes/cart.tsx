import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";
import { useCart, useRemoveFromCart, useUpdateCartQty } from "@/lib/cart";
import { ProductTile } from "@/components/product/ProductTile";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { formatINR } from "@/lib/format";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your Cart — GullyGadget" }] }),
  component: CartPage,
});

function CartPage() {
  const { user, loading } = useAuth();
  const { data: items } = useCart(!!user);
  const update = useUpdateCartQty();
  const remove = useRemoveFromCart();

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="mb-8 font-display text-4xl uppercase">Your Cart</h1>
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-brand/5 animate-pulse">
                <div className="size-24 rounded-xl bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                  <div className="h-8 bg-secondary rounded w-24 mt-auto" />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl bg-white p-6 ring-1 ring-brand/5 animate-pulse">
            <div className="h-6 bg-secondary rounded w-1/2 mb-4" />
            <div className="space-y-2">
              <div className="h-4 bg-secondary rounded" />
              <div className="h-4 bg-secondary rounded" />
              <div className="h-4 bg-secondary rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-3xl uppercase">Your Cart</h1>
        <p className="mt-4 text-muted-foreground">Sign in to view your cart</p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  const subtotal = (items ?? []).reduce((n, i) => {
    const price = i.variant?.price ?? i.product.price;
    return n + price * i.quantity;
  }, 0);
  // Cart shows subtotal + shipping preview; coupon is applied at checkout
  const shipping = subtotal > 499 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;

  if (!items || items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <EmptyState
          icon={<ShoppingCart className="size-10 mb-4" />}
          title="Your Cart is Waiting"
          description="Add some gadgets to see your cart total. We've got great deals on smart home, car and everyday gadgets."
          action={{ label: "Continue Shopping", to: "/products" }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="mb-8 font-display text-4xl uppercase">Your Cart</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-brand/5">
              <Link to="/products/$slug" params={{ slug: it.product.slug }} className="size-24 shrink-0 overflow-hidden rounded-xl bg-background">
                <ProductTile name={it.product.name} imageUrl={it.product.image_url} />
              </Link>
              <div className="flex flex-1 flex-col">
                <Link to="/products/$slug" params={{ slug: it.product.slug }} className="font-bold hover:text-accent-cyan">
                  {it.product.name}
                </Link>
                {it.variant?.attributes && (
                  <p className="text-xs text-muted-foreground">
                    {Object.entries(it.variant.attributes as Record<string, { name?: string; value?: string }>)
                      .filter(([, v]) => v?.value)
                      .map(([, v]) => v!.value)
                      .join(" · ")}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">{formatINR(it.variant?.price ?? it.product.price)} each</p>
                <div className="mt-auto flex items-center justify-between">
                  <div className="inline-flex items-center rounded-full bg-background ring-1 ring-border">
                    <button
                      onClick={() => update.mutate({ id: it.id, quantity: Math.max(1, it.quantity - 1) })}
                      className="grid size-8 place-items-center"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{it.quantity}</span>
                    <button
                      onClick={() => update.mutate({ id: it.id, quantity: it.quantity + 1 })}
                      className="grid size-8 place-items-center"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg italic">{formatINR(it.variant?.price ?? it.product.price) * it.quantity}</span>
                    <button
                      aria-label="Remove"
                      onClick={() => remove.mutate(it.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <aside className="space-y-4 rounded-3xl bg-white p-6 ring-1 ring-brand/5">
          <h3 className="font-display text-xl uppercase">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : formatINR(shipping)}</span></div>
            <div className="flex justify-between font-display text-xl border-t border-border pt-2"><span>Total</span><span>{formatINR(total)}</span></div>
            <p className="text-xs text-muted-foreground">Coupon can be applied at checkout.</p>
          </div>
          <Button asChild size="lg" className="w-full rounded-full bg-brand font-bold uppercase tracking-tighter hover:bg-accent-cyan">
            <Link to="/checkout">Checkout</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}