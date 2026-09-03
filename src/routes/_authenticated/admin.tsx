import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/auth-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { AdminInventory } from "@/components/admin/AdminInventory";
import { AdminCustomers } from "@/components/admin/AdminCustomers";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — GullyGadget" }] }),
  component: Admin,
});

function Admin() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading } = useIsAdmin(user);

  if (isLoading) return <div className="p-12 text-center">Checking access…</div>;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <h1 className="font-display text-2xl uppercase">Admin Only</h1>
        <p className="mt-2 text-muted-foreground">Your account doesn't have admin access.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-8 font-display text-4xl uppercase">Merchant Hub</h1>
      <Tabs defaultValue="dashboard">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="shipping">Shipping</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><AdminDashboard /></TabsContent>
        <TabsContent value="analytics"><AdminAnalytics /></TabsContent>
        <TabsContent value="orders"><AdminOrders /></TabsContent>
        <TabsContent value="products"><AdminProducts /></TabsContent>
        <TabsContent value="inventory"><AdminInventory /></TabsContent>
        <TabsContent value="customers"><AdminCustomers /></TabsContent>
        <TabsContent value="categories"><AdminCategories /></TabsContent>
        <TabsContent value="reviews"><AdminReviews /></TabsContent>
        <TabsContent value="coupons"><AdminCoupons /></TabsContent>
        <TabsContent value="shipping"><AdminShipping /></TabsContent>
        <TabsContent value="suppliers"><AdminSuppliers /></TabsContent>
      </Tabs>
    </div>
  );
}

