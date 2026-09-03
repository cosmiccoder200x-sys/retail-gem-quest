import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StarRating } from "./StarRating";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle, Pencil, Trash2 } from "lucide-react";

type ReviewRow = {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  review_text: string;
  verified_purchase: boolean;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null } | null;
};

function distribution(reviews: ReviewRow[]) {
  const counts = [0, 0, 0, 0, 0, 0]; // index 1..5
  for (const r of reviews) counts[r.rating] = (counts[r.rating] ?? 0) + 1;
  return counts;
}

export function ReviewsSection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, profiles(full_name)")
        .eq("product_id", productId)
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ReviewRow[];
    },
  });

  const { data: myReview } = useQuery({
    queryKey: ["my-review", productId, user?.id],
    enabled: !!user && !!productId,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as ReviewRow | null;
    },
  });

  const avg = reviews && reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const dist = reviews ? distribution(reviews) : [0, 0, 0, 0, 0, 0];
  const maxCount = Math.max(...dist.slice(1), 1);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in to review");
      if (rating < 1 || rating > 5) throw new Error("Please select a rating");
      const trimmed = text.trim();
      if (trimmed.length < 5) throw new Error("Review must be at least 5 characters");
      if (trimmed.length > 2000) throw new Error("Review is too long");
      // Verify product exists and is active (RLS already enforces is_active for public, but double-check)
      const { data: prod } = await supabase.from("products").select("id").eq("id", productId).eq("is_active", true).maybeSingle();
      if (!prod) throw new Error("Product not found");

      if (editingId || myReview) {
        const id = editingId ?? myReview!.id;
        const { error } = await supabase
          .from("reviews")
          .update({ rating, review_text: trimmed })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reviews").insert({
          product_id: productId,
          user_id: user.id,
          rating,
          review_text: trimmed,
        });
        if (error) {
          if (error.code === "23505") throw new Error("You have already reviewed this product");
          throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId || myReview ? "Review updated" : "Review submitted");
      setRating(0);
      setText("");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      qc.invalidateQueries({ queryKey: ["my-review", productId] });
      qc.invalidateQueries({ queryKey: ["product", productId] });
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
      setEditingId(null);
      setRating(0);
      setText("");
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      qc.invalidateQueries({ queryKey: ["my-review", productId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (r: ReviewRow) => {
    setEditingId(r.id);
    setRating(r.rating);
    setText(r.review_text);
    document.getElementById("review-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="mt-16 space-y-6">
      <h2 className="font-display text-2xl uppercase">Reviews</h2>

      {/* Summary */}
      <div className="rounded-3xl bg-white p-6 ring-1 ring-border">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-secondary rounded w-32" />
            <div className="h-4 bg-secondary rounded w-48" />
          </div>
        ) : reviews && reviews.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="font-display text-4xl">{avg.toFixed(1)}</span>
                <StarRating value={Math.round(avg)} size="md" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</p>
            </div>
            <div className="space-y-1">
              {[5, 4, 3, 2, 1].map((n) => (
                <div key={n} className="flex items-center gap-2 text-sm">
                  <span className="w-6 text-muted-foreground">{n} ★</span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-offer rounded-full"
                      style={{ width: `${(dist[n] / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs text-muted-foreground">{dist[n]}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review.</p>
        )}
      </div>

      {/* Form */}
      <div id="review-form" className="rounded-3xl bg-white p-6 ring-1 ring-border">
        <h3 className="font-display text-lg uppercase mb-4">{editingId || myReview ? "Edit your review" : "Write a Review"}</h3>
        {!user ? (
          <p className="text-sm text-muted-foreground">
            Please <a href="/auth" className="text-brand underline">sign in</a> to write a review.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Rating *</Label>
              <div className="mt-1">
                <StarRating value={rating} size="lg" interactive onChange={setRating} />
              </div>
            </div>
            <div>
              <Label htmlFor="review-text">Review *</Label>
              <Textarea
                id="review-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What did you like or dislike?"
                rows={4}
                maxLength={2000}
              />
              <p className="mt-1 text-xs text-muted-foreground">{text.length}/2000</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="rounded-full">
                {submit.isPending ? "Submitting…" : editingId || myReview ? "Update review" : "Submit review"}
              </Button>
              {(editingId || myReview) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setRating(myReview?.rating ?? 0);
                    setText(myReview?.review_text ?? "");
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Verified Purchase is determined automatically when we can confirm you purchased this product.
            </p>
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        {reviews?.map((r) => {
          const isOwn = user?.id === r.user_id;
          return (
            <div key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating value={r.rating} size="sm" />
                    {r.verified_purchase && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        <CheckCircle className="size-3" /> Verified Purchase
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {r.profiles?.full_name ?? "Customer"} · {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed break-words">{r.review_text}</p>
                </div>
                {isOwn && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(r)} aria-label="Edit">
                      <Pencil className="size-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)} aria-label="Delete">
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {reviews?.length === 0 && !isLoading && (
          <p className="text-center text-sm text-muted-foreground py-4">No reviews to display.</p>
        )}
      </div>
    </section>
  );
}
