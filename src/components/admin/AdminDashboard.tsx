import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function rangeFor(filter: string): { from: string | null } {
  const now = new Date();
  if (filter === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString() };
  }
  if (filter === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { from: d.toISOString() };
  }
  if (filter === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return { from: d.toISOString() };
  }
  if (filter === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString() };
  }
  return { from: null };
}

export function AdminDashboard() {
  const [range, setRange] = useState("30d");
  const { from } = useMemo(() => rangeFor(range), [range]);

  const { data: orders } = useQuery({
    queryKey: ["dashboard-orders", from],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("total, status, payment_status, payment_method, created_at, user_id");
      if (from) q = q.gte("created_at", from);
      const { data } = await q.limit(2000);
      return data ?? [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["dashboard-customers"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: productsInfo } = useQuery({
    queryKey: ["dashboard-products"],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true });
      const { data: low } = await supabase.from("products").select("id").lte("stock", 5);
      const lowCount = low?.length ?? 0;
      const { data: cfg } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "low_stock_threshold")
        .maybeSingle();
      const threshold = cfg ? Number(cfg.value as unknown) : 5;
      return { total: total ?? 0, lowCount, threshold };
    },
  });

  const metrics = useMemo(() => {
    const list = orders ?? [];
    const gross = list
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total), 0);
    const paidRevenue = list
      .filter((o) => o.payment_status === "paid")
      .reduce((s, o) => s + Number(o.total), 0);
    const codValue = list
      .filter((o) => o.payment_method === "cod" && o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total), 0);
    const paidOrders = list.filter((o) => o.payment_status === "paid").length;
    const codOrders = list.filter((o) => o.payment_method === "cod").length;
    const pending = list.filter((o) => o.status === "pending").length;
    const delivered = list.filter(
      (o: any) => o.fulfillment_status === "delivered" || o.status === "delivered",
    ).length;
    const cancelled = list.filter((o) => o.status === "cancelled").length;
    return {
      gross,
      paidRevenue,
      codValue,
      total: list.length,
      paidOrders,
      codOrders,
      pending,
      delivered,
      cancelled,
    };
  }, [orders]);

  if (!orders) return <p className="mt-6 text-sm text-muted-foreground">Loading dashboard…</p>;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl uppercase">Overview</h2>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="ml-auto w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-border">
          <p className="text-sm text-muted-foreground">No orders in this period.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Gross order value"
              value={formatINR(metrics.gross)}
              sub={`${metrics.total} orders`}
            />
            <Metric
              label="Paid revenue"
              value={formatINR(metrics.paidRevenue)}
              sub={`${metrics.paidOrders} paid`}
              highlight
            />
            <Metric
              label="COD value"
              value={formatINR(metrics.codValue)}
              sub={`${metrics.codOrders} COD`}
            />
            <Metric
              label="Avg order value"
              value={formatINR(
                metrics.total ? metrics.paidRevenue / Math.max(metrics.paidOrders, 1) : 0,
              )}
              sub="paid avg"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Orders" value={String(metrics.total)} />
            <Metric label="Pending" value={String(metrics.pending)} />
            <Metric label="Delivered" value={String(metrics.delivered)} />
            <Metric label="Cancelled" value={String(metrics.cancelled)} />
            <Metric label="Customers" value={String(customers ?? 0)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Products" value={String(productsInfo?.total ?? 0)} />
            <Metric
              label="Low stock"
              value={String(productsInfo?.lowCount ?? 0)}
              sub={`threshold ≤ ${productsInfo?.threshold ?? 5}`}
              alert={(productsInfo?.lowCount ?? 0) > 0}
            />
            <Metric
              label="Paid orders"
              value={String(metrics.paidOrders)}
              sub={`${((metrics.paidOrders / Math.max(metrics.total, 1)) * 100).toFixed(0)}% of orders`}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ring-1 ${highlight ? "bg-brand text-brand-foreground ring-brand" : alert ? "bg-amber-50 ring-amber-200" : "bg-white ring-border"}`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-widest ${highlight ? "text-brand-foreground/80" : alert ? "text-amber-700" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      {sub && (
        <p
          className={`text-xs ${highlight ? "text-brand-foreground/70" : "text-muted-foreground"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
