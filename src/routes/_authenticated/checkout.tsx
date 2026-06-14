import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useCart } from "@/lib/cart";
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ full_name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" });
  const [busy, setBusy] = useState(false);

  const subtotal = (items ?? []).reduce((n, i) => n + i.product.price * i.quantity, 0);
  const shipping = subtotal > 499 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;

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
    setBusy(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          user_id: user!.id,
          subtotal,
          shipping,
          total,
          shipping_address: parsed.data,
          payment_method: "cod",
          status: "confirmed",
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsErr } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          product_id: i.product.id,
          product_name: i.product.name,
          product_image: i.product.image_url,
          price: i.product.price,
          quantity: i.quantity,
        })),
      );
      if (itemsErr) throw itemsErr;

      await supabase.from("cart_items").delete().eq("user_id", user!.id);
      qc.invalidateQueries({ queryKey: ["cart"] });
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
      <form onSubmit={place} className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4 rounded-3xl bg-white p-6 ring-1 ring-brand/5">
          <h2 className="font-display text-xl uppercase">Shipping Address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
            <div className="sm:col-span-2"><Label>Address Line 1</Label><Input value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required /></div>
            <div className="sm:col-span-2"><Label>Line 2 (optional)</Label><Input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></div>
            <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required /></div>
            <div><Label>Pincode</Label><Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} required /></div>
          </div>
          <div className="rounded-2xl bg-brand-soft p-4 text-sm">
            <p className="font-bold">Payment: Cash on Delivery</p>
            <p className="text-muted-foreground">Pay when your order arrives. No advance payment needed.</p>
          </div>
        </div>
        <aside className="space-y-4 rounded-3xl bg-white p-6 ring-1 ring-brand/5">
          <h3 className="font-display text-xl uppercase">Summary</h3>
          <div className="space-y-2 text-sm">
            {(items ?? []).map((i) => (
              <div key={i.id} className="flex justify-between">
                <span className="line-clamp-1">{i.product.name} × {i.quantity}</span>
                <span>{formatINR(i.product.price * i.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 flex justify-between"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : formatINR(shipping)}</span></div>
            <div className="flex justify-between font-display text-xl"><span>Total</span><span>{formatINR(total)}</span></div>
          </div>
          <Button type="submit" disabled={busy} size="lg" className="w-full rounded-full bg-brand font-bold uppercase tracking-tighter hover:bg-accent-cyan">
            {busy ? "Placing…" : "Place Order"}
          </Button>
        </aside>
      </form>
    </div>
  );
}