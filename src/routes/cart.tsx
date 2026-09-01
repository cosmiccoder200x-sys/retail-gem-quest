import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";
import { useCart, useRemoveFromCart, useUpdateCartQty } from "@/lib/cart";
import { ProductTile } from "@/components/product/ProductTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useState } from "react";
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
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);

  if (loading) return <div className="p-12 text-center">Loading…</div>;
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

  const subtotal = (items ?? []).reduce((n, i) => n + i.product.price * i.quantity, 0);
  const shipping = subtotal > 499 || subtotal === 0 ? 0 : 49;
  const total = subtotal - discount + shipping;

  const applyCoupon = () => {
    if (coupon.toUpperCase() === "GULLY10") setDiscount(Math.round(subtotal * 0.1));
    else if (coupon.toUpperCase() === "NEW50") setDiscount(50);
    else setDiscount(0);
  };

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
                <p className="text-sm text-muted-foreground">{formatINR(it.product.price)} each</p>
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
                    <span className="font-display text-lg italic">{formatINR(it.product.price * it.quantity)}</span>
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
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span>− {formatINR(discount)}</span>
              </div>
            )}
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : formatINR(shipping)}</span></div>
            <div className="flex justify-between font-display text-2xl"><span>Total</span><span>{formatINR(total)}</span></div>
          </div>
          <div className="border-t border-border pt-4">
            <div className="flex justify-between font-display text-xl">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>
          <Button asChild size="lg" className="w-full rounded-full bg-brand font-bold uppercase tracking-tighter hover:bg-accent-cyan">
            <Link to="/checkout">Checkout</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}