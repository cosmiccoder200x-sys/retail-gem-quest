import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";
import { OrderTimeline } from "@/components/orders/OrderTimeline";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track your order — GullyGadget" },
      {
        name: "description",
        content:
          "Track your GullyGadget order status, carrier and tracking number using your order ID and email.",
      },
      { property: "og:title", content: "Track your GullyGadget order" },
      {
        property: "og:description",
        content: "Enter your order ID and email to view live shipping status.",
      },
    ],
  }),
  component: TrackPage,
});

type LookupRow = {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  created_at: string;
  tracking_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  forwarding_status: string | null;
  fulfillment_status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  customer_email: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  expected_delivery_date: string | null;
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function TrackPage() {
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupRow | null>(null);
  const [searched, setSearched] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim() || !email.trim()) {
      toast.error("Please enter both order ID and email.");
      return;
    }
    setLoading(true);
    setSearched(true);
    const trimmed = orderId.trim();
    // lookup_order has two overloads: UUID and TEXT (order_number)
    const rpcArgs = isUuid(trimmed)
      ? { _order_id: trimmed, _email: email.trim() }
      : { _order_number: trimmed, _email: email.trim() };
    const { data, error } = await supabase.rpc("lookup_order", rpcArgs as never);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      setResult(null);
      return;
    }
    const row = Array.isArray(data) ? data[0] : null;
    setResult((row as LookupRow) ?? null);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Track your order</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the order ID or order number from your confirmation email and the email used at checkout.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orderId">Order ID or Order Number</Label>
            <Input
              id="orderId"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. ORD-2026-000001 or 1a2b3c4d-..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Searching..." : "Track order"}
          </Button>
        </form>
      </Card>

      {searched && !loading && !result && (
        <Card className="mt-6 p-6 text-center text-sm text-muted-foreground">
          No order found. Double-check your order ID/number and email.
        </Card>
      )}

      {result && (
        <Card className="mt-6 space-y-5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Order</div>
              <div className="font-mono text-sm">{result.order_number ?? result.id}</div>
              {result.order_number && <div className="font-mono text-xs text-muted-foreground">{result.id.slice(0, 8)}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground">Total</div>
              <div className="font-semibold">{formatINR(Number(result.total))}</div>
              <div className="text-xs text-muted-foreground capitalize">{result.payment_method} · {result.payment_status}</div>
            </div>
          </div>

          <OrderTimeline
            createdAt={result.created_at}
            forwardedAt={result.forwarding_status === "forwarded" ? result.created_at : null}
            shippedAt={result.shipped_at}
            deliveredAt={result.delivered_at}
            expectedDeliveryDate={result.expected_delivery_date}
            fulfillmentStatus={result.fulfillment_status}
            forwardingStatus={result.forwarding_status}
            orderStatus={result.status}
            paymentStatus={result.payment_status}
            hasTracking={!!result.tracking_number}
            carrier={result.tracking_carrier}
            trackingNumber={result.tracking_number}
            trackingUrl={result.tracking_url}
          />

          <div className="grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Order Status</div>
              <div className="font-medium capitalize">{result.status}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Forwarding</div>
              <div className="font-medium capitalize">{result.forwarding_status ?? "pending"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Carrier</div>
              <div className="font-medium">{result.tracking_carrier ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Tracking #</div>
              <div className="font-medium font-mono text-xs">{result.tracking_number ?? "—"}</div>
            </div>
          </div>

          {result.tracking_url && (
            <a
              href={result.tracking_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Track with carrier
            </a>
          )}

          <p className="text-xs text-muted-foreground">
            Placed on {new Date(result.created_at).toLocaleString()}
            {result.order_number && (
              <>
                {" · "}
                <Link to="/track" className="underline">
                  Tracking link for this order
                </Link>
              </>
            )}
          </p>
        </Card>
      )}
    </div>
  );
}
