import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { useWishlist, useToggleWishlist, useAddToCart } from "@/lib/cart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProductTile } from "@/components/ProductTile";
import { formatINR } from "@/lib/format";
import { Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "My Account — GullyGadget" }] }),
  component: Account,
});

function Account() {
  const { user } = useAuth();
  const { data: wishlist } = useWishlist(!!user);
  const addToCart = useAddToCart();
  const toggleWish = useToggleWishlist();

  const { data: orders } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="mb-2 font-display text-4xl uppercase">My Account</h1>
      <p className="mb-8 text-muted-foreground">{user?.email}</p>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6 space-y-4">
          {(orders ?? []).length === 0 && (
            <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-brand/5">
              <p className="text-muted-foreground">No orders yet.</p>
              <Button asChild className="mt-4 rounded-full"><Link to="/products">Shop now</Link></Button>
            </div>
          )}
          {(orders ?? []).map((o) => (
            <div key={o.id} className="rounded-3xl bg-white p-6 ring-1 ring-brand/5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Order</p>
                  <p className="font-mono text-sm">#{o.id.slice(0, 8)}</p>
                </div>
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold uppercase text-brand">{o.status}</span>
                <span className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
                <span className="font-display text-xl italic">{formatINR(Number(o.total))}</span>
              </div>
              <div className="space-y-1 text-sm">
                {o.order_items?.map((it) => (
                  <div key={it.id} className="flex justify-between text-muted-foreground">
                    <span>{it.product_name} × {it.quantity}</span>
                    <span>{formatINR(Number(it.price) * it.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="wishlist" className="mt-6">
          {(wishlist ?? []).length === 0 && (
            <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-brand/5">
              <p className="text-muted-foreground">Your wishlist is empty.</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(wishlist ?? []).map((w) => {
              const p = w.product as { id: string; name: string; slug: string; price: number; mrp: number | null; image_url: string | null };
              return (
                <div key={w.id} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-brand/5">
                  <Link to="/products/$slug" params={{ slug: p.slug }} className="size-20 shrink-0 overflow-hidden rounded-xl bg-background">
                    <ProductTile name={p.name} imageUrl={p.image_url} />
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <Link to="/products/$slug" params={{ slug: p.slug }} className="font-bold hover:text-accent-cyan line-clamp-1">{p.name}</Link>
                    <p className="font-display italic">{formatINR(p.price)}</p>
                    <div className="mt-auto flex gap-2">
                      <Button size="sm" onClick={() => addToCart.mutate({ productId: p.id })} className="flex-1 rounded-full"><ShoppingBag className="size-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleWish.mutate(p.id)}><Trash2 className="size-3" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}