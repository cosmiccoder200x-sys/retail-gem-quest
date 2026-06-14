import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CartItem = {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    mrp: number | null;
    image_url: string | null;
    stock: number;
  };
};

export function useCart(enabled: boolean) {
  return useQuery({
    queryKey: ["cart"],
    enabled,
    queryFn: async (): Promise<CartItem[]> => {
      const { data, error } = await supabase
        .from("cart_items")
        .select(
          "id, product_id, quantity, product:products(id, name, slug, price, mrp, image_url, stock)",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CartItem[];
    },
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, quantity = 1 }: { productId: string; quantity?: number }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Please sign in to add items to cart");
      // upsert by (user_id, product_id)
      const { data: existing } = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.user.id)
        .eq("product_id", productId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({ user_id: user.user.id, product_id: productId, quantity });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Added to cart");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCartQty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}

export function useRemoveFromCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast.success("Removed from cart");
    },
  });
}

export function useWishlist(enabled: boolean) {
  return useQuery({
    queryKey: ["wishlist"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select(
          "id, product_id, product:products(id, name, slug, price, mrp, image_url, rating, review_count)",
        );
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Please sign in");
      const { data: existing } = await supabase
        .from("wishlist_items")
        .select("id")
        .eq("user_id", user.user.id)
        .eq("product_id", productId)
        .maybeSingle();
      if (existing) {
        await supabase.from("wishlist_items").delete().eq("id", existing.id);
        return { added: false };
      }
      await supabase
        .from("wishlist_items")
        .insert({ user_id: user.user.id, product_id: productId });
      return { added: true };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success(r.added ? "Added to wishlist" : "Removed from wishlist");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}