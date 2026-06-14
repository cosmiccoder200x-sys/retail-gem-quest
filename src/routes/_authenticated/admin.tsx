import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/auth-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
        <p className="mt-4 text-xs text-muted-foreground">To grant admin: insert into user_roles (user_id, role) with role='admin' via Cloud database.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="mb-8 font-display text-4xl uppercase">Merchant Hub</h1>
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><AdminDashboard /></TabsContent>
        <TabsContent value="products"><AdminProducts /></TabsContent>
        <TabsContent value="orders"><AdminOrders /></TabsContent>
      </Tabs>
    </div>
  );
}

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [orders, products] = await Promise.all([
        supabase.from("orders").select("total, status, created_at"),
        supabase.from("products").select("id, stock"),
      ]);
      const totalRevenue = (orders.data ?? []).reduce((n, o) => n + Number(o.total), 0);
      const lowStock = (products.data ?? []).filter((p) => p.stock < 20).length;
      return {
        revenue: totalRevenue,
        orderCount: orders.data?.length ?? 0,
        productCount: products.data?.length ?? 0,
        lowStock,
      };
    },
  });

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: "Total Revenue", value: stats ? formatINR(stats.revenue) : "—" },
        { label: "Orders", value: stats?.orderCount ?? "—" },
        { label: "Products", value: stats?.productCount ?? "—" },
        { label: "Low Stock Items", value: stats?.lowStock ?? "—" },
      ].map((s) => (
        <div key={s.label} className="rounded-3xl bg-white p-6 ring-1 ring-brand/5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
          <p className="mt-2 font-display text-3xl">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function AdminProducts() {
  const qc = useQueryClient();
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; slug: string; price: number; mrp: number; stock: number; short_description: string; description: string }>({
    name: "", slug: "", price: 0, mrp: 0, stock: 0, short_description: "", description: "",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing === "new") {
        const { error } = await supabase.from("products").insert(draft);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").update(draft).eq("id", editing!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
  });

  return (
    <div className="mt-6 space-y-4">
      <Button onClick={() => { setEditing("new"); setDraft({ name: "", slug: "", price: 0, mrp: 0, stock: 0, short_description: "", description: "" }); }} className="rounded-full">+ New Product</Button>

      {editing && (
        <div className="space-y-3 rounded-3xl bg-white p-6 ring-1 ring-brand/5">
          <h3 className="font-display text-xl uppercase">{editing === "new" ? "Add Product" : "Edit Product"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} /></div>
            <div><Label>Price ₹</Label><Input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: +e.target.value })} /></div>
            <div><Label>MRP ₹</Label><Input type="number" value={draft.mrp} onChange={(e) => setDraft({ ...draft, mrp: +e.target.value })} /></div>
            <div><Label>Stock</Label><Input type="number" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: +e.target.value })} /></div>
          </div>
          <div><Label>Short description</Label><Input value={draft.short_description} onChange={(e) => setDraft({ ...draft, short_description: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white ring-1 ring-brand/5">
        {(products ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-4 border-b border-border p-4 last:border-0">
            <div className="flex-1">
              <p className="font-bold">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.slug} · Stock: {p.stock}</p>
            </div>
            <span className="font-display italic">{formatINR(Number(p.price))}</span>
            <Button size="sm" variant="outline" onClick={() => { setEditing(p.id); setDraft({ name: p.name, slug: p.slug, price: Number(p.price), mrp: Number(p.mrp ?? 0), stock: p.stock, short_description: p.short_description ?? "", description: p.description ?? "" }); }}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => del.mutate(p.id)}>Delete</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminOrders() {
  const qc = useQueryClient();
  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
  });

  return (
    <div className="mt-6 rounded-3xl bg-white ring-1 ring-brand/5">
      {(orders ?? []).map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-3 border-b border-border p-4 last:border-0">
          <span className="font-mono text-xs">#{o.id.slice(0, 8)}</span>
          <span className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
          <span className="font-display italic">{formatINR(Number(o.total))}</span>
          <Select value={o.status} onValueChange={(v) => update.mutate({ id: o.id, status: v })}>
            <SelectTrigger className="w-40 ml-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}