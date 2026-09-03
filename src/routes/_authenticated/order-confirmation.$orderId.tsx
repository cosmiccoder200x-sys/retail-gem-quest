import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ShoppingBag, Truck, CreditCard } from "lucide-react";
import { OrderTimeline } from "@/components/orders/OrderTimeline";

export const Route = createFileRoute("/_authenticated/order-confirmation/$orderId")({
  head: () => ({ meta: [{ title: "Order Confirmed — GullyGadget" }] }),
  component: OrderConfirmation,
});

function OrderConfirmation() {
  const { orderId } = Route.useParams();
  const { user } = useAuth();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-confirmation", orderId],
    enabled: !!user && !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-3/4" />
          <div className="h-4 bg-secondary rounded w-1/2" />
          <div className="h-40 bg-secondary rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-center">
        <h1 className="font-display text-2xl uppercase">Order not found</h1>
        <p className="mt-2 text-muted-foreground">
          We couldn't find this order. Check your account for all orders.
        </p>
        <Button asChild className="mt-4 rounded-full">
          <Link to="/account" hash="orders">View My Orders</Link>
        </Button>
      </div>
    );
  }

  const isPaid = order.payment_status === "paid";
  const isCOD = order.payment_method === "cod";
  const hasTracking = !!order.tracking_number;
  const addr = order.shipping_address_snapshot as Record<string, string> | null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Success Header */}
      <div className="text-center mb-8">
        <CheckCircle className={`mx-auto size-16 ${isPaid || isCOD ? "text-success" : "text-muted-foreground"}`} />
        <h1 className="mt-4 font-display text-3xl uppercase">
          {isPaid ? "Payment Successful" : isCOD ? "Order Confirmed" : "Order Placed"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isCOD
            ? "Cash on Delivery — pay when your order arrives."
            : isPaid
            ? "Your payment has been received and verified."
            : "Your order has been placed. Complete payment to confirm."}
        </p>
      </div>

      {/* Timeline */}
      <div className="rounded-3xl bg-white p-6 ring-1 ring-brand/5 mb-6">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-4">Order Progress</h2>
        <OrderTimeline
          createdAt={order.created_at}
          forwardedAt={order.forwarded_at}
          shippedAt={order.shipped_at}
          deliveredAt={order.delivered_at}
          expectedDeliveryDate={order.expected_delivery_date}
          fulfillmentStatus={order.fulfillment_status}
          forwardingStatus={order.forwarding_status}
          orderStatus={order.status}
          paymentStatus={order.payment_status}
          hasTracking={hasTracking}
          carrier={order.tracking_carrier}
          trackingNumber={order.tracking_number}
          trackingUrl={order.tracking_url}
        />
      </div>

      {/* Order Details Card */}
      <div className="rounded-3xl bg-white p-6 ring-1 ring-brand/5 space-y-4">
        {/* Order Number */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Order Number
            </p>
            <p className="font-mono text-lg">{order.order_number || `#${orderId.slice(0, 8)}`}</p>
          </div>
          <Badge variant={isPaid || isCOD ? "default" : "secondary"} className="capitalize">
            {order.status}
          </Badge>
        </div>

        {/* Status Row */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Payment</p>
              <p className="font-medium capitalize">
                {isCOD ? "Cash on Delivery" : isPaid ? "Paid" : order.payment_status}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Fulfillment</p>
              <p className="font-medium capitalize">{order.fulfillment_status || "pending"}</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="border-t border-border pt-4">
          <h3 className="font-bold text-sm mb-3">Items</h3>
          <div className="space-y-2">
            {order.order_items?.map((item: Record<string, unknown>) => (
              <div key={item.id as string} className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  {item.product_image && (
                    <img
                      src={item.product_image as string}
                      alt={item.product_name as string}
                      className="size-10 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="font-medium">{item.product_name as string}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity as number}</p>
                  </div>
                </div>
                <span>{formatINR((item.price as number) * (item.quantity as number))}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-border pt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatINR(Number(order.subtotal))}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{Number(order.shipping) === 0 ? "Free" : formatINR(Number(order.shipping))}</span>
          </div>
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between text-success">
              <span>Discount</span>
              <span>-{formatINR(Number(order.discount_amount))}</span>
            </div>
          )}
          <div className="flex justify-between font-display text-lg border-t border-border pt-2">
            <span>Total</span>
            <span>{formatINR(Number(order.total))}</span>
          </div>
        </div>

        {/* Shipping Address */}
        {addr && (
          <div className="border-t border-border pt-4">
            <h3 className="font-bold text-sm mb-2">Shipping Address</h3>
            <p className="text-sm text-muted-foreground">
              {addr.full_name}, {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}
              <br />
              {addr.city}, {addr.state} - {addr.pincode}
              <br />
              Phone: {addr.phone}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Button asChild className="flex-1 rounded-full" variant="outline">
          <Link to="/account" hash="orders">
            <ShoppingBag className="mr-2 size-4" /> View My Orders
          </Link>
        </Button>
        <Button asChild className="flex-1 rounded-full bg-brand hover:bg-accent-cyan">
          <Link to="/products">Continue Shopping</Link>
        </Button>
      </div>

      {hasTracking && (
        <div className="mt-4 text-center">
          <Link to="/track" className="text-sm text-brand hover:underline">
            Track this order →
          </Link>
        </div>
      )}
    </div>
  );
}
