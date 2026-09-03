import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gullygadget.com",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Verify Razorpay webhook signature
async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);
  const data = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, data);
  const generatedSignature = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return generatedSignature === signature;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayWebhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

    // Read the raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    if (!razorpayWebhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const isValid = await verifyWebhookSignature(rawBody, signature, razorpayWebhookSecret);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = JSON.parse(rawBody);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle different event types
    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload.payment.entity;
        await handlePaymentCaptured(supabase, payment);
        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment.entity;
        await handlePaymentFailed(supabase, payment);
        break;
      }

      case "order.paid": {
        const order = event.payload.order.entity;
        await handleOrderPaid(supabase, order);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event.event}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("razorpay-webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handlePaymentCaptured(
  supabase: ReturnType<typeof createClient>,
  payment: Record<string, unknown>
) {
  const razorpayOrderId = payment.order_id as string;
  const razorpayPaymentId = payment.id as string;

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, order_id, status, amount")
    .eq("provider_order_id", razorpayOrderId)
    .eq("provider", "razorpay")
    .maybeSingle();

  if (!existingPayment) {
    console.error("No payment record found for Razorpay order:", razorpayOrderId);
    return;
  }
  if (existingPayment.status === "paid") {
    console.log("Payment already captured, skipping:", razorpayOrderId);
    return;
  }
  // Prevent downgrade: if already failed, don't auto-mark paid? Allow upgrade failed->paid
  const { data: order } = await supabase.from("orders").select("total, payment_status, status, fulfillment_status").eq("id", existingPayment.order_id).single();
  if (!order) return;
  if (order.fulfillment_status === "cancelled" || order.fulfillment_status === "delivered" || order.status === "cancelled") {
    console.log("Order in terminal state, skipping capture:", razorpayOrderId);
    return;
  }
  const expectedPaise = Math.round(Number(order.total) * 100);
  if (payment.amount !== undefined && Number(payment.amount) !== expectedPaise) {
    console.error(`Amount mismatch for ${razorpayOrderId}: got ${payment.amount}, expected ${expectedPaise}`);
    return;
  }
  await supabase
    .from("payments")
    .update({
      provider_payment_id: razorpayPaymentId,
      status: "paid",
      metadata: JSON.stringify({
        webhook_event: "payment.captured",
        captured_at: new Date().toISOString(),
        razorpay_amount: payment.amount,
        razorpay_currency: payment.currency,
      }),
    })
    .eq("id", existingPayment.id);

  await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: order.status === "cancelled" ? order.status : "confirmed",
    })
    .eq("id", existingPayment.order_id);
  console.log("Payment captured via webhook:", razorpayOrderId);
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  payment: Record<string, unknown>
) {
  const razorpayOrderId = payment.order_id as string;

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("provider_order_id", razorpayOrderId)
    .eq("provider", "razorpay")
    .maybeSingle();

  if (!existingPayment) {
    console.error("No payment record found for failed payment:", razorpayOrderId);
    return;
  }
  if (existingPayment.status === "failed") {
    console.log("Payment already marked as failed, skipping:", razorpayOrderId);
    return;
  }
  // Never downgrade paid → failed
  if (existingPayment.status === "paid") {
    console.log("Payment already paid, ignoring failed event:", razorpayOrderId);
    return;
  }

  // Update payment status
  await supabase
    .from("payments")
    .update({
      status: "failed",
      metadata: JSON.stringify({
        webhook_event: "payment.failed",
        failed_at: new Date().toISOString(),
        error_description: payment.error_description || "",
      }),
    })
    .eq("id", existingPayment.id);

  // Update order payment status
  await supabase
    .from("orders")
    .update({
      payment_status: "failed",
    })
    .eq("id", existingPayment.order_id);

  console.log("Payment failed via webhook:", razorpayOrderId);
}

async function handleOrderPaid(
  supabase: ReturnType<typeof createClient>,
  razorpayOrder: Record<string, unknown>
) {
  const razorpayOrderId = razorpayOrder.id as string;

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("provider_order_id", razorpayOrderId)
    .eq("provider", "razorpay")
    .maybeSingle();

  if (!existingPayment) {
    console.error("No payment record found for order.paid:", razorpayOrderId);
    return;
  }

  // Idempotent: skip if already paid
  if (existingPayment.status === "paid") {
    console.log("Order already paid, skipping:", razorpayOrderId);
    return;
  }

  // Update payment
  await supabase
    .from("payments")
    .update({
      status: "paid",
      metadata: JSON.stringify({
        webhook_event: "order.paid",
        paid_at: new Date().toISOString(),
      }),
    })
    .eq("id", existingPayment.id);

  // Update order
  await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "confirmed",
    })
    .eq("id", existingPayment.order_id);

  console.log("Order paid via webhook:", razorpayOrderId);
}
