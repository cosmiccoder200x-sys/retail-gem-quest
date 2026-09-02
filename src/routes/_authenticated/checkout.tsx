import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { z } from "zod";
import { useCart, useValidateCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Banknote, ShieldCheck, Loader2 } from "lucide-react";

type PaymentMethod = "cod" | "online";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: { contact?: string; email?: string };
  theme: { color: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: { error: { description: string } }) => void) => void;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const processingRef = useRef(false);

  const subtotal = (items ?? []).reduce((n, i) => {
    const price = i.variant?.price ?? i.product.price;
    return n + price * i.quantity;
  }, 0);
  const shipping = subtotal > 499 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;

  const hasValidationErrors = validation?.some((v: { is_valid: boolean }) => !v.is_valid);
  const validationError = validation?.find(
    (v: { is_valid: boolean; error_message?: string }) => !v.is_valid
  )?.error_message;

  const openRazorpay = useCallback(
    async (orderId: string) => {
      // Load Razorpay script
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      document.body.appendChild(script);

      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
      });

      // Create Razorpay order via Edge Function
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

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

      // Open Razorpay checkout
      const options: RazorpayOptions = {
        key: key_id,
        amount: amount,
        currency: currency,
        name: "GullyGadget",
        description: `Order #${orderId.slice(0, 8)}`,
        order_id: razorpay_order_id,
        handler: async (response: RazorpayResponse) => {
          // Payment successful — verify server-side
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

            if (!verifyRes.ok) {
              const err = await verifyRes.json();
              throw new Error(err.error || "Payment verification failed");
            }

            qc.invalidateQueries({ queryKey: ["cart"] });
            qc.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Payment successful!");
            navigate({ to: "/order-confirmation/$orderId", params: { orderId } });
          } catch (err) {
            toast.error(
              err instanceof Error
                ? `Payment verified but update failed: ${err.message}. Contact support.`
                : "Payment completed but update failed. Contact support."
            );
            // Still navigate to confirmation — webhook will handle final status
            navigate({ to: "/order-confirmation/$orderId", params: { orderId } });
          }
        },
        prefill: {
          contact: form.phone,
          email: user?.email ?? "",
        },
        theme: { color: "#0891b2" },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled. You can retry from your orders.");
            navigate({ to: "/account", hash: "orders" });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: { error: { description: string } }) => {
        toast.error(`Payment failed: ${response.error.description}`);
        setBusy(false);
        processingRef.current = false;
      });
      rzp.open();
    },
    [form.phone, user?.email, qc, navigate]
  );

  const place = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double submission
    if (processingRef.current || busy) return;

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

    processingRef.current = true;
    setBusy(true);

    try {
      const orderItems = items.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id ?? null,
        quantity: i.quantity,
      }));

      const { data: orderId, error } = await supabase.rpc("create_order_with_stock_check", {
        p_user_id: user!.id,
        p_items: orderItems,
        p_shipping_address: parsed.data,
        p_payment_method: paymentMethod === "online" ? "online" : "cod",
        p_coupon_code: null,
        p_customer_email: user!.email!,
      });

      if (error) throw error;

      if (paymentMethod === "online") {
        // Open Razorpay checkout
        await openRazorpay(orderId);
        // Don't reset busy here — Razorpay callback will handle it
      } else {
        // COD — order placed successfully
        qc.invalidateQueries({ queryKey: ["cart"] });
        qc.invalidateQueries({ queryKey: ["orders"] });
        toast.success("Order placed! Pay on delivery.");
        navigate({ to: "/order-confirmation/$orderId", params: { orderId } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Order failed");
      setBusy(false);
      processingRef.current = false;
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
        <div className="space-y-6">
          {/* Shipping Address */}
          <div className="rounded-3xl bg-white p-6 ring-1 ring-brand/5">
            <h2 className="font-display text-xl uppercase mb-4">Shipping Address</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Address Line 1</Label>
                <Input
                  value={form.line1}
                  onChange={(e) => setForm({ ...form, line1: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Line 2 (optional)</Label>
                <Input
                  value={form.line2}
                  onChange={(e) => setForm({ ...form, line2: e.target.value })}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input
                  value={form.pincode}
                  onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="rounded-3xl bg-white p-6 ring-1 ring-brand/5">
            <h2 className="font-display text-xl uppercase mb-4">Payment Method</h2>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="space-y-3"
            >
              <label
                htmlFor="online"
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 cursor-pointer transition-colors ${
                  paymentMethod === "online"
                    ? "border-brand bg-brand-soft"
                    : "border-border hover:border-brand/50"
                }`}
              >
                <RadioGroupItem value="online" id="online" />
                <CreditCard className="size-5 text-brand" />
                <div className="flex-1">
                  <p className="font-bold">Online Payment</p>
                  <p className="text-xs text-muted-foreground">
                    UPI / Cards / Net Banking via Razorpay
                  </p>
                </div>
                <ShieldCheck className="size-4 text-muted-foreground" />
              </label>

              <label
                htmlFor="cod"
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 cursor-pointer transition-colors ${
                  paymentMethod === "cod"
                    ? "border-brand bg-brand-soft"
                    : "border-border hover:border-brand/50"
                }`}
              >
                <RadioGroupItem value="cod" id="cod" />
                <Banknote className="size-5 text-success" />
                <div className="flex-1">
                  <p className="font-bold">Cash on Delivery</p>
                  <p className="text-xs text-muted-foreground">
                    Pay when your order arrives
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>

        {/* Order Summary */}
        <aside className="rounded-3xl bg-white p-6 ring-1 ring-brand/5 h-fit sm:sticky sm:top-24">
          <h3 className="font-display text-xl uppercase">Summary</h3>
          <div className="space-y-2 text-sm">
            {(items ?? []).map((i) => {
              const price = i.variant?.price ?? i.product.price;
              const name = i.variant?.attributes
                ? `${i.product.name} (${Object.values(i.variant.attributes as Record<string, string>).join(", ")})`
                : i.product.name;
              return (
                <div key={i.id} className="flex justify-between">
                  <span className="line-clamp-1">
                    {name} × {i.quantity}
                  </span>
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
          <Button
            type="submit"
            disabled={busy || hasValidationErrors}
            size="lg"
            className="w-full rounded-full bg-brand font-bold uppercase tracking-tighter hover:bg-accent-cyan mt-4"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {paymentMethod === "online" ? "Processing…" : "Placing…"}
              </>
            ) : paymentMethod === "online" ? (
              `Pay ${formatINR(total)}`
            ) : (
              "Place COD Order"
            )}
          </Button>
          {paymentMethod === "online" && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              <ShieldCheck className="inline size-3 mr-1" />
              Secured by Razorpay. Test mode.
            </p>
          )}
        </aside>
      </form>
    </div>
  );
}
