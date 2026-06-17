import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/auth-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><AdminDashboard /></TabsContent>
        <TabsContent value="products"><AdminProducts /></TabsContent>
        <TabsContent value="orders"><AdminOrders /></TabsContent>
        <TabsContent value="suppliers"><AdminSuppliers /></TabsContent>
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
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => { setEditing("new"); setDraft({ name: "", slug: "", price: 0, mrp: 0, stock: 0, short_description: "", description: "" }); }} className="rounded-full">+ New Product</Button>
        <CsvImporter onDone={() => qc.invalidateQueries({ queryKey: ["admin-products"] })} />
      </div>

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
          {editing && editing !== "new" && <VariantsEditor productId={editing} />}
          {editing === "new" && (
            <p className="text-xs text-muted-foreground">Save the product first to add variants.</p>
          )}
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
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6 space-y-3">
      {(orders ?? []).map((o) => (
        <OrderRow key={o.id} order={o} onSave={(patch) => update.mutate({ id: o.id, patch })} />
      ))}
    </div>
  );
}

function OrderRow({ order, onSave }: { order: Record<string, any>; onSave: (patch: Record<string, unknown>) => void }) {
  const [carrier, setCarrier] = useState(order.tracking_carrier ?? "");
  const [number, setNumber] = useState(order.tracking_number ?? "");
  const [url, setUrl] = useState(order.tracking_url ?? "");
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-brand/5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs">#{order.id.slice(0, 8)}</span>
        <span className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</span>
        <span className="font-display italic">{formatINR(Number(order.total))}</span>
        <div className="ml-auto flex items-center gap-2">
          <Select value={order.status ?? "pending"} onValueChange={(v) => onSave({ status: v })}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={order.forwarding_status ?? "pending"} onValueChange={(v) => onSave({ forwarding_status: v })}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Forwarding" /></SelectTrigger>
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
        <Input placeholder="Tracking URL" value={url} onChange={(e) => setUrl(e.target.value)} className="sm:col-span-2" />
      </div>
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => onSave({ tracking_carrier: carrier || null, tracking_number: number || null, tracking_url: url || null })}>Save tracking</Button>
      </div>
    </div>
  );
}

