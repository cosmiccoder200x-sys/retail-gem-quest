import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { useWishlist, useToggleWishlist, useAddToCart } from "@/lib/cart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProductTile } from "@/components/product/ProductTile";
import { formatINR } from "@/lib/format";
import { Trash2, ShoppingBag, RefreshCw, CreditCard } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, h: (r: unknown) => void) => void };
  }
}

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "My Account — GullyGadget" }] }),
  component: Account,
});

function Account() {
  const { user } = useAuth();
  const { data: wishlist } = useWishlist(!!user);
  const addToCart = useAddToCart();
  const toggleWish = useToggleWishlist();
  const qc = useQueryClient();

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

  const [retryingId, setRetryingId] = useState<string | null>(null);

  const retryPayment = useCallback(
    async (orderId: string) => {
      if (retryingId) return;
      setRetryingId(orderId);

      try {
        // Load Razorpay script
        if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          document.body.appendChild(script);
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
          });
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        // Create Razorpay order
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-razorpay-order`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ order_id: orderId }),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create Razorpay order");
        }

        const { razorpay_order_id, amount, currency, key_id } = await res.json();

        const rzp = new window.Razorpay({
          key: key_id,
          amount,
          currency,
          name: "GullyGadget",
          description: `Order #${orderId.slice(0, 8)}`,
          order_id: razorpay_order_id,
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verifyRes = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-razorpay-payment`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    order_id: orderId,
                  }),
                }
              );

              if (!verifyRes.ok) throw new Error("Verification failed");

              qc.invalidateQueries({ queryKey: ["orders"] });
              toast.success("Payment successful!");
            } catch {
              toast.success("Payment received. Status will update shortly.");
              qc.invalidateQueries({ queryKey: ["orders"] });
            }
          },
          prefill: { email: user?.email ?? "" },
          theme: { color: "#0891b2" },
          modal: {
            ondismiss: () => {
              toast.info("Payment cancelled. You can retry anytime.");
              setRetryingId(null);
            },
          },
        });

        rzp.on("payment.failed", (response: { error: { description: string } }) => {
          toast.error(`Payment failed: ${response.error.description}`);
          setRetryingId(null);
        });

        rzp.open();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Retry failed");
        setRetryingId(null);
      }
    },
    [retryingId, user?.email, qc]
  );

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
            <EmptyState
              icon={<ShoppingBag className="size-8 mb-3" />}
              title="No orders yet"
              description="Place your first order to track deliveries and view order history."
              action={{ label: "Shop now", to: "/products" }}
            />
          )}
          {(orders ?? []).map((o) => {
            const isUnpaid =
              o.payment_method === "online" &&
              o.payment_status !== "paid" &&
              o.status !== "cancelled";
            return (
              <div key={o.id} className="rounded-3xl bg-white p-6 ring-1 ring-border">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Order
                    </p>
                    <Link
                      to="/order-confirmation/$orderId"
                      params={{ orderId: o.id }}
                      className="font-mono text-sm hover:text-accent-cyan"
                    >
                      #{o.order_number || o.id.slice(0, 8)}
                    </Link>
                  </div>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold uppercase text-brand capitalize">
                    {o.status}
                  </span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
                    {o.payment_method === "cod" ? "COD" : "Online"}
                  </span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
                    {o.payment_status}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()}
                  </span>
                  <span className="font-display text-xl italic">{formatINR(Number(o.total))}</span>
                </div>
                <div className="space-y-1 text-sm">
                  {o.order_items?.map((it: Record<string, unknown>) => (
                    <div key={it.id as string} className="flex justify-between text-muted-foreground">
                      <span>
                        {it.product_name as string} × {it.quantity as number}
                      </span>
                      <span>{formatINR((it.price as number) * (it.quantity as number))}</span>
                    </div>
                  ))}
                </div>
                {isUnpaid && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <Button
                      size="sm"
                      onClick={() => retryPayment(o.id)}
                      disabled={retryingId === o.id}
                      className="rounded-full bg-brand hover:bg-accent-cyan"
                    >
                      {retryingId === o.id ? (
                        <RefreshCw className="mr-2 size-3 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 size-3" />
                      )}
                      Retry Payment
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="wishlist" className="mt-6">
          {(wishlist ?? []).length === 0 && (
            <EmptyState
              icon={<span className="text-3xl">❤</span>}
              title="Your wishlist is empty"
              description="Save products you love here for later."
              action={{ label: "Continue Shopping", to: "/products" }}
            />
          )}
          {(wishlist ?? []).map((w) => {
            const p = w.product as {
              id: string;
              name: string;
              slug: string;
              price: number;
              mrp: number | null;
              image_url: string | null;
            };
            return (
              <div key={w.id} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-border">
                <Link
                  to="/products/$slug"
                  params={{ slug: p.slug }}
                  className="size-20 shrink-0 overflow-hidden rounded-xl bg-background"
                >
                  <ProductTile name={p.name} imageUrl={p.image_url} />
                </Link>
                <div className="flex flex-1 flex-col">
                  <Link
                    to="/products/$slug"
                    params={{ slug: p.slug }}
                    className="font-bold hover:text-accent-cyan line-clamp-1"
                  >
                    {p.name}
                  </Link>
                  <p className="font-display italic">{formatINR(p.price)}</p>
                  <div className="mt-auto flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => addToCart.mutate({ product_id: p.id })}
                      className="flex-1 rounded-full"
                    >
                      <ShoppingBag className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleWish.mutate({ product_id: w.product_id })}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
