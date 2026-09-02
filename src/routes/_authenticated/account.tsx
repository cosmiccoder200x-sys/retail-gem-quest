import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { useWishlist, useToggleWishlist, useAddToCart } from "@/lib/cart";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductTile } from "@/components/product/ProductTile";
import { formatINR } from "@/lib/format";
import { Trash2, ShoppingBag, RefreshCw, CreditCard, User, MapPin, Plus, Check } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void; on: (e: string, h: (r: unknown) => void) => void };
  }
}

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "My Account — GullyGadget" }] }),
  component: Account,
});

function Account() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: wishlist } = useWishlist(!!user);
  const addToCart = useAddToCart();
  const toggleWish = useToggleWishlist();

  // Profile state
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "" });
  const [editingProfile, setEditingProfile] = useState(false);

  // Address state
  const [addressForm, setAddressForm] = useState({
    full_name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "",
  });
  const [editingAddress, setEditingAddress] = useState<string | null>(null);

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
  });

  // Fetch addresses
  const { data: addresses } = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("addresses").select("*").order("is_default", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch orders
  const { data: orders } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!profileForm.full_name.trim()) throw new Error("Name is required");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: profileForm.full_name.trim(), phone: profileForm.phone.trim() || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      setEditingProfile(false);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Save address mutation
  const saveAddress = useMutation({
    mutationFn: async () => {
      if (!addressForm.full_name.trim() || !addressForm.phone.trim() || !addressForm.line1.trim() ||
          !addressForm.city.trim() || !addressForm.state.trim() || !addressForm.pincode.trim()) {
        throw new Error("All required fields must be filled");
      }
      const payload = {
        user_id: user!.id,
        full_name: addressForm.full_name.trim(),
        phone: addressForm.phone.trim(),
        line1: addressForm.line1.trim(),
        line2: addressForm.line2.trim() || null,
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        pincode: addressForm.pincode.trim(),
        is_default: (addresses ?? []).length === 0,
      };
      if (editingAddress) {
        const { error } = await supabase.from("addresses").update(payload).eq("id", editingAddress);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("addresses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingAddress ? "Address updated" : "Address saved");
      setEditingAddress(null);
      setAddressForm({ full_name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" });
      qc.invalidateQueries({ queryKey: ["addresses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete address mutation
  const deleteAddress = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Address deleted");
      qc.invalidateQueries({ queryKey: ["addresses"] });
    },
  });

  // Retry payment
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const retryPayment = useCallback(
    async (orderId: string) => {
      if (retryingId) return;
      setRetryingId(orderId);
      try {
        if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          document.body.appendChild(script);
          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
          });
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-razorpay-order`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ order_id: orderId }),
          }
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create Razorpay order");
        }
        const { razorpay_order_id, amount, currency, key_id } = await res.json();
        const rzp = new window.Razorpay({
          key: key_id, amount, currency, name: "GullyGadget",
          description: `Order #${orderId.slice(0, 8)}`, order_id: razorpay_order_id,
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              const verifyRes = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-razorpay-payment`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    order_id: orderId,
                  }),
                }
              );
              if (!verifyRes.ok) throw new Error("Verification failed");
              qc.invalidateQueries({ queryKey: ["orders"] });
              toast.success("Payment successful!");
            } catch {
              toast.success("Payment received. Status will update shortly.");
              qc.invalidateQueries({ queryKey: ["orders"] });
            }
          },
          prefill: { email: user?.email ?? "" },
          theme: { color: "#0891b2" },
          modal: { ondismiss: () => { toast.info("Payment cancelled. You can retry anytime."); setRetryingId(null); } },
        });
        rzp.on("payment.failed", (response: { error: { description: string } }) => {
          toast.error(`Payment failed: ${response.error.description}`);
          setRetryingId(null);
        });
        rzp.open();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Retry failed");
        setRetryingId(null);
      }
    },
    [retryingId, user?.email, qc]
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="mb-2 font-display text-4xl uppercase">My Account</h1>
      <p className="mb-8 text-muted-foreground">{user?.email}</p>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-6 space-y-4">
          {(orders ?? []).length === 0 && (
            <EmptyState
              icon={<ShoppingBag className="size-8 mb-3" />}
              title="No orders yet"
              description="Place your first order to track deliveries and view order history."
              action={{ label: "Shop now", to: "/products" }}
            />
          )}
          {(orders ?? []).map((o) => {
            const isUnpaid = o.payment_method === "online" && o.payment_status !== "paid" && o.status !== "cancelled";
            return (
              <div key={o.id} className="rounded-3xl bg-white p-6 ring-1 ring-border">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Order</p>
                    <Link to="/order-confirmation/$orderId" params={{ orderId: o.id }} className="font-mono text-sm hover:text-accent-cyan">
                      #{o.order_number || o.id.slice(0, 8)}
                    </Link>
                  </div>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold uppercase text-brand capitalize">{o.status}</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{o.payment_method === "cod" ? "COD" : "Online"}</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{o.payment_status}</span>
                  <span className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</span>
                  <span className="font-display text-xl italic">{formatINR(Number(o.total))}</span>
                </div>
                <div className="space-y-1 text-sm">
                  {o.order_items?.map((it: Record<string, unknown>) => (
                    <div key={it.id as string} className="flex justify-between text-muted-foreground">
                      <span>{it.product_name as string} × {it.quantity as number}</span>
                      <span>{formatINR((it.price as number) * (it.quantity as number))}</span>
                    </div>
                  ))}
                </div>
                {isUnpaid && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <Button size="sm" onClick={() => retryPayment(o.id)} disabled={retryingId === o.id} className="rounded-full bg-brand hover:bg-accent-cyan">
                      {retryingId === o.id ? <RefreshCw className="mr-2 size-3 animate-spin" /> : <CreditCard className="mr-2 size-3" />}
                      Retry Payment
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <div className="rounded-3xl bg-white p-6 ring-1 ring-border max-w-lg">
            <h2 className="font-display text-xl uppercase mb-4 flex items-center gap-2">
              <User className="size-5" /> Profile
            </h2>
            {editingProfile ? (
              <div className="space-y-3">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder={profile?.full_name ?? "Your name"}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder={profile?.phone ?? "Phone number"}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="rounded-full">
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingProfile(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">Name:</span> {profile?.full_name || "Not set"}</p>
                <p className="text-sm"><span className="text-muted-foreground">Phone:</span> {profile?.phone || "Not set"}</p>
                <p className="text-sm"><span className="text-muted-foreground">Email:</span> {user?.email}</p>
                <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => {
                  setProfileForm({ full_name: profile?.full_name ?? "", phone: profile?.phone ?? "" });
                  setEditingProfile(true);
                }}>
                  Edit Profile
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Addresses Tab */}
        <TabsContent value="addresses" className="mt-6 space-y-4">
          {/* Address Form */}
          <div className="rounded-3xl bg-white p-6 ring-1 ring-border max-w-lg">
            <h2 className="font-display text-xl uppercase mb-4 flex items-center gap-2">
              <MapPin className="size-5" /> {editingAddress ? "Edit Address" : "Add Address"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Full Name *</Label>
                <Input value={addressForm.full_name} onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })} />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input type="tel" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Address Line 1 *</Label>
                <Input value={addressForm.line1} onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Line 2</Label>
                <Input value={addressForm.line2} onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })} />
              </div>
              <div>
                <Label>City *</Label>
                <Input value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} />
              </div>
              <div>
                <Label>State *</Label>
                <Input value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} />
              </div>
              <div>
                <Label>Pincode *</Label>
                <Input value={addressForm.pincode} onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={() => saveAddress.mutate()} disabled={saveAddress.isPending} className="rounded-full">
                {editingAddress ? "Update" : "Save"} Address
              </Button>
              {editingAddress && (
                <Button size="sm" variant="ghost" onClick={() => { setEditingAddress(null); setAddressForm({ full_name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" }); }}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Saved Addresses */}
          <div className="space-y-3">
            {(addresses ?? []).map((addr) => (
              <div key={addr.id} className="rounded-2xl bg-white p-4 ring-1 ring-border flex items-start justify-between">
                <div className="text-sm">
                  <p className="font-bold">{addr.full_name} {addr.is_default && <span className="text-xs bg-brand-soft text-brand px-2 py-0.5 rounded-full ml-1">Default</span>}</p>
                  <p className="text-muted-foreground">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                  <p className="text-muted-foreground">{addr.city}, {addr.state} - {addr.pincode}</p>
                  <p className="text-muted-foreground">Phone: {addr.phone}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => {
                    setEditingAddress(addr.id);
                    setAddressForm({ full_name: addr.full_name, phone: addr.phone, line1: addr.line1, line2: addr.line2 ?? "", city: addr.city, state: addr.state, pincode: addr.pincode });
                  }}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteAddress.mutate(addr.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Wishlist Tab */}
        <TabsContent value="wishlist" className="mt-6">
          {(wishlist ?? []).length === 0 && (
            <EmptyState
              icon={<span className="text-3xl">❤</span>}
              title="Your wishlist is empty"
              description="Save products you love here for later."
              action={{ label: "Continue Shopping", to: "/products" }}
            />
          )}
          {(wishlist ?? []).map((w) => {
            const p = w.product as { id: string; name: string; slug: string; price: number; mrp: number | null; image_url: string | null };
            return (
              <div key={w.id} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-border">
                <Link to="/products/$slug" params={{ slug: p.slug }} className="size-20 shrink-0 overflow-hidden rounded-xl bg-background">
                  <ProductTile name={p.name} imageUrl={p.image_url} />
                </Link>
                <div className="flex flex-1 flex-col">
                  <Link to="/products/$slug" params={{ slug: p.slug }} className="font-bold hover:text-accent-cyan line-clamp-1">{p.name}</Link>
                  <p className="font-display italic">{formatINR(p.price)}</p>
                  <div className="mt-auto flex gap-2">
                    <Button size="sm" onClick={() => addToCart.mutate({ product_id: p.id })} className="flex-1 rounded-full"><ShoppingBag className="size-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleWish.mutate({ product_id: w.product_id })}><Trash2 className="size-3" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