function AdminOrders() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: suppliers } = useQuery({
    queryKey: ["admin-suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: orders, isPending } = useQuery({
    queryKey: ["admin-orders", filter, search],
    queryFn: async () => {
      let q = supabase.from("orders").select("*").order("created_at", { ascending: false });

      if (filter === "cod") q = q.eq("payment_method", "cod");
      else if (filter === "online") q = q.eq("payment_method", "online");
      else if (filter === "paid") q = q.eq("payment_status", "paid");
      else if (filter === "unpaid") q = q.eq("payment_status", "pending").eq("payment_method", "online");
      else if (filter === "failed") q = q.eq("payment_status", "failed");
      else if (filter === "refunded") q = q.eq("payment_status", "refunded");
      else if (filter === "fwd-pending") q = q.eq("forwarding_status", "pending");
      else if (filter === "fwd-forwarded") q = q.eq("forwarding_status", "forwarded");
      else if (filter === "fwd-failed") q = q.eq("forwarding_status", "failed");
      else if (filter === "ful-pending") q = q.eq("fulfillment_status", "pending");
      else if (filter === "ful-shipped") q = q.eq("fulfillment_status", "shipped");
      else if (filter === "ful-delivered") q = q.eq("fulfillment_status", "delivered");
      else if (filter !== "all") q = q.eq("status", filter);

      if (search) q = q.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%`);

      const { data } = await q.limit(100);
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("orders").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const forward = useMutation({
    mutationFn: async ({ id, supplierId }: { id: string; supplierId?: string }) => {
      const patch: Record<string, unknown> = {
        forwarding_status: "forwarded",
        forwarded_at: new Date().toISOString(),
        fulfillment_status: "processing",
      };
      if (supplierId) patch.supplier_id = supplierId;
      // Also confirm the order if still pending
      const order = orders?.find((o) => o.id === id);
      if (order?.status === "pending") patch.status = "confirmed";
      const { error } = await supabase.from("orders").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Forwarded to supplier");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkForward = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (ids.length === 0) throw new Error("No orders selected");
      // Only forward pending forwarding_status
      const pendingIds = ids.filter((id) => {
        const o = orders?.find((x) => x.id === id);
        return o?.forwarding_status === "pending";
      });
      if (pendingIds.length === 0) throw new Error("No pending orders selected");
      for (const id of pendingIds) {
        const order = orders?.find((o) => o.id === id);
        const patch: Record<string, unknown> = {
          forwarding_status: "forwarded",
          forwarded_at: new Date().toISOString(),
          fulfillment_status: "processing",
        };
        if (order?.status === "pending") patch.status = "confirmed";
        const { error } = await supabase.from("orders").update(patch as never).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Bulk forwarded");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filters = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
    { value: "paid", label: "Paid" },
    { value: "unpaid", label: "Unpaid (Online)" },
    { value: "failed", label: "Failed" },
    { value: "cod", label: "COD" },
    { value: "online", label: "Online" },
    { value: "refunded", label: "Refunded" },
    { value: "fwd-pending", label: "Fwd: Pending" },
    { value: "fwd-forwarded", label: "Fwd: Done" },
    { value: "fwd-failed", label: "Fwd: Failed" },
    { value: "ful-pending", label: "Ful: Pending" },
    { value: "ful-shipped", label: "Ful: Shipped" },
    { value: "ful-delivered", label: "Ful: Delivered" },
  ];

  return (
    <div className="mt-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search order # or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
        />
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
              className="rounded-full text-xs"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-brand-soft p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" className="rounded-full ml-auto" onClick={() => bulkForward.mutate()} disabled={bulkForward.isPending}>
            Forward selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Orders List */}
      {isPending && <p className="text-sm text-muted-foreground">Loading orders…</p>}
      {!isPending && (orders ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No orders match this filter.</p>
      )}
      {(orders ?? []).map((o) => (
        <OrderRow
          key={o.id}
          order={o}
          suppliers={suppliers ?? []}
          selected={selected.has(o.id)}
          onToggleSelect={(v) => {
            const next = new Set(selected);
            if (v) next.add(o.id);
            else next.delete(o.id);
            setSelected(next);
          }}
          onSave={(patch) => update.mutate({ id: o.id, patch })}
          onForward={(supplierId) => forward.mutate({ id: o.id, supplierId })}
        />
      ))}
    </div>
  );
}

function OrderRow({
  order,
  suppliers,
  selected,
  onToggleSelect,
  onSave,
  onForward,
}: {
  order: Record<string, unknown>;
  suppliers: { id: string; name: string }[];
  selected: boolean;
  onToggleSelect: (v: boolean) => void;
  onSave: (patch: Record<string, unknown>) => void;
  onForward: (supplierId?: string) => void;
}) {
  const [carrier, setCarrier] = useState((order.tracking_carrier as string) ?? "");
  const [number, setNumber] = useState((order.tracking_number as string) ?? "");
  const [url, setUrl] = useState((order.tracking_url as string) ?? "");
  const [supplierId, setSupplierId] = useState((order.supplier_id as string) ?? "");
  const isPaidOrCod = order.payment_status === "paid" || order.payment_method === "cod";
  const canForward = order.forwarding_status === "pending" && isPaidOrCod && order.status !== "cancelled";

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-center gap-3">
        <input type="checkbox" checked={selected} onChange={(e) => onToggleSelect(e.target.checked)} className="size-4 rounded" />
        <span className="font-mono text-xs">
          {order.order_number ? String(order.order_number) : `#${String(order.id).slice(0, 8)}`}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(order.created_at as string).toLocaleDateString()}
        </span>
        <span className="font-display italic">{formatINR(Number(order.total))}</span>
        <span className="text-xs bg-brand-soft text-brand px-2 py-0.5 rounded-full capitalize">
          {String(order.payment_method)}
        </span>
        <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
          {String(order.payment_status)}
        </span>
        <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
          {String(order.status)}
        </span>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full capitalize">
          Ful: {String(order.fulfillment_status ?? "pending")}
        </span>
        {order.forwarded_at && (
          <span className="text-xs text-muted-foreground">
            Fwd: {new Date(order.forwarded_at as string).toLocaleDateString()}
          </span>
        )}
        {order.supplier_id && (
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">
            {suppliers.find((s) => s.id === order.supplier_id)?.name ?? String(order.supplier_id).slice(0, 6)}
          </span>
        )}
        <span className="text-xs text-muted-foreground">Sub {formatINR(Number(order.subtotal ?? 0))} · Disc {formatINR(Number(order.discount_amount ?? 0))}{order.coupon_code?` (${order.coupon_code})`:""} · Ship {formatINR(Number(order.shipping ?? 0))}</span>
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={String(order.status)}
            onValueChange={(v) => onSave({ status: v })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(order.forwarding_status ?? "pending")}
            onValueChange={(v) => onSave({ forwarding_status: v })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Forwarding" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Fwd: Pending</SelectItem>
              <SelectItem value="forwarded">Fwd: Forwarded</SelectItem>
              <SelectItem value="failed">Fwd: Failed</SelectItem>
              <SelectItem value="manual">Fwd: Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Supplier + Forward action */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select supplier" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canForward ? (
          <Button size="sm" className="rounded-full" onClick={() => onForward(supplierId || undefined)}>
            Forward to supplier
          </Button>
        ) : order.forwarding_status === "forwarded" ? (
          <span className="text-xs text-success font-medium">✓ Forwarded {order.forwarded_at ? `on ${new Date(order.forwarded_at as string).toLocaleDateString()}` : ""}</span>
        ) : !isPaidOrCod ? (
          <span className="text-xs text-muted-foreground">Awaiting payment</span>
        ) : null}
        {!canForward && order.forwarding_status === "pending" && isPaidOrCod && (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => onForward(supplierId || undefined)}>
            Mark forwarded
          </Button>
        )}
      </div>

      {/* Fulfillment status */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Fulfillment:</span>
        <Select
          value={String(order.fulfillment_status ?? "pending")}
          onValueChange={(v) => onSave({ fulfillment_status: v })}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="packed">Packed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="out_for_delivery">Out for delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Input placeholder="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
        <Input placeholder="Tracking #" value={number} onChange={(e) => setNumber(e.target.value)} />
        <Input
          placeholder="Tracking URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="sm:col-span-2"
        />
      </div>
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onSave({
              tracking_carrier: carrier || null,
              tracking_number: number || null,
              tracking_url: url || null,
            })
          }
        >
          Save tracking
        </Button>
      </div>
    </div>
  );
}

