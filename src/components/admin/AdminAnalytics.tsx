import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

function rangeFrom(filter: string): string | null {
  const now = new Date();
  if (filter === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  if (filter === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }
  if (filter === "month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return s.toISOString();
  }
  return null;
}

export function AdminAnalytics() {
  const [range, setRange] = useState("30d");
  const from = useMemo(() => rangeFrom(range), [range]);

  const { data: orders } = useQuery({
    queryKey: ["analytics-orders", from],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("total, payment_status, payment_method, status, fulfillment_status, created_at");
      if (from) q = q.gte("created_at", from);
      const { data } = await q.order("created_at", { ascending: true }).limit(2000);
      return data ?? [];
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["analytics-top-products", from],
    queryFn: async () => {
      // Fetch order_items joined with orders filtered by date
      let orderIds: string[] | null = null;
      if (from) {
        const { data: ords } = await supabase
          .from("orders")
          .select("id")
          .gte("created_at", from)
          .eq("status", "cancelled")
          .limit(1);
        // Actually need non-cancelled ids — fetch all ids then filter
        const { data: all } = await supabase
          .from("orders")
          .select("id, status")
          .gte("created_at", from)
          .limit(2000);
        orderIds = (all ?? []).filter((o) => o.status !== "cancelled").map((o) => o.id);
        if (orderIds.length === 0) return [];
      }
      let q = supabase.from("order_items").select("product_name, product_id, quantity, unit_price");
      if (orderIds) q = q.in("order_id", orderIds);
      const { data } = await q.limit(2000);
      const map = new Map<
        string,
        { name: string; units: number; revenue: number; orders: Set<string> }
      >();
      for (const r of data ?? []) {
        const key = r.product_id ?? r.product_name;
        const entry = map.get(key) ?? {
          name: r.product_name,
          units: 0,
          revenue: 0,
          orders: new Set(),
        };
        entry.units += r.quantity;
        entry.revenue += Number(r.unit_price) * r.quantity;
        if (r.product_id) entry.orders.add(r.product_id);
        map.set(key, entry);
      }
      return Array.from(map.values())
        .map((v) => ({ name: v.name, units: v.units, revenue: v.revenue, orders: v.orders.size }))
        .sort((a, b) => b.units - a.units)
        .slice(0, 8);
    },
  });

  const { data: categoryData } = useQuery({
    queryKey: ["analytics-categories", from],
    queryFn: async () => {
      const { data: prods } = await supabase.from("products").select("id, category_id");
      const catMap = new Map(prods?.map((p) => [p.id, p.category_id]) ?? []);
      const { data: cats } = await supabase.from("categories").select("id, name");
      const catName = new Map(cats?.map((c) => [c.id, c.name]) ?? []);
      let orderIds: string[] | null = null;
      if (from) {
        const { data: all } = await supabase
          .from("orders")
          .select("id, status")
          .gte("created_at", from)
          .limit(2000);
        orderIds = (all ?? []).filter((o) => o.status !== "cancelled").map((o) => o.id);
        if (!orderIds.length) return [];
      }
      let q = supabase.from("order_items").select("product_id, quantity, unit_price");
      if (orderIds) q = q.in("order_id", orderIds);
      const { data } = await q.limit(2000);
      const agg = new Map<string, number>();
      for (const r of data ?? []) {
        const catId = catMap.get(r.product_id ?? "");
        const name = catId ? (catName.get(catId) ?? "Uncategorized") : "Uncategorized";
        agg.set(name, (agg.get(name) ?? 0) + Number(r.unit_price) * r.quantity);
      }
      return Array.from(agg.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6);
    },
  });

  const chartData = useMemo(() => {
    if (!orders?.length) return [];
    const byDay = new Map<string, { date: string; revenue: number; orders: number }>();
    for (const o of orders) {
      if (o.status === "cancelled" || o.payment_status === "failed") continue;
      // Revenue counts only paid or COD not cancelled? Use paid for revenue line, but chart shows successful revenue
      const isPaid = o.payment_status === "paid";
      if (!isPaid && o.payment_method !== "cod") continue;
      if (o.payment_method === "cod" && (o.status as string) === "cancelled") continue;
      // For chart, count revenue only for paid + COD (since COD is expected revenue)
      const day = new Date(o.created_at).toISOString().slice(0, 10);
      const entry = byDay.get(day) ?? { date: day, revenue: 0, orders: 0 };
      // Use paidRevenue logic: paid + COD (not cancelled) counts
      const revenue = Number(o.total);
      entry.revenue += revenue;
      entry.orders += 1;
      byDay.set(day, entry);
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [orders]);

  const avgOrderValue = useMemo(() => {
    if (!orders?.length) return 0;
    const paid = orders.filter((o) => o.payment_status === "paid");
    const sum = paid.reduce((s, o) => s + Number(o.total), 0);
    return paid.length ? sum / paid.length : 0;
  }, [orders]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders ?? [])
      if (o.status !== "cancelled") map.set(o.payment_method, (map.get(o.payment_method) ?? 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders ?? []) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [orders]);

  if (!orders) return <p className="mt-6 text-sm text-muted-foreground">Loading analytics…</p>;

  if (orders.length === 0) {
    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl uppercase">Sales Analytics</h2>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="ml-auto w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-border">
          <p className="text-sm text-muted-foreground">No sales in this period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl uppercase">Sales Analytics</h2>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="ml-auto w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Avg order value
          </p>
          <p className="mt-1 font-display text-xl">{formatINR(avgOrderValue)}</p>
          <p className="text-xs text-muted-foreground">paid orders only</p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Orders in period
          </p>
          <p className="mt-1 font-display text-xl">
            {orders.filter((o) => o.status !== "cancelled").length}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-border">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Successful revenue cutoff
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Excludes cancelled/failed. COD counts as expected revenue.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-4 ring-1 ring-border">
        <h3 className="font-bold text-sm mb-3">Revenue & Orders over time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, n: string) => (n === "revenue" ? formatINR(v) : v)} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#0e7490"
                strokeWidth={2}
                dot={false}
                name="revenue"
              />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                name="orders"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-4 ring-1 ring-border">
          <h3 className="font-bold text-sm mb-3">Top-selling products (units)</h3>
          {topProducts?.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="units" fill="#0e7490" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No product sales yet.</p>
          )}
          {topProducts?.length ? (
            <div className="mt-3 space-y-1 text-xs">
              {topProducts.map((p) => (
                <div key={p.name} className="flex justify-between">
                  <span className="truncate pr-2">{p.name}</span>
                  <span>
                    {p.units} units · {formatINR(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="rounded-3xl bg-white p-4 ring-1 ring-border">
          <h3 className="font-bold text-sm mb-3">Top categories (revenue)</h3>
          {categoryData?.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="revenue" fill="#0891b2" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No category sales yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-4 ring-1 ring-border">
          <h3 className="font-bold text-sm mb-3">Payment method</h3>
          <div className="space-y-2 text-sm">
            {paymentBreakdown.map((p) => (
              <div key={p.name} className="flex justify-between">
                <span className="capitalize">{p.name}</span>
                <span>{p.value}</span>
              </div>
            ))}{" "}
            {paymentBreakdown.length === 0 && <p className="text-muted-foreground">No data</p>}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-4 ring-1 ring-border">
          <h3 className="font-bold text-sm mb-3">Order status</h3>
          <div className="space-y-2 text-sm">
            {statusBreakdown.map((p) => (
              <div key={p.name} className="flex justify-between">
                <span className="capitalize">{p.name}</span>
                <span>{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
