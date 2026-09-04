import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string;
  created_at: string;
  orderCount: number;
  totalValue: number;
  lastOrder: string | null;
};

export function AdminCustomers() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  const { data: customers, isPending } = useQuery({
    queryKey: ["admin-customers", search],
    queryFn: async () => {
      // Fetch profiles + auth emails via profiles join; for email we need to get from orders customer_email or profiles? Use profiles + orders aggregation
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      // Fetch orders aggregated per user
      const { data: orders } = await supabase
        .from("orders")
        .select("user_id, total, created_at, customer_email")
        .limit(2000);
      const agg = new Map<
        string,
        { count: number; total: number; last: string | null; email: string | null }
      >();
      for (const o of orders ?? []) {
        const cur = agg.get(o.user_id) ?? { count: 0, total: 0, last: null, email: null };
        cur.count += 1;
        cur.total += Number(o.total);
        if (!cur.last || new Date(o.created_at) > new Date(cur.last)) cur.last = o.created_at;
        if (!cur.email && o.customer_email) cur.email = o.customer_email;
        agg.set(o.user_id, cur);
      }
      const rows: CustomerRow[] = (profiles ?? []).map((p) => {
        const a = agg.get(p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          email: a?.email ?? "",
          created_at: p.created_at,
          orderCount: a?.count ?? 0,
          totalValue: a?.total ?? 0,
          lastOrder: a?.last ?? null,
        };
      });
      // Include customers who have orders but no profile? Add them
      for (const [userId, a] of agg.entries()) {
        if (!rows.find((r) => r.id === userId)) {
          rows.push({
            id: userId,
            full_name: null,
            email: a.email ?? "",
            created_at: a.last ?? new Date().toISOString(),
            orderCount: a.count,
            totalValue: a.total,
            lastOrder: a.last,
          });
        }
      }
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        return rows.filter(
          (r) =>
            (r.full_name?.toLowerCase().includes(term) ?? false) ||
            r.email.toLowerCase().includes(term) ||
            r.id.toLowerCase().includes(term),
        );
      }
      return rows.sort((a, b) => b.orderCount - a.orderCount).slice(0, 100);
    },
  });

  const { data: customerOrders } = useQuery({
    queryKey: ["customer-orders", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, payment_status, fulfillment_status, status, created_at")
        .eq("user_id", selected!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  if (isPending) return <p className="mt-6 text-sm text-muted-foreground">Loading customers…</p>;

  if (!customers?.length)
    return (
      <div className="mt-6 rounded-3xl bg-white p-8 text-center ring-1 ring-border">
        <p className="text-sm text-muted-foreground">No customers yet.</p>
      </div>
    );

  return (
    <div className="mt-6 space-y-4">
      <Input
        placeholder="Search name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Customer</th>
              <th className="p-3">Email</th>
              <th className="p-3">Orders</th>
              <th className="p-3">Total value</th>
              <th className="p-3">Last order</th>
              <th className="p-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.id}
                className="border-t border-border hover:bg-muted/20 cursor-pointer"
                onClick={() => setSelected(c)}
              >
                <td className="p-3">
                  <div className="font-medium">{c.full_name ?? "—"}</div>
                  <div className="text-xs font-mono text-muted-foreground">{c.id.slice(0, 8)}</div>
                </td>
                <td className="p-3 text-xs">{c.email || "—"}</td>
                <td className="p-3 text-center">{c.orderCount}</td>
                <td className="p-3">{formatINR(c.totalValue)}</td>
                <td className="p-3 text-xs">
                  {c.lastOrder ? new Date(c.lastOrder).toLocaleDateString() : "—"}
                </td>
                <td className="p-3 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="rounded-3xl bg-white p-6 ring-1 ring-border">
          <div className="flex items-center gap-3">
            <h3 className="font-bold">
              {selected.full_name ?? selected.email ?? selected.id.slice(0, 8)}
            </h3>
            <span className="text-xs text-muted-foreground">{selected.email}</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {selected.orderCount} orders · {formatINR(selected.totalValue)} total
          </p>
          <div className="mt-4 space-y-2">
            {(customerOrders ?? []).map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/30 p-3 text-sm"
              >
                <span className="font-mono text-xs">{o.order_number ?? o.id.slice(0, 8)}</span>
                <span className="text-xs capitalize">
                  {o.status} · {o.payment_status} · {o.fulfillment_status}
                </span>
                <span className="text-xs">{new Date(o.created_at).toLocaleDateString()}</span>
                <span className="font-medium">{formatINR(Number(o.total))}</span>
              </div>
            ))}
            {customerOrders?.length === 0 && (
              <p className="text-sm text-muted-foreground">No orders for this customer.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
