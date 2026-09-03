import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  size = "sm",
  interactive = false,
  onChange,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const sizeCls = size === "lg" ? "size-6" : size === "md" ? "size-5" : "size-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(n)}
            className={cn(interactive ? "cursor-pointer hover:scale-110 transition" : "cursor-default", "p-0.5")}
            aria-label={`${n} star`}
          >
            <Star className={cn(sizeCls, filled ? "fill-offer text-offer" : "text-muted-foreground/30")} />
          </button>
        );
      })}
    </div>
  );
}

export function StarDisplay({ value, size = "sm" }: { value: number; size?: "sm" | "md" | "lg" }) {
  return <StarRating value={value} size={size} />;
}
