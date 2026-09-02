import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useCart, useValidateCart, type CartItemInput } from "@/lib/cart";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const schema = z.object({
  full_name: z.string().min(2).max(80),
  phone: z.string().min(10).max(15).regex(/^[0-9+ -]+$/),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: z.string().regex(/^[0-9]{6}$/, "6-digit pincode"),
});

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout — GullyGadget" }] }),
  component: Checkout,
});

function Checkout() {
  const { user } = useAuth();
  const { data: items } = useCart(!!user);
  const { data: validation } = useValidateCart(user?.id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [busy, setBusy] = useState(false);

  const subtotal = (items ?? []).reduce((n, i) => {
    const price = i.variant?.price ?? i.product.price;
    return n + price * i.quantity;
  }, 0);
  const shipping = subtotal > 499 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;

  const hasValidationErrors = validation?.some((v: { is_valid: boolean }) => !v.is_valid);
  const validationError = validation?.find((v: { is_valid: boolean; error_message?: string }) => !v.is_valid)?.error_message;

  const place = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!items || items.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (hasValidationErrors) {
      toast.error(validationError || "Some items in your cart are no longer available");
      return;
    }

    setBusy(true);
    try {
      // Build items array for the atomic function
      const orderItems: CartItemInput[] = items.map((i) => ({
        productId: i.product_id,
        variantId: i.variant_id ?? undefined,
        quantity: i.quantity,
      }));

      const { data: orderId, error } = await supabase.rpc("create_order_with_stock_check", {
        p_user_id: user!.id,
        p_items: orderItems,
        p_shipping_address: parsed.data,
        p_payment_method: "cod",
        p_coupon_code: null,
        p_customer_email: user!.email!,
      });

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order placed! Pay on delivery.");
      navigate({ to: "/account", hash: "orders" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="mb-8 font-display text-4xl uppercase">Checkout</h1>

      {hasValidationErrors && (
        <div className="mb-6 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
          {validationError || "Some items in your cart are no longer available. Please review your cart."}
        </div>
      )}

      <form onSubmit={place} className="grid gap-6 sm:grid-cols-[1fr_360px]">
        <div className="rounded-3xl bg-white p-6 ring-1 ring-brand/5">
          <h2 className="font-display text-xl uppercase mb-4">Shipping Address</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Full Name</Label>
              <Input
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Address Line 1</Label>
              <Input
                value={form.line1}
                onChange={(e) =>
                  setForm({ ...form, line1: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Line 2 (optional)</Label>
              <Input
                value={form.line2}
                onChange={(e) =>
                  setForm({ ...form, line2: e.target.value })
                }
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) =>
                  setForm({ ...form, city: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>State</Label>
              <Input
                value={form.state}
                onChange={(e) =>
                  setForm({ ...form, state: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label>Pincode</Label>
              <Input
                value={form.pincode}
                onChange={(e) =>
                  setForm({ ...form, pincode: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="rounded-2xl bg-brand-soft p-4 text-sm">
            <p className="font-bold">Payment: Cash on Delivery</p>
            <p className="text-muted-foreground">
              Pay when your order arrives. No advance payment needed.
            </p>
          </div>
        </div>

        <aside className="rounded-3xl bg-white p-6 ring-1 ring-brand/5">
          <h3 className="font-display text-xl uppercase">Summary</h3>
          <div className="space-y-2 text-sm">
            {(items ?? []).map((i) => {
              const price = i.variant?.price ?? i.product.price;
              const name = i.variant?.attributes
                ? `${i.product.name} (${Object.values(i.variant.attributes as Record<string, string>).join(", ")})`
                : i.product.name;
              return (
                <div key={i.id} className="flex justify-between">
                  <span className="line-clamp-1">{name} × {i.quantity}</span>
                  <span>{formatINR(price * i.quantity)}</span>
                </div>
              );
            })}
            <div className="border-t border-border pt-2 flex justify-between">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : formatINR(shipping)}</span>
            </div>
            <div className="flex justify-between font-display text-xl">
              <span>Total</span>
              <span>{formatINR(total)}</span>
            </div>
          </div>
          <Button type="submit" disabled={busy || hasValidationErrors} size="lg" className="w-full rounded-full bg-brand font-bold uppercase tracking-tighter hover:bg-accent-cyan">
            {busy ? "Placing…" : "Place Order"}
          </Button>
        </aside>
      </form>
    </div>
  );
}