function CsvImporter({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error("Empty CSV");
      let pCount = 0, vCount = 0;
      const productCache = new Map<string, string>();
      for (const r of rows) {
        const slug = (r.slug || "").trim();
        if (!slug) continue;
        let productId = productCache.get(slug);
        if (!productId) {
          const productPayload = {
            name: r.name || slug,
            slug,
            price: Number(r.price) || 0,
            mrp: r.mrp ? Number(r.mrp) : null,
            stock: r.stock ? Number(r.stock) : 0,
            short_description: r.short_description || null,
            description: r.description || null,
            image_url: r.image_url || null,
            supplier_sku: r.supplier_sku || null,
            cost_price: r.cost_price ? Number(r.cost_price) : null,
          };
          const { data: up, error } = await supabase
            .from("products")
            .upsert(productPayload, { onConflict: "slug" })
            .select("id")
            .single();
          if (error) throw error;
          productId = up!.id;
          productCache.set(slug, productId);
          pCount++;
        }
        if (r.variant_sku || r.variant_option1_value) {
          const { error: vErr } = await supabase.from("product_variants").insert({
            product_id: productId,
            sku: r.variant_sku || null,
            price: r.variant_price ? Number(r.variant_price) : null,
            stock: r.variant_stock ? Number(r.variant_stock) : 0,
            option1_name: r.variant_option1_name || null,
            option1_value: r.variant_option1_value || null,
            option2_name: r.variant_option2_name || null,
            option2_value: r.variant_option2_value || null,
            supplier_sku: r.variant_supplier_sku || null,
          });
          if (vErr) throw vErr;
          vCount++;
        }
      }
      toast.success(`Imported ${pCount} products, ${vCount} variants`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
      className={`flex flex-1 items-center justify-between gap-3 rounded-full border-2 border-dashed px-4 py-2 text-sm ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
    >
      <span className="text-muted-foreground">
        {busy ? "Importing…" : "Drag-drop CSV to import (columns: slug, name, price, mrp, stock, short_description, description, image_url, supplier_sku, cost_price, variant_sku, variant_price, variant_stock, variant_option1_name, variant_option1_value, variant_option2_name, variant_option2_value, variant_supplier_sku)"}
      </span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>Choose CSV</Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}

function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); lines.push(cur); cur = []; field = ""; }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); lines.push(cur); }
  const headers = (lines.shift() ?? []).map((h) => h.trim());
  return lines
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function VariantsEditor({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data: variants } = useQuery({
    queryKey: ["admin-variants", productId],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_variants").select("*").eq("product_id", productId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [draft, setDraft] = useState({ sku: "", option1_name: "Size", option1_value: "", option2_name: "", option2_value: "", price: 0, stock: 0, supplier_sku: "" });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_variants").insert({
        product_id: productId,
        sku: draft.sku || null,
        option1_name: draft.option1_name || null,
        option1_value: draft.option1_value || null,
        option2_name: draft.option2_name || null,
        option2_value: draft.option2_value || null,
        price: draft.price || null,
        stock: draft.stock || 0,
        supplier_sku: draft.supplier_sku || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Variant added");
      setDraft({ sku: "", option1_name: "Size", option1_value: "", option2_name: "", option2_value: "", price: 0, stock: 0, supplier_sku: "" });
      qc.invalidateQueries({ queryKey: ["admin-variants", productId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-variants", productId] }),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("product_variants").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-variants", productId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 rounded-2xl bg-muted/40 p-4">
      <h4 className="mb-3 font-bold uppercase tracking-wider text-sm">Variants</h4>
      <div className="space-y-2">
        {(variants ?? []).map((v) => (
          <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-border">
            <Input className="w-28" placeholder="SKU" defaultValue={v.sku ?? ""} onBlur={(e) => e.target.value !== (v.sku ?? "") && updateField.mutate({ id: v.id, patch: { sku: e.target.value || null } })} />
            <Input className="w-24" placeholder="Opt1 name" defaultValue={v.option1_name ?? ""} onBlur={(e) => updateField.mutate({ id: v.id, patch: { option1_name: e.target.value || null } })} />
            <Input className="w-24" placeholder="Opt1 value" defaultValue={v.option1_value ?? ""} onBlur={(e) => updateField.mutate({ id: v.id, patch: { option1_value: e.target.value || null } })} />
            <Input className="w-24" placeholder="Opt2 name" defaultValue={v.option2_name ?? ""} onBlur={(e) => updateField.mutate({ id: v.id, patch: { option2_name: e.target.value || null } })} />
            <Input className="w-24" placeholder="Opt2 value" defaultValue={v.option2_value ?? ""} onBlur={(e) => updateField.mutate({ id: v.id, patch: { option2_value: e.target.value || null } })} />
            <Input className="w-24" type="number" placeholder="Price" defaultValue={v.price ?? ""} onBlur={(e) => updateField.mutate({ id: v.id, patch: { price: e.target.value ? Number(e.target.value) : null } })} />
            <Input className="w-20" type="number" placeholder="Stock" defaultValue={v.stock} onBlur={(e) => updateField.mutate({ id: v.id, patch: { stock: Number(e.target.value) || 0 } })} />
            <Button size="sm" variant="ghost" onClick={() => del.mutate(v.id)}>×</Button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3">
        <div><Label className="text-xs">SKU</Label><Input className="w-28" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></div>
        <div><Label className="text-xs">Opt1 name</Label><Input className="w-24" value={draft.option1_name} onChange={(e) => setDraft({ ...draft, option1_name: e.target.value })} /></div>
        <div><Label className="text-xs">Opt1 value</Label><Input className="w-24" value={draft.option1_value} onChange={(e) => setDraft({ ...draft, option1_value: e.target.value })} /></div>
        <div><Label className="text-xs">Opt2 name</Label><Input className="w-24" value={draft.option2_name} onChange={(e) => setDraft({ ...draft, option2_name: e.target.value })} /></div>
        <div><Label className="text-xs">Opt2 value</Label><Input className="w-24" value={draft.option2_value} onChange={(e) => setDraft({ ...draft, option2_value: e.target.value })} /></div>
        <div><Label className="text-xs">Price</Label><Input className="w-24" type="number" value={draft.price || ""} onChange={(e) => setDraft({ ...draft, price: +e.target.value })} /></div>
        <div><Label className="text-xs">Stock</Label><Input className="w-20" type="number" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: +e.target.value })} /></div>
        <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>Add variant</Button>
      </div>
    </div>
  );
}

type SupplierDraft = {
  name: string;
  platform: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  api_key_ref: string;
  notes: string;
  is_active: boolean;
};

const EMPTY_SUPPLIER: SupplierDraft = {
  name: "",
  platform: "manual",
  contact_email: "",
  contact_phone: "",
  website: "",
  api_key_ref: "",
  notes: "",
  is_active: true,
};

function AdminSuppliers() {
  const qc = useQueryClient();
  const { data: suppliers } = useQuery({
    queryKey: ["admin-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>(EMPTY_SUPPLIER);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Name is required");
      const payload = {
        name: draft.name.trim(),
        platform: draft.platform.trim() || "manual",
        contact_email: draft.contact_email.trim() || null,
        contact_phone: draft.contact_phone.trim() || null,
        website: draft.website.trim() || null,
        api_key_ref: draft.api_key_ref.trim() || null,
        notes: draft.notes.trim() || null,
        is_active: draft.is_active,
      };
      if (editing === "new") {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      } else if (editing) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editing);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("suppliers").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6 space-y-4">
      <Button
        onClick={() => { setEditing("new"); setDraft(EMPTY_SUPPLIER); }}
        className="rounded-full"
      >+ New Supplier</Button>

      {editing && (
        <div className="space-y-3 rounded-3xl bg-white p-6 ring-1 ring-brand/5">
          <h3 className="font-display text-xl uppercase">{editing === "new" ? "Add Supplier" : "Edit Supplier"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div>
              <Label>Platform</Label>
              <Select value={draft.platform} onValueChange={(v) => setDraft({ ...draft, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="cj">CJ Dropshipping</SelectItem>
                  <SelectItem value="aliexpress">AliExpress</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Contact email</Label><Input type="email" value={draft.contact_email} onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })} /></div>
            <div><Label>Contact phone</Label><Input value={draft.contact_phone} onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Website</Label><Input placeholder="https://" value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <Label>API key reference</Label>
              <Input placeholder="e.g. CJ_API_KEY (secret name, not the value)" value={draft.api_key_ref} onChange={(e) => setDraft({ ...draft, api_key_ref: e.target.value })} />
              <p className="mt-1 text-xs text-muted-foreground">Store the secret name only. The actual key lives in backend secrets.</p>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
            <Label>Active</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="rounded-3xl bg-white ring-1 ring-brand/5">
        {(suppliers ?? []).length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">No suppliers yet.</p>
        )}
        {(suppliers ?? []).map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-border p-4 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="font-bold">{s.name} {!s.is_active && <span className="ml-2 text-xs uppercase text-muted-foreground">(inactive)</span>}</p>
              <p className="text-xs text-muted-foreground">{s.platform}{s.contact_email ? ` · ${s.contact_email}` : ""}{s.website ? ` · ${s.website}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={s.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: s.id, is_active: v })} />
              <Button size="sm" variant="outline" onClick={() => {
                setEditing(s.id);
                setDraft({
                  name: s.name,
                  platform: s.platform ?? "manual",
                  contact_email: s.contact_email ?? "",
                  contact_phone: s.contact_phone ?? "",
                  website: s.website ?? "",
                  api_key_ref: s.api_key_ref ?? "",
                  notes: s.notes ?? "",
                  is_active: s.is_active,
                });
              }}>Edit</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}