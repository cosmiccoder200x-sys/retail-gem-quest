
-- =========================================================
-- ROLES
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- CATEGORIES
-- =========================================================
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories" ON public.categories
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- PRODUCTS
-- =========================================================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  short_description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  mrp numeric(10,2) CHECK (mrp >= 0),
  stock int NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  rating numeric(2,1) NOT NULL DEFAULT 4.5 CHECK (rating >= 0 AND rating <= 5),
  review_count int NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_bestseller boolean NOT NULL DEFAULT false,
  badge text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read products" ON public.products
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_featured ON public.products(is_featured) WHERE is_featured;
CREATE INDEX idx_products_bestseller ON public.products(is_bestseller) WHERE is_bestseller;

-- =========================================================
-- ADDRESSES
-- =========================================================
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own addresses" ON public.addresses
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================================================
-- CART
-- =========================================================
CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart" ON public.cart_items
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================================================
-- WISHLIST
-- =========================================================
CREATE TABLE public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wishlist" ON public.wishlist_items
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================================================
-- ORDERS
-- =========================================================
CREATE TYPE public.order_status AS ENUM ('pending','confirmed','shipped','delivered','cancelled');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal numeric(10,2) NOT NULL,
  shipping numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL,
  shipping_address jsonb NOT NULL,
  payment_method text NOT NULL DEFAULT 'cod',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders" ON public.orders
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_image text,
  price numeric(10,2) NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0)
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order items" ON public.order_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Users insert own order items" ON public.order_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

-- =========================================================
-- SEED DATA
-- =========================================================
INSERT INTO public.categories (name, slug, sort_order) VALUES
  ('Mini Coolers', 'mini-coolers', 1),
  ('Kitchen Tech', 'kitchen-tech', 2),
  ('Smart Lighting', 'smart-lighting', 3),
  ('Personal Care', 'personal-care', 4);

INSERT INTO public.products (name, slug, short_description, description, price, mrp, stock, category_id, rating, review_count, is_featured, is_bestseller, badge, specs) VALUES
  ('Aero-Flow Mini Desk Cooler', 'aero-flow-mini-cooler', 'Compact personal air cooler with 3-speed turbine', 'The Aero-Flow Mini delivers powerful cooling in a desk-friendly footprint. USB-C powered, whisper-quiet 32dB operation, and a 350ml water tank that lasts the workday.', 749, 1499, 142, (SELECT id FROM public.categories WHERE slug='mini-coolers'), 4.8, 1240, true, true, 'Flash Sale', '{"Power":"USB-C 5V","Tank":"350ml","Noise":"32dB","Speeds":"3"}'::jsonb),
  ('Pulse Neck Fan', 'pulse-neck-fan', 'Hands-free portable cooling, 8hr battery', 'Wear-anywhere bladeless neck fan with 3-speed turbo cooling and an 8-hour battery. Perfect for commutes and outdoor work.', 849, 1199, 87, (SELECT id FROM public.categories WHERE slug='mini-coolers'), 4.7, 562, true, true, '-29%', '{"Battery":"4000mAh","Runtime":"8 hrs","Weight":"260g"}'::jsonb),
  ('Urban USB Blender', 'urban-usb-blender', 'Rechargeable smoothie maker, 400ml', 'USB-C rechargeable portable blender. 6-blade stainless steel for smoothies on the go.', 999, 1799, 64, (SELECT id FROM public.categories WHERE slug='kitchen-tech'), 4.9, 893, true, true, 'Top Rated', '{"Capacity":"400ml","Battery":"2000mAh","Blades":"6"}'::jsonb),
  ('Crumbsucker Desk Vacuum', 'crumbsucker-desk-vacuum', 'High-suction mini vacuum for keyboards', 'Pocket-size vacuum with HEPA filter. Cleans keyboards, car interiors and desks in seconds.', 699, 999, 210, (SELECT id FROM public.categories WHERE slug='personal-care'), 4.6, 412, true, false, 'Bestseller', '{"Suction":"6kPa","Battery":"1200mAh"}'::jsonb),
  ('SwiftBoil Egg Maker', 'swiftboil-egg-maker', '7-egg capacity electric boiler', 'Soft, medium, or hard — perfect eggs every time. 7-egg capacity, auto shut-off.', 599, 999, 156, (SELECT id FROM public.categories WHERE slug='kitchen-tech'), 4.6, 318, false, true, '-40%', '{"Capacity":"7 eggs","Power":"350W","Auto-off":"Yes"}'::jsonb),
  ('Motion Sensor LED Strip', 'motion-sensor-led-strip', 'Magnetic, auto-on warm light', '1.2m magnetic LED strip with motion sensor. Auto-on warm light for wardrobes, hallways, kitchens.', 499, 999, 320, (SELECT id FROM public.categories WHERE slug='smart-lighting'), 4.7, 678, true, false, 'Hot Deal', '{"Length":"1.2m","Battery":"USB-C rechargeable","Sensor":"PIR motion"}'::jsonb),
  ('ZenCloud USB Humidifier', 'zencloud-humidifier', 'Cool-mist 300ml humidifier', 'Wood-grain ultrasonic humidifier with mood light. 6-hour quiet operation.', 449, 899, 198, (SELECT id FROM public.categories WHERE slug='personal-care'), 4.7, 521, false, true, NULL, '{"Capacity":"300ml","Runtime":"6 hrs","Mode":"Ultrasonic"}'::jsonb),
  ('Compact Car Vacuum Pro', 'compact-car-vacuum-pro', 'Wireless HEPA filter, powerful suction', 'Cordless car vacuum with strong suction and washable HEPA filter. Multiple nozzles included.', 999, 1999, 76, (SELECT id FROM public.categories WHERE slug='personal-care'), 4.5, 287, false, true, '-50%', '{"Suction":"9kPa","Battery":"2200mAh","Runtime":"30 min"}'::jsonb),
  ('Galaxy Star Projector', 'galaxy-star-projector', 'Rotating night-sky bedroom projector', 'Bluetooth-enabled star and galaxy projector. Multiple modes, music sync, remote control.', 899, 1599, 134, (SELECT id FROM public.categories WHERE slug='smart-lighting'), 4.8, 945, true, false, 'Trending', '{"Connectivity":"Bluetooth 5.0","Modes":"8","Timer":"Yes"}'::jsonb),
  ('Hot & Cold Insulated Bottle', 'hot-cold-insulated-bottle', '24hr cold / 12hr hot, 500ml', 'Double-walled stainless steel insulated bottle. Keeps drinks cold 24h, hot 12h.', 549, 899, 240, (SELECT id FROM public.categories WHERE slug='kitchen-tech'), 4.6, 392, false, false, NULL, '{"Capacity":"500ml","Material":"Stainless steel","Cold":"24 hrs"}'::jsonb),
  ('Mini Coffee Maker', 'mini-coffee-maker', 'One-touch espresso for desks', 'Compact 350ml coffee maker for office desks. Single-button operation, auto shut-off.', 949, 1499, 58, (SELECT id FROM public.categories WHERE slug='kitchen-tech'), 4.4, 187, false, false, '-37%', '{"Capacity":"350ml","Power":"600W"}'::jsonb),
  ('Smart Touch Desk Lamp', 'smart-touch-desk-lamp', 'Dimmable, USB charging port', 'Touch-control dimmable LED lamp with 3 color temperatures and built-in USB charging.', 799, 1299, 168, (SELECT id FROM public.categories WHERE slug='smart-lighting'), 4.7, 433, false, true, NULL, '{"Brightness":"3 levels","Color temps":"3","USB":"5V/1A"}'::jsonb);
