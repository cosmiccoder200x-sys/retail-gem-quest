import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CartItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
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
  variant?: {
    id: string;
    price: number | null;
    mrp: number | null;
    stock: number;
    image_url: string | null;
    attributes: Record<string, unknown>;
  } | null;
};

export type CartItemInput = {
  product_id: string;
  variant_id?: string;
  quantity?: number;
};

function getVariantSelect() {
  return "variant:product_variants(id, price, mrp, stock, image_url, attributes)";
}

function getProductSelect() {
  return "product:products(id, name, slug, price, mrp, image_url, stock)";
}

export function useCart(userId?: string | null) {
  const enabled = !!userId;
  return useQuery({
    queryKey: ["cart", userId],
    enabled,
    queryFn: async (): Promise<CartItem[]> => {
      const { data, error } = await supabase
        .from("cart_items")
        .select(
          `id, product_id, variant_id, quantity, ${getProductSelect()}, ${getVariantSelect()}`,
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
    mutationFn: async ({ product_id, variant_id, quantity = 1 }: CartItemInput) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Please sign in to add items to cart");

      // Upsert by (user_id, product_id, variant_id)
      const query = supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", user.user.id)
        .eq("product_id", product_id);

      if (variant_id) {
        query.eq("variant_id", variant_id);
      } else {
        query.is("variant_id", null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").insert({
          user_id: user.user.id,
          product_id: product_id,
          variant_id: variant_id ?? null,
          quantity,
        });
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
      if (quantity < 1) throw new Error("Quantity must be at least 1");
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
          `id, product_id, variant_id, product:products(id, name, slug, price, mrp, image_url, rating, review_count), variant:product_variants(id, price, mrp, stock, image_url, attributes)`,
        );
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ product_id, variant_id }: { product_id: string; variant_id?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Please sign in");

      const query = supabase
        .from("wishlist_items")
        .select("id")
        .eq("user_id", user.user.id)
        .eq("product_id", product_id);

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        await supabase.from("wishlist_items").delete().eq("id", existing.id);
        return { added: false };
      }

      await supabase.from("wishlist_items").insert({
        user_id: user.user.id,
        product_id: product_id,
        variant_id: variant_id ?? null,
      });
      return { added: true };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success(r.added ? "Added to wishlist" : "Removed from wishlist");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useValidateCart(userId: string | undefined) {
  return useQuery({
    queryKey: ["cart-validation", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("validate_cart", { p_user_id: userId! });
      if (error) throw error;
      return data ?? [];
    },
  });
}
