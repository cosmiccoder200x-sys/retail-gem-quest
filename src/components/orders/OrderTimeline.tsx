import { Check, Package, Truck, Home, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  key: string;
  label: string;
  description: string;
  icon: typeof Check;
};

const STEPS: Step[] = [
  { key: "ordered", label: "Ordered", description: "Order placed", icon: Clock },
  { key: "processing", label: "Processing", description: "Forwarded to supplier", icon: Package },
  { key: "shipped", label: "Shipped", description: "On the way", icon: Truck },
  { key: "delivered", label: "Delivered", description: "Delivered", icon: Home },
];

function fulfillmentToStepIndex(fulfillment: string | null | undefined, forwarding: string | null | undefined, hasTracking: boolean): number {
  if (fulfillment === "delivered") return 3;
  if (fulfillment === "shipped" || fulfillment === "out_for_delivery" || hasTracking) return 2;
  if (fulfillment === "processing" || fulfillment === "packed" || forwarding === "forwarded" || forwarding === "manual") return 1;
  return 0;
}

export function OrderTimeline({
  createdAt,
  forwardedAt,
  fulfillmentStatus,
  forwardingStatus,
  hasTracking,
  carrier,
  trackingNumber,
  trackingUrl,
  compact = false,
}: {
  createdAt?: string | null;
  forwardedAt?: string | null;
  fulfillmentStatus?: string | null;
  forwardingStatus?: string | null;
  hasTracking?: boolean;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  compact?: boolean;
}) {
  const activeIndex = fulfillmentToStepIndex(fulfillmentStatus, forwardingStatus, !!hasTracking);
  const isCancelled = fulfillmentStatus === "cancelled" || fulfillmentStatus === "returned";

  if (isCancelled) {
    return (
      <div className="rounded-2xl bg-destructive/5 p-4 ring-1 ring-destructive/20">
        <p className="text-sm font-medium text-destructive capitalize">{fulfillmentStatus}</p>
        <p className="text-xs text-muted-foreground">This order was {fulfillmentStatus}.</p>
      </div>
    );
  }

  return (
    <div className={cn(compact ? "space-y-0" : "space-y-1")}>
      <div className="flex gap-2">
        {STEPS.map((step, idx) => {
          const isDone = idx < activeIndex;
          const isActive = idx === activeIndex;
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full items-center">
                {idx > 0 && (
                  <div className={cn("h-0.5 flex-1", isDone || isActive ? "bg-brand" : "bg-border")} />
                )}
                <div
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full ring-1",
                    isDone
                      ? "bg-brand text-brand-foreground ring-brand"
                      : isActive
                        ? "bg-brand text-brand-foreground ring-brand shadow"
                        : "bg-card text-muted-foreground ring-border",
                  )}
                >
                  {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={cn("h-0.5 flex-1", isDone ? "bg-brand" : "bg-border")} />
                )}
              </div>
              <span className={cn("text-xs font-medium", isActive ? "text-brand" : isDone ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
              {!compact && (
                <span className="text-[11px] text-muted-foreground text-center leading-tight hidden sm:block">
                  {idx === 0 && createdAt ? new Date(createdAt).toLocaleDateString() : step.description}
                  {idx === 1 && forwardedAt ? ` · ${new Date(forwardedAt).toLocaleDateString()}` : ""}
                  {idx === 2 && carrier ? ` · ${carrier}` : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {hasTracking && trackingNumber && (
        <div className="mt-3 rounded-xl bg-brand-soft p-3 text-sm">
          <p className="font-medium">
            {carrier ?? "Carrier"} — <span className="font-mono">{trackingNumber}</span>
          </p>
          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex text-xs font-medium text-brand hover:underline"
            >
              Track with carrier →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
