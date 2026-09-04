import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

export function AdminInventory() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [threshold, setThreshold] = useState(5);

  const { data: config } = useQuery({
    queryKey: ["inventory-threshold"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "low_stock_threshold")
        .maybeSingle();
      return data ? Number(data.value as unknown) : 5;
    },
  });

  const effectiveThreshold = config ?? threshold;

  const { data: products } = useQuery({
    queryKey: ["inventory-products", search],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id, name, slug, sku, stock, is_active, category_id")
        .order("stock", { ascending: true })
        .limit(200);
      if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,slug.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: variants } = useQuery({
    queryKey: ["inventory-variants", search],
    queryFn: async () => {
      let q = supabase
        .from("product_variants")
        .select("id, product_id, sku, stock, option1_value, option2_value, products(name)")
        .limit(200);
      if (search) q = q.or(`sku.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: salesMap } = useQuery({
    queryKey: ["inventory-sales"],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("product_id, variant_id, quantity");
      const map = new Map<string, number>();
      for (const r of data ?? []) {
        const key = r.variant_id ?? r.product_id;
        if (key) map.set(key, (map.get(key) ?? 0) + r.quantity);
      }
      return map;
    },
  });

  const updateProductStock = useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      if (stock < 0) throw new Error("Stock cannot be negative");
      const { error } = await supabase.from("products").update({ stock }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock updated");
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateVariantStock = useMutation({
    mutationFn: async ({ id, stock }: { id: string; stock: number }) => {
      if (stock < 0) throw new Error("Stock cannot be negative");
      const { error } = await supabase.from("product_variants").update({ stock }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Variant stock updated");
      qc.invalidateQueries({ queryKey: ["inventory-variants"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredProducts = useMemo(() => {
    let list = products ?? [];
    if (filter === "low") list = list.filter((p) => p.stock > 0 && p.stock <= effectiveThreshold);
    if (filter === "out") list = list.filter((p) => p.stock === 0);
    if (filter === "in") list = list.filter((p) => p.stock > effectiveThreshold);
    return list;
  }, [products, filter, effectiveThreshold]);

  const filteredVariants = useMemo(() => {
    let list = variants ?? [];
    if (filter === "low") list = list.filter((v) => v.stock > 0 && v.stock <= effectiveThreshold);
    if (filter === "out") list = list.filter((v) => v.stock === 0);
    if (filter === "in") list = list.filter((v) => v.stock > effectiveThreshold);
    return list;
  }, [variants, filter, effectiveThreshold]);

  const saveThreshold = async () => {
    const { error } = await supabase
      .from("app_config")
      .upsert(
        { key: "low_stock_threshold", value: threshold as unknown as never },
        { onConflict: "key" },
      );
    if (error) toast.error(error.message);
    else {
      toast.success("Threshold saved");
      qc.invalidateQueries({ queryKey: ["inventory-threshold"] });
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search SKU or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="in">In Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Low ≤</span>
          <Input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-20 h-8"
          />
          <Button size="sm" variant="outline" onClick={saveThreshold}>
            Save
          </Button>
          <span className="text-xs text-muted-foreground">(active: {effectiveThreshold})</span>
        </div>
      </div>

      {filteredProducts.length === 0 && filteredVariants.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-border">
          <p className="text-sm text-muted-foreground">No inventory matches filter.</p>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="font-bold text-sm">Products ({filteredProducts.length})</h3>
        <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Product</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Status</th>
                <th className="p-3">Sold</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const status =
                  p.stock === 0 ? "Out" : p.stock <= effectiveThreshold ? "Low" : "In Stock";
                const sold = salesMap?.get(p.id) ?? 0;
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3">
                      <div className="font-medium truncate max-w-[200px]">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.slug} {p.is_active ? "" : "(unpublished)"}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{p.sku ?? "—"}</td>
                    <td className="p-3">
                      <StockInput
                        value={p.stock}
                        onSave={(v) => updateProductStock.mutate({ id: p.id, stock: v })}
                      />
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${status === "Out" ? "bg-destructive text-destructive-foreground" : status === "Low" ? "bg-amber-500 text-white" : "bg-success/10 text-success"}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="p-3 text-center">{sold}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {p.is_active ? "Published" : "Unpublished"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-bold text-sm">Variants ({filteredVariants.length})</h3>
        <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Variant</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Status</th>
                <th className="p-3">Sold</th>
              </tr>
            </thead>
            <tbody>
              {filteredVariants.map((v) => {
                const prodName = (v.products as any)?.name ?? v.product_id.slice(0, 6);
                const label = `${prodName} ${[v.option1_value, v.option2_value].filter(Boolean).join(" / ")}`;
                const status =
                  v.stock === 0 ? "Out" : v.stock <= effectiveThreshold ? "Low" : "In Stock";
                const sold = salesMap?.get(v.id) ?? 0;
                return (
                  <tr key={v.id} className="border-t border-border">
                    <td className="p-3 truncate max-w-[220px]">{label}</td>
                    <td className="p-3 font-mono text-xs">{v.sku ?? "—"}</td>
                    <td className="p-3">
                      <StockInput
                        value={v.stock}
                        onSave={(vv) => updateVariantStock.mutate({ id: v.id, stock: vv })}
                      />
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${status === "Out" ? "bg-destructive text-destructive-foreground" : status === "Low" ? "bg-amber-500 text-white" : "bg-success/10 text-success"}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="p-3 text-center">{sold}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StockInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(value);
  const [editing, setEditing] = useState(false);
  if (!editing)
    return (
      <button
        onClick={() => setEditing(true)}
        className="font-mono px-2 py-1 rounded hover:bg-secondary"
      >
        {value}
      </button>
    );
  return (
    <div className="flex gap-1">
      <Input
        type="number"
        value={v}
        onChange={(e) => setV(Number(e.target.value))}
        className="w-20 h-7"
      />
      <Button
        size="sm"
        className="h-7"
        onClick={() => {
          onSave(v);
          setEditing(false);
        }}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}
