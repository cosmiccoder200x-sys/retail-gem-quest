import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/auth-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

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
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><AdminOrders /></TabsContent>
        <TabsContent value="products"><AdminProducts /></TabsContent>
        <TabsContent value="suppliers"><AdminSuppliers /></TabsContent>
      </Tabs>
    </div>
  );
}

function AdminOrders() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

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
      else if (filter !== "all") q = q.eq("status", filter);

      if (search) q = q.ilike("order_number", `%${search}%`);

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
  ];

  return (
    <div className="mt-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search order number…"
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

      {/* Orders List */}
      {isPending && <p className="text-sm text-muted-foreground">Loading orders…</p>}
      {!isPending && (orders ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No orders match this filter.</p>
      )}
      {(orders ?? []).map((o) => (
        <OrderRow key={o.id} order={o} onSave={(patch) => update.mutate({ id: o.id, patch })} />
      ))}
    </div>
  );
}

function OrderRow({
  order,
  onSave,
}: {
  order: Record<string, unknown>;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [carrier, setCarrier] = useState((order.tracking_carrier as string) ?? "");
  const [number, setNumber] = useState((order.tracking_number as string) ?? "");
  const [url, setUrl] = useState((order.tracking_url as string) ?? "");

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-center gap-3">
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
  const qc = useQueryClient();
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="mt-6 rounded-3xl bg-white ring-1 ring-border">
      {(products ?? []).map((p) => (
        <div
          key={p.id}
          className={`flex items-center gap-4 border-b border-border p-4 last:border-0 ${p.is_active === false ? "opacity-50" : ""}`}
        >
          <img src={p.images?.[0]?.url || p.image_url} alt={p.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.slug} · Stock: {p.stock}</p>
          </div>
          <span className="font-display italic shrink-0">{formatINR(Number(p.price))}</span>
        </div>
      ))}
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
