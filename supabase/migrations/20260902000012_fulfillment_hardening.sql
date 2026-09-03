-- =========================================================
-- 012 — Fulfillment Hardening: lifecycle, audit log, notifications, shipping dates
-- =========================================================

-- Shipping dates + failure reason
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS forwarding_failure_reason TEXT;

-- Tracking URL safety: only http/https
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_tracking_url_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_tracking_url_check
      CHECK (tracking_url IS NULL OR tracking_url ~ '^https?://[^\\s]+$');
  END IF;
END $$;

-- Order status history / audit log
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT,
  previous_fulfillment TEXT,
  new_fulfillment TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read history" ON public.order_status_history;
CREATE POLICY "Admins read history" ON public.order_status_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Customers read own history" ON public.order_status_history;
CREATE POLICY "Customers read own history" ON public.order_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
GRANT SELECT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
CREATE INDEX IF NOT EXISTS idx_order_history_order ON public.order_status_history(order_id, created_at DESC);

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) OR (OLD.fulfillment_status IS DISTINCT FROM NEW.fulfillment_status) THEN
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, previous_fulfillment, new_fulfillment, changed_by)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, OLD.fulfillment_status::text, NEW.fulfillment_status::text, auth.uid());
  END IF;
  -- Auto-set timestamps
  IF NEW.fulfillment_status = 'shipped' AND OLD.fulfillment_status <> 'shipped' AND NEW.shipped_at IS NULL THEN
    NEW.shipped_at := now();
  END IF;
  IF NEW.fulfillment_status = 'delivered' AND OLD.fulfillment_status <> 'delivered' AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at := now();
  END IF;
  IF NEW.fulfillment_status = 'cancelled' AND OLD.fulfillment_status <> 'cancelled' THEN
    -- keep shipped/delivered timestamps as is
    NULL;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_log_order_status ON public.orders;
CREATE TRIGGER trg_log_order_status BEFORE UPDATE OF status, fulfillment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- Order notifications (event hooks, no fake sending)
CREATE TABLE IF NOT EXISTS public.order_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('order_placed','payment_success','order_confirmed','order_shipped','order_delivered','order_cancelled')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  provider TEXT DEFAULT 'none',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read notifications" ON public.order_notifications;
CREATE POLICY "Admins read notifications" ON public.order_notifications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Customers read own notifications" ON public.order_notifications;
CREATE POLICY "Customers read own notifications" ON public.order_notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
GRANT SELECT ON public.order_notifications TO authenticated;
GRANT ALL ON public.order_notifications TO service_role;
CREATE INDEX IF NOT EXISTS idx_order_notifications_order ON public.order_notifications(order_id, created_at DESC);
CREATE TRIGGER order_notifications_updated BEFORE UPDATE ON public.order_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enqueue notification on order lifecycle events (idempotent)
CREATE OR REPLACE FUNCTION public.enqueue_order_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event TEXT;
BEGIN
  -- Only enqueue on meaningful transitions
  IF TG_OP = 'INSERT' THEN
    v_event := 'order_placed';
  ELSIF NEW.payment_status = 'paid' AND OLD.payment_status <> 'paid' THEN
    v_event := 'payment_success';
  ELSIF NEW.status = 'confirmed' AND OLD.status <> 'confirmed' THEN
    v_event := 'order_confirmed';
  ELSIF NEW.fulfillment_status = 'shipped' AND OLD.fulfillment_status <> 'shipped' THEN
    v_event := 'order_shipped';
  ELSIF NEW.fulfillment_status = 'delivered' AND OLD.fulfillment_status <> 'delivered' THEN
    v_event := 'order_delivered';
  ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    v_event := 'order_cancelled';
  ELSE
    RETURN NEW;
  END IF;

  -- Idempotent: don't duplicate same event for same order if pending already exists
  IF NOT EXISTS (SELECT 1 FROM public.order_notifications WHERE order_id = NEW.id AND event = v_event AND status = 'pending') THEN
    INSERT INTO public.order_notifications (order_id, event, status, provider)
    VALUES (NEW.id, v_event, 'pending', 'none');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_enqueue_notification_insert ON public.orders;
CREATE TRIGGER trg_enqueue_notification_insert AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_notification();
DROP TRIGGER IF EXISTS trg_enqueue_notification_update ON public.orders;
CREATE TRIGGER trg_enqueue_notification_update AFTER UPDATE OF status, payment_status, fulfillment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_notification();

-- Required provider configuration note (no secrets)
COMMENT ON TABLE public.order_notifications IS 'Notification events: configure provider (e.g., resend, twilio) via Edge Function env SMTP_API_KEY etc. Until configured, provider=none and status stays pending.';

-- Index for forwarding status already exists, ensure delivered/out_for_delivery index
CREATE INDEX IF NOT EXISTS idx_orders_shipped_at ON public.orders(shipped_at) WHERE shipped_at IS NOT NULL;

-- Update lookup_order to include shipped/delivered info for tracking
CREATE OR REPLACE FUNCTION public.lookup_order(_order_id UUID, _email TEXT)
RETURNS TABLE (
  id UUID, order_number TEXT, status TEXT, total NUMERIC, created_at TIMESTAMPTZ,
  tracking_carrier TEXT, tracking_number TEXT, tracking_url TEXT,
  forwarding_status TEXT, fulfillment_status TEXT,
  payment_status TEXT, payment_method TEXT, customer_email TEXT,
  shipped_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, expected_delivery_date DATE
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number, o.status::TEXT, o.total, o.created_at,
         o.tracking_carrier, o.tracking_number, o.tracking_url,
         o.forwarding_status, o.fulfillment_status::TEXT,
         o.payment_status::TEXT, o.payment_method, o.customer_email,
         o.shipped_at, o.delivered_at, o.expected_delivery_date
  FROM public.orders o
  WHERE o.id = _order_id AND lower(o.customer_email) = lower(_email)
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.lookup_order(_order_number TEXT, _email TEXT)
RETURNS TABLE (
  id UUID, order_number TEXT, status TEXT, total NUMERIC, created_at TIMESTAMPTZ,
  tracking_carrier TEXT, tracking_number TEXT, tracking_url TEXT,
  forwarding_status TEXT, fulfillment_status TEXT,
  payment_status TEXT, payment_method TEXT, customer_email TEXT,
  shipped_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, expected_delivery_date DATE
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number, o.status::TEXT, o.total, o.created_at,
         o.tracking_carrier, o.tracking_number, o.tracking_url,
         o.forwarding_status, o.fulfillment_status::TEXT,
         o.payment_status::TEXT, o.payment_method, o.customer_email,
         o.shipped_at, o.delivered_at, o.expected_delivery_date
  FROM public.orders o
  WHERE o.order_number = _order_number AND lower(o.customer_email) = lower(_email)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_order(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_order(TEXT, TEXT) TO anon, authenticated;