function AdminProducts() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [published, setPublished] = useState("all");
  const [sort, setSort] = useState("newest");

  const { data: categories } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name, slug").order("sort_order");
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: salesMap } = useQuery({
    queryKey: ["product-performance"],
    queryFn: async () => {
      const { data } = await supabase.from("order_items").select("product_id, quantity, unit_price, order_id");
      const map = new Map<string, { units: number; revenue: number; orders: Set<string> }>();
      for (const r of data ?? []) {
        const cur = map.get(r.product_id) ?? { units: 0, revenue: 0, orders: new Set<string>() };
        cur.units += r.quantity;
        cur.revenue += Number(r.unit_price) * r.quantity;
        cur.orders.add(r.order_id);
        map.set(r.product_id, cur);
      }
      return map;
    },
  });

  const lowStock = (products ?? []).filter((p) => p.is_active !== false && p.stock <= 5);

  const filtered = (() => {
    let list = [...(products ?? [])];
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(term) || p.slug.toLowerCase().includes(term) || (p.sku ?? "").toLowerCase().includes(term));
    }
    if (category !== "all") list = list.filter((p) => p.category_id === category);
    if (stockFilter === "low") list = list.filter((p) => p.stock > 0 && p.stock <= 5);
    else if (stockFilter === "out") list = list.filter((p) => p.stock === 0);
    else if (stockFilter === "in") list = list.filter((p) => p.stock > 5);
    if (published === "published") list = list.filter((p) => p.is_active);
    else if (published === "unpublished") list = list.filter((p) => !p.is_active);
    // Sorting
    if (sort === "units") list.sort((a, b) => (salesMap?.get(b.id)?.units ?? 0) - (salesMap?.get(a.id)?.units ?? 0));
    else if (sort === "revenue") list.sort((a, b) => (salesMap?.get(b.id)?.revenue ?? 0) - (salesMap?.get(a.id)?.revenue ?? 0));
    else if (sort === "stock") list.sort((a, b) => a.stock - b.stock);
    else list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  })();

  return (
    <div className="mt-6 space-y-4">
      {lowStock.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-sm font-bold text-amber-800">Low stock — {lowStock.length} product(s) ≤ 5 units</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            {lowStock.slice(0, 8).map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name} ({p.slug})</span>
                <span className="font-mono font-bold">{p.stock} left</span>
              </li>
            ))}
            {lowStock.length > 8 && <li className="text-muted-foreground">+ {lowStock.length - 8} more</li>}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search name/sku…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
        <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{(categories ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        <Select value={stockFilter} onValueChange={setStockFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All stock</SelectItem><SelectItem value="in">In Stock</SelectItem><SelectItem value="low">Low Stock</SelectItem><SelectItem value="out">Out of Stock</SelectItem></SelectContent></Select>
        <Select value={published} onValueChange={setPublished}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="unpublished">Unpublished</SelectItem></SelectContent></Select>
        <Select value={sort} onValueChange={setSort}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">Newest</SelectItem><SelectItem value="units">Units sold</SelectItem><SelectItem value="revenue">Revenue</SelectItem><SelectItem value="stock">Stock</SelectItem></SelectContent></Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-border"><p className="text-sm text-muted-foreground">No products match filters.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground"><tr><th className="p-3 text-left">Product</th><th className="p-3">Stock</th><th className="p-3">Sold</th><th className="p-3">Revenue</th><th className="p-3">Orders</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {filtered.map((p) => {
                const isLow = p.is_active !== false && p.stock <= 5;
                const isOut = p.stock === 0;
                const perf = salesMap?.get(p.id);
                return (
                  <tr key={p.id} className={`border-t border-border ${p.is_active === false ? "opacity-50" : ""} ${isLow ? "bg-amber-50/30" : ""}`}>
                    <td className="p-3"><div className="flex items-center gap-2"><img src={p.images?.[0]?.url || p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" /><div><p className="font-medium truncate max-w-[180px]">{p.name}</p><p className="text-xs text-muted-foreground">{p.slug} · {formatINR(Number(p.price))}</p></div></div></td>
                    <td className="p-3 text-center">{p.stock} {isOut ? <span className="ml-1 text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">Out</span> : isLow ? <span className="ml-1 text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full">Low</span> : null}</td>
                    <td className="p-3 text-center">{perf?.units ?? 0}</td>
                    <td className="p-3 text-center">{formatINR(perf?.revenue ?? 0)}</td>
                    <td className="p-3 text-center">{perf?.orders.size ?? 0}</td>
                    <td className="p-3 text-center text-xs">{p.is_active ? "Published" : "Unpublished"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminCategories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", slug: "", description: "", image_url: "", sort_order: 0, is_active: true });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim() || !draft.slug.trim()) throw new Error("Name and slug are required");
      const payload = {
        name: draft.name.trim(),
        slug: draft.slug.trim().toLowerCase().replace(/\s+/g, "-"),
        description: draft.description.trim() || null,
        image_url: draft.image_url.trim() || null,
        sort_order: draft.sort_order,
        is_active: draft.is_active,
      };
      if (editing === "new") {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").update(payload).eq("id", editing!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing === "new" ? "Category created" : "Category updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["header-categories"] });
      qc.invalidateQueries({ queryKey: ["category-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const cat = categories?.find((c) => c.id === id);
      const { error } = await supabase.from("categories").update({ is_active: !cat?.is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category updated");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["header-categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6 space-y-4">
      <Button
        onClick={() => {
          setEditing("new");
          setDraft({ name: "", slug: "", description: "", image_url: "", sort_order: (categories?.length ?? 0) + 1, is_active: true });
        }}
        className="rounded-full"
      >
        + New Category
      </Button>

      {editing && (
        <div className="space-y-4 rounded-3xl bg-white p-6 ring-1 ring-border">
          <h3 className="font-display text-xl uppercase">{editing === "new" ? "Add Category" : "Edit Category"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Name *</Label>
              <Input
                value={draft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setDraft({
                    ...draft,
                    name,
                    slug: editing === "new" ? name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : draft.slug,
                  });
                }}
                placeholder="Category name"
              />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="category-slug" />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} placeholder="Category description" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
            <Label>Active (visible to customers)</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-full">
              {editing === "new" ? "Create" : "Update"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white ring-1 ring-border">
        {(categories ?? []).length === 0 && <p className="p-6 text-sm text-muted-foreground">No categories yet.</p>}
        {(categories ?? []).map((cat) => (
          <div key={cat.id} className={`flex items-center gap-4 border-b border-border p-4 last:border-0 ${!cat.is_active ? "opacity-50" : ""}`}>
            <div className="flex-1 min-w-0">
              <p className="font-bold">{cat.name} {!cat.is_active && <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">Archived</span>}</p>
              <p className="text-xs text-muted-foreground">{cat.slug} · Sort: {cat.sort_order}</p>
              {cat.description && <p className="text-xs text-muted-foreground truncate">{cat.description}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(cat.id);
                  setDraft({
                    name: cat.name,
                    slug: cat.slug,
                    description: cat.description ?? "",
                    image_url: cat.image_url ?? "",
                    sort_order: cat.sort_order,
                    is_active: cat.is_active,
                  });
                }}
              >
                Edit
              </Button>
              <Button size="sm" variant={cat.is_active ? "ghost" : "default"} onClick={() => archive.mutate(cat.id)} className={cat.is_active ? "text-destructive" : ""}>
                {cat.is_active ? "Archive" : "Restore"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminReviews() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [visibleFilter, setVisibleFilter] = useState("all");

  const { data: reviews, isPending } = useQuery({
    queryKey: ["admin-reviews", q, ratingFilter, visibleFilter],
    queryFn: async () => {
      let query = supabase
        .from("reviews")
        .select("*, products(name, slug), profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (ratingFilter !== "all") query = query.eq("rating", Number(ratingFilter));
      if (visibleFilter === "visible") query = query.eq("is_visible", true);
      if (visibleFilter === "hidden") query = query.eq("is_visible", false);
      if (q.trim()) query = query.ilike("review_text", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleVisible = useMutation({
    mutationFn: async ({ id, is_visible }: { id: string; is_visible: boolean }) => {
      const { error } = await supabase.from("reviews").update({ is_visible }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review updated");
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review deleted");
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search review text…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Rating" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            <SelectItem value="5">5 ★</SelectItem>
            <SelectItem value="4">4 ★</SelectItem>
            <SelectItem value="3">3 ★</SelectItem>
            <SelectItem value="2">2 ★</SelectItem>
            <SelectItem value="1">1 ★</SelectItem>
          </SelectContent>
        </Select>
        <Select value={visibleFilter} onValueChange={setVisibleFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Visibility" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="visible">Visible</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading reviews…</p>}
      {!isPending && (reviews ?? []).length === 0 && <p className="text-sm text-muted-foreground">No reviews match.</p>}
      {(reviews ?? []).map((r: any) => (
        <div key={r.id} className={`rounded-2xl bg-white p-4 ring-1 ring-border ${!r.is_visible ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold">{r.products?.name ?? r.product_id.slice(0, 8)}</span>
            <span className="text-muted-foreground">by {r.profiles?.full_name ?? r.user_id.slice(0, 8)}</span>
            <span className="bg-secondary px-2 py-0.5 rounded-full">{r.rating} ★</span>
            {r.verified_purchase && <span className="bg-success/10 text-success px-2 py-0.5 rounded-full">Verified</span>}
            {!r.is_visible && <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">Hidden</span>}
            <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" onClick={() => toggleVisible.mutate({ id: r.id, is_visible: !r.is_visible })}>
                {r.is_visible ? "Hide" : "Approve"}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}>Delete</Button>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed break-words">{r.review_text}</p>
        </div>
      ))}
    </div>
  );
}

function AdminCoupons() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ code: "", description: "", discount_type: "percent" as "percent"|"flat", discount_value: 10, maximum_discount: "", min_order_total: "", max_uses: "", per_user_limit: "", starts_at: "", expires_at: "", is_active: true });

  const { data: coupons } = useQuery({
    queryKey: ["admin-coupons", filter],
    queryFn: async () => {
      const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      let rows = data ?? [];
      const now = new Date();
      if (filter === "active") rows = rows.filter((c: any) => c.is_active && (!c.expires_at || new Date(c.expires_at) > now) && (!c.starts_at || new Date(c.starts_at) <= now));
      else if (filter === "expired") rows = rows.filter((c: any) => c.expires_at && new Date(c.expires_at) <= now);
      else if (filter === "upcoming") rows = rows.filter((c: any) => c.starts_at && new Date(c.starts_at) > now);
      else if (filter === "disabled") rows = rows.filter((c: any) => !c.is_active);
      return rows;
    },
  });

  const { data: couponStats } = useQuery({
    queryKey: ["coupon-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("coupon_code, discount_amount").not("coupon_code", "is", null).neq("status", "cancelled").limit(2000);
      const map = new Map<string, { uses: number; discount: number }>();
      for (const r of data ?? []) {
        const cur = map.get(r.coupon_code) ?? { uses: 0, discount: 0 };
        cur.uses += 1;
        cur.discount += Number(r.discount_amount ?? 0);
        map.set(r.coupon_code, cur);
      }
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.code.trim()) throw new Error("Code required");
      const payload: any = {
        code: draft.code.trim().toUpperCase(),
        description: draft.description.trim() || null,
        discount_type: draft.discount_type,
        discount_value: Number(draft.discount_value),
        maximum_discount: draft.maximum_discount ? Number(draft.maximum_discount) : null,
        min_order_total: draft.min_order_total ? Number(draft.min_order_total) : 0,
        max_uses: draft.max_uses ? Number(draft.max_uses) : null,
        per_user_limit: draft.per_user_limit ? Number(draft.per_user_limit) : null,
        starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
        expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null,
        is_active: draft.is_active,
      };
      if (editing === "new") { const { error } = await supabase.from("coupons").insert(payload); if (error) throw error; }
      else { const { error } = await supabase.from("coupons").update(payload).eq("id", editing); if (error) throw error; }
    },
    onSuccess: () => { toast.success(editing === "new" ? "Coupon created" : "Coupon updated"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); qc.invalidateQueries({ queryKey: ["coupon-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("coupons").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Coupon deleted"); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); qc.invalidateQueries({ queryKey: ["coupon-stats"] }); },
  });
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => { const { error } = await supabase.from("coupons").update({ is_active }).eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); },
  });

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          ["all","All"],["active","Active"],["expired","Expired"],["upcoming","Upcoming"],["disabled","Disabled"]
        ].map(([v,l]) => (
          <Button key={v} size="sm" variant={filter===v?"default":"outline"} onClick={()=>setFilter(v)} className="rounded-full text-xs">{l}</Button>
        ))}
        <Button onClick={()=>{ setEditing("new"); setDraft({ code:"", description:"", discount_type:"percent", discount_value:10, maximum_discount:"", min_order_total:"", max_uses:"", per_user_limit:"", starts_at:"", expires_at:"", is_active:true }); }} className="rounded-full ml-auto">+ New Coupon</Button>
      </div>
      {editing && (
        <div className="space-y-3 rounded-3xl bg-white p-6 ring-1 ring-border">
          <h3 className="font-display text-xl uppercase">{editing==="new"?"Add Coupon":"Edit Coupon"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Code *</Label><Input value={draft.code} onChange={(e)=>setDraft({...draft, code:e.target.value.toUpperCase()})} placeholder="WELCOME10" /></div>
            <div><Label>Type</Label><Select value={draft.discount_type} onValueChange={(v)=>setDraft({...draft, discount_type: v as any})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="percent">Percent %</SelectItem><SelectItem value="flat">Flat ₹</SelectItem></SelectContent></Select></div>
            <div><Label>Value *</Label><Input type="number" value={draft.discount_value} onChange={(e)=>setDraft({...draft, discount_value: Number(e.target.value)})} /></div>
            <div><Label>Max discount (for %)</Label><Input type="number" value={draft.maximum_discount} onChange={(e)=>setDraft({...draft, maximum_discount:e.target.value})} placeholder="e.g. 500" /></div>
            <div><Label>Min order ₹</Label><Input type="number" value={draft.min_order_total} onChange={(e)=>setDraft({...draft, min_order_total:e.target.value})} /></div>
            <div><Label>Max uses (total)</Label><Input type="number" value={draft.max_uses} onChange={(e)=>setDraft({...draft, max_uses:e.target.value})} /></div>
            <div><Label>Per user limit</Label><Input type="number" value={draft.per_user_limit} onChange={(e)=>setDraft({...draft, per_user_limit:e.target.value})} /></div>
            <div><Label>Starts at</Label><Input type="datetime-local" value={draft.starts_at} onChange={(e)=>setDraft({...draft, starts_at:e.target.value})} /></div>
            <div className="sm:col-span-2"><Label>Expires at</Label><Input type="datetime-local" value={draft.expires_at} onChange={(e)=>setDraft({...draft, expires_at:e.target.value})} /></div>
            <div className="sm:col-span-2"><Label>Description</Label><Input value={draft.description} onChange={(e)=>setDraft({...draft, description:e.target.value})} placeholder="10% off for new customers" /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={draft.is_active} onCheckedChange={(v)=>setDraft({...draft, is_active:v})} /><Label>Active</Label></div>
          <div className="flex gap-2"><Button onClick={()=>save.mutate()} disabled={save.isPending}>Save</Button><Button variant="ghost" onClick={()=>setEditing(null)}>Cancel</Button></div>
        </div>
      )}
      <div className="rounded-3xl bg-white ring-1 ring-border">
        {(coupons ?? []).length===0 && <p className="p-6 text-sm text-muted-foreground">No coupons.</p>}
        {(coupons ?? []).map((c:any)=>(
          <div key={c.id} className="flex flex-wrap items-center gap-3 border-b border-border p-4 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="font-mono font-bold">{c.code} <span className="text-xs font-normal text-muted-foreground">{c.discount_type==="percent"?`${c.discount_value}%`:`₹${c.discount_value}`}{c.maximum_discount?` (max ₹${c.maximum_discount})`:""}</span> {!c.is_active && <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">Disabled</span>}</p>
              <p className="text-xs text-muted-foreground">Min ₹{c.min_order_total ?? 0} · Used {c.used_count}/{c.max_uses ?? "∞"} · Per user {c.per_user_limit ?? "∞"} · Discount {formatINR(couponStats?.get(c.code)?.discount ?? 0)} {c.expires_at?`· Exp ${new Date(c.expires_at).toLocaleDateString()}`:""}</p>
              {c.description && <p className="text-xs text-muted-foreground truncate">{c.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={c.is_active} onCheckedChange={(v)=>toggleActive.mutate({ id:c.id, is_active:v })} />
              <Button size="sm" variant="outline" onClick={()=>{ setEditing(c.id); setDraft({ code:c.code, description:c.description??"", discount_type:c.discount_type, discount_value:Number(c.discount_value), maximum_discount:c.maximum_discount?String(c.maximum_discount):"", min_order_total:c.min_order_total?String(c.min_order_total):"", max_uses:c.max_uses?String(c.max_uses):"", per_user_limit:c.per_user_limit?String(c.per_user_limit):"", starts_at:c.starts_at?new Date(c.starts_at).toISOString().slice(0,16):"", expires_at:c.expires_at?new Date(c.expires_at).toISOString().slice(0,16):"", is_active:c.is_active }); }}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={()=>remove.mutate(c.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminShipping() {
  const qc = useQueryClient();
  const { data: cfg, isPending } = useQuery({
    queryKey: ["admin-shipping-config"],
    queryFn: async () => {
      const { data } = await supabase.from("shipping_config").select("*").eq("is_active", true).limit(1).maybeSingle();
      return data;
    },
  });
  const [draft, setDraft] = useState({ base_shipping_charge: 79, free_shipping_threshold: 999, cod_min_order_value: 0 });
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (cfg && loadedId !== cfg.id) { setDraft({ base_shipping_charge: Number(cfg.base_shipping_charge), free_shipping_threshold: Number(cfg.free_shipping_threshold), cod_min_order_value: Number(cfg.cod_min_order_value ?? 0) }); setLoadedId(cfg.id); }
  const save = useMutation({
    mutationFn: async () => {
      if (!cfg) throw new Error("No config");
      const { error } = await supabase.from("shipping_config").update({ base_shipping_charge: draft.base_shipping_charge, free_shipping_threshold: draft.free_shipping_threshold, cod_min_order_value: draft.cod_min_order_value }).eq("id", cfg.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Shipping config saved"); qc.invalidateQueries({ queryKey: ["admin-shipping-config"] }); qc.invalidateQueries({ queryKey: ["shipping-config"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isPending) return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="mt-6 max-w-lg space-y-4 rounded-3xl bg-white p-6 ring-1 ring-border">
      <h3 className="font-display text-xl uppercase">Shipping Config</h3>
      <div><Label>Base shipping charge ₹</Label><Input type="number" value={draft.base_shipping_charge} onChange={(e)=>setDraft({...draft, base_shipping_charge: Number(e.target.value)})} /></div>
      <div><Label>Free shipping threshold ₹</Label><Input type="number" value={draft.free_shipping_threshold} onChange={(e)=>setDraft({...draft, free_shipping_threshold: Number(e.target.value)})} /><p className="text-xs text-muted-foreground mt-1">Orders at or above this subtotal ship free.</p></div>
      <div><Label>COD min order ₹ (optional)</Label><Input type="number" value={draft.cod_min_order_value} onChange={(e)=>setDraft({...draft, cod_min_order_value: Number(e.target.value)})} /></div>
      <div className="rounded-xl bg-muted p-3 text-xs">Preview: Subtotal ₹500 → Shipping {500 >= draft.free_shipping_threshold ? "Free" : formatINR(draft.base_shipping_charge)} · Subtotal ₹{draft.free_shipping_threshold} → Free</div>
      <Button onClick={()=>save.mutate()} disabled={save.isPending}>Save</Button>
    </div>
  );
}

function AdminSuppliers() {
  const qc = useQueryClient();
  const { data: suppliers } = useQuery({
    queryKey: ["admin-suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="mt-6 rounded-3xl bg-white ring-1 ring-border">
      {(suppliers ?? []).map((s) => (
        <div key={s.id} className="flex items-center gap-3 border-b border-border p-4 last:border-0">
          <div className="flex-1">
            <p className="font-bold">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.platform} {s.contact_email ? `· ${s.contact_email}` : ""}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
            {s.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      ))}
    </div>
  );
}
