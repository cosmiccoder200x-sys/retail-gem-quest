ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number text UNIQUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_order_number() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_number ON public.orders;
CREATE TRIGGER trg_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

UPDATE public.orders SET order_number = 'ORD-' || to_char(created_at, 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0') WHERE order_number IS NULL;

CREATE OR REPLACE FUNCTION public.lookup_order(_order_number text, _email text) RETURNS TABLE(id uuid, order_number text, status text, total numeric, created_at timestamptz, tracking_carrier text, tracking_number text, tracking_url text, forwarding_status text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number, o.status::TEXT, o.total, o.created_at, o.tracking_carrier, o.tracking_number, o.tracking_url, o.forwarding_status
  FROM public.orders o
  WHERE (upper(o.order_number) = upper(_order_number) OR o.id::text = _order_number)
    AND lower(o.customer_email) = lower(_email)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_order(text, text) TO anon, authenticated;

INSERT INTO public.coupons (code, discount_type, discount_value, min_order_total) VALUES
  ('WELCOME10', 'percent', 10, 299),
  ('FLAT50', 'flat', 50, 499)
ON CONFLICT (code) DO NOTHING;