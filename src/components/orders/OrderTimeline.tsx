import { Check, Package, Truck, Home, Clock, AlertCircle, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = { key: string; label: string; description: string; icon: typeof Check };

const STEPS: Step[] = [
  { key: "ordered", label: "Placed", description: "Order placed", icon: Clock },
  { key: "confirmed", label: "Confirmed", description: "Confirmed", icon: Check },
  { key: "processing", label: "Processing", description: "Preparing", icon: Package },
  { key: "shipped", label: "Shipped", description: "On the way", icon: Truck },
  { key: "out_for_delivery", label: "Out for delivery", description: "Out for delivery", icon: Truck },
  { key: "delivered", label: "Delivered", description: "Delivered", icon: Home },
];

function fulfillmentToStepIndex(
  status: string | null | undefined,
  fulfillment: string | null | undefined,
  forwarding: string | null | undefined,
  hasTracking: boolean,
): number {
  if (fulfillment === "cancelled" || fulfillment === "returned" || status === "cancelled") return -1;
  if (fulfillment === "delivered") return 5;
  if (fulfillment === "out_for_delivery") return 4;
  if (fulfillment === "shipped" || hasTracking) return 3;
  if (fulfillment === "processing" || fulfillment === "packed" || forwarding === "forwarded" || forwarding === "manual") return 2;
  if (status === "confirmed" || fulfillment === "processing") return 1;
  return 0;
}

const statusMessage = (status?: string | null, fulfillment?: string | null, forwarding?: string | null, paymentStatus?: string | null) => {
  if (paymentStatus === "failed") return "Payment failed — Retry payment";
  if (status === "cancelled" || fulfillment === "cancelled") return "Order cancelled";
  if (fulfillment === "returned") return "Order returned";
  if (fulfillment === "delivered") return "Delivered";
  if (fulfillment === "out_for_delivery") return "Out for delivery";
  if (fulfillment === "shipped" || forwarding === "forwarded") return "Shipped — Tracking available";
  if (forwarding === "failed") return "Forwarding failed — retry";
  if (fulfillment === "processing" || fulfillment === "packed") return "Preparing your order";
  if (status === "confirmed") return "Order confirmed";
  return "Order placed";
};

export function OrderTimeline({
  createdAt,
  forwardedAt,
  shippedAt,
  deliveredAt,
  expectedDeliveryDate,
  fulfillmentStatus,
  forwardingStatus,
  orderStatus,
  paymentStatus,
  hasTracking,
  carrier,
  trackingNumber,
  trackingUrl,
  compact = false,
}: {
  createdAt?: string | null;
  forwardedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  expectedDeliveryDate?: string | null;
  fulfillmentStatus?: string | null;
  forwardingStatus?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  hasTracking?: boolean;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  compact?: boolean;
}) {
  const activeIndex = fulfillmentToStepIndex(orderStatus, fulfillmentStatus, forwardingStatus, !!hasTracking);
  const isCancelled = fulfillmentStatus === "cancelled" || fulfillmentStatus === "returned" || orderStatus === "cancelled";
  const isRefunded = fulfillmentStatus === "returned";

  if (isCancelled || isRefunded) {
    return (
      <div className="space-y-2">
        <div className="rounded-2xl bg-destructive/5 p-4 ring-1 ring-destructive/20 flex items-center gap-3">
          {isRefunded ? <Undo2 className="size-5 text-destructive" /> : <AlertCircle className="size-5 text-destructive" />}
          <div>
            <p className="text-sm font-medium text-destructive capitalize">{isRefunded ? "Refunded" : "Cancelled"}</p>
            <p className="text-xs text-muted-foreground">{isRefunded ? "This order was refunded." : "This order was cancelled."}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground px-1">{statusMessage(orderStatus, fulfillmentStatus, forwardingStatus, paymentStatus)}</p>
      </div>
    );
  }

  return (
    <div className={cn(compact ? "space-y-0" : "space-y-1")}>
      <p className={cn("text-xs font-medium mb-2", compact ? "hidden sm:block" : "")}>{statusMessage(orderStatus, fulfillmentStatus, forwardingStatus, paymentStatus)}</p>
      <div className="flex gap-1 sm:gap-2">
        {STEPS.map((step, idx) => {
          const isDone = idx < activeIndex;
          const isActive = idx === activeIndex;
          const Icon = step.icon;
          // Skip rendering middle steps on compact mobile? Keep all but hide labels where needed
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-center">
                {idx > 0 && <div className={cn("h-0.5 flex-1", isDone || isActive ? "bg-brand" : "bg-border")} />}
                <div
                  className={cn(
                    "grid size-7 sm:size-8 shrink-0 place-items-center rounded-full ring-1",
                    isDone ? "bg-brand text-brand-foreground ring-brand" : isActive ? "bg-brand text-brand-foreground ring-brand shadow" : "bg-card text-muted-foreground ring-border",
                  )}
                >
                  {isDone ? <Check className="size-3.5 sm:size-4" /> : <Icon className="size-3.5 sm:size-4" />}
                </div>
                {idx < STEPS.length - 1 && <div className={cn("h-0.5 flex-1", isDone ? "bg-brand" : "bg-border")} />}
              </div>
              <span className={cn("text-[10px] sm:text-xs font-medium text-center leading-tight", isActive ? "text-brand" : isDone ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </span>
              {!compact && (
                <span className="text-[11px] text-muted-foreground text-center leading-tight hidden sm:block">
                  {idx === 0 && createdAt ? new Date(createdAt).toLocaleDateString() : idx === 1 && forwardedAt ? new Date(forwardedAt).toLocaleDateString() : idx === 3 && shippedAt ? new Date(shippedAt).toLocaleDateString() : idx === 5 && deliveredAt ? new Date(deliveredAt).toLocaleDateString() : step.description}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {(hasTracking || shippedAt || expectedDeliveryDate) && (
        <div className="mt-3 rounded-xl bg-brand-soft p-3 text-sm space-y-1">
          {shippedAt && <p className="text-xs text-muted-foreground">Shipped: {new Date(shippedAt).toLocaleDateString()}</p>}
          {expectedDeliveryDate && <p className="text-xs text-muted-foreground">Expected: {new Date(expectedDeliveryDate).toLocaleDateString()}</p>}
          {deliveredAt && <p className="text-xs text-muted-foreground">Delivered: {new Date(deliveredAt).toLocaleDateString()}</p>}
          {hasTracking && trackingNumber && (
            <p className="font-medium">
              {carrier ?? "Carrier"} — <span className="font-mono">{trackingNumber}</span>
            </p>
          )}
          {hasTracking && !trackingNumber && <p className="text-sm">Tracking not yet available</p>}
          {trackingUrl && (
            <a href={trackingUrl} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex text-xs font-medium text-brand hover:underline">
              Track Shipment →
            </a>
          )}
        </div>
      )}
      {!hasTracking && !shippedAt && activeIndex < 3 && (
        <p className="mt-2 text-xs text-muted-foreground">Tracking will appear once shipped.</p>
      )}
    </div>
  );
}
