import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

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
  status: string;
  total: number;
  created_at: string;
  tracking_carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  forwarding_status: string | null;
};

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
    const { data, error } = await supabase.rpc("lookup_order", {
      _order_id: orderId.trim(),
      _email: email.trim(),
    });
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
        Enter the order ID from your confirmation email and the email used at checkout.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orderId">Order ID</Label>
            <Input
              id="orderId"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. 1a2b3c4d-..."
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
          No order found. Double-check your order ID and email.
        </Card>
      )}

      {result && (
        <Card className="mt-6 space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Order</div>
              <div className="font-mono text-sm">{result.id}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground">Total</div>
              <div className="font-semibold">{formatINR(Number(result.total))}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Status" value={result.status} />
            <Field label="Fulfillment" value={result.forwarding_status ?? "pending"} />
            <Field label="Carrier" value={result.tracking_carrier ?? "—"} />
            <Field label="Tracking #" value={result.tracking_number ?? "—"} />
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
          </p>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}