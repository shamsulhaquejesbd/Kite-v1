-- ============================================================================
-- THE KITE — Brazilian Coffee E-Commerce Platform
-- Complete Supabase PostgreSQL Schema, RLS Policies, Storage & Atomic RPCs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. admin_users
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'Administrator',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'manager')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper function for RLS admin checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  tasting_notes TEXT[] NOT NULL DEFAULT '{}',
  origin TEXT NOT NULL DEFAULT 'Brazil',
  roast_level TEXT NOT NULL DEFAULT 'Medium Roast',
  weight_label TEXT NOT NULL DEFAULT '250g',
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  discount_price NUMERIC(12, 2) CHECK (discount_price IS NULL OR discount_price >= 0),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active_order ON public.products(is_active, display_order);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. product_images
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id, display_order);

-- 6. inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID UNIQUE NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  current_stock INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  sold_quantity INT NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
  low_stock_threshold INT NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. delivery_zones
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district TEXT NOT NULL,
  area_thana TEXT NOT NULL DEFAULT 'All Areas',
  delivery_charge NUMERIC(12, 2) NOT NULL DEFAULT 120 CHECK (delivery_charge >= 0),
  estimated_days TEXT NOT NULL DEFAULT '2–3 Days',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(district, area_thana)
);

CREATE TRIGGER trg_delivery_zones_updated_at
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  district TEXT NOT NULL,
  area_thana TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  order_notes TEXT DEFAULT '',
  internal_notes TEXT DEFAULT '',
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  delivery_charge NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0),
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'Cash on Delivery',
  payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Paid', 'Refunded')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (
    status IN ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled')
  ),
  stock_restored BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_number_phone ON public.orders(order_number, phone);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL DEFAULT '',
  weight_label TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 10. order_status_history
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id, created_at ASC);

-- 11. stock_movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'adjustment', 'sale', 'cancellation_restore')),
  quantity_change INT NOT NULL,
  previous_stock INT NOT NULL,
  new_stock INT NOT NULL,
  reference_id TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);

-- 12. customer_reviews
CREATE TABLE IF NOT EXISTS public.customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_location TEXT NOT NULL DEFAULT 'Dhaka, Bangladesh',
  rating INT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT NOT NULL,
  avatar_url TEXT DEFAULT '',
  product_name TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_customer_reviews_updated_at
  BEFORE UPDATE ON public.customer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 13. website_settings
CREATE TABLE IF NOT EXISTS public.website_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  brand_name TEXT NOT NULL DEFAULT 'THE KITE',
  website_title TEXT NOT NULL DEFAULT 'THE KITE — Authentic Brazilian Coffee',
  meta_description TEXT NOT NULL DEFAULT 'Discover the taste of authentic Brazilian coffee in Bangladesh.',
  logo_url TEXT DEFAULT '',
  favicon_url TEXT DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#4C8C3B',
  secondary_color TEXT NOT NULL DEFAULT '#141210',
  phone TEXT NOT NULL DEFAULT '+880 1700-000000',
  whatsapp_number TEXT NOT NULL DEFAULT '8801700000000',
  email TEXT NOT NULL DEFAULT 'hello@thekitecoffee.com',
  address TEXT NOT NULL DEFAULT 'Banani, Dhaka 1213, Bangladesh',
  facebook_url TEXT DEFAULT 'https://facebook.com',
  instagram_url TEXT DEFAULT 'https://instagram.com',
  youtube_url TEXT DEFAULT '',
  currency_symbol TEXT NOT NULL DEFAULT '৳',
  currency_code TEXT NOT NULL DEFAULT 'BDT',
  order_id_prefix TEXT NOT NULL DEFAULT 'KITE',
  default_delivery_charge NUMERIC(12, 2) NOT NULL DEFAULT 120,
  low_stock_threshold INT NOT NULL DEFAULT 10,
  footer_about TEXT NOT NULL DEFAULT 'Single-origin Brazilian Arabica & Robusta coffee, freshly roasted and delivered across Bangladesh.',
  footer_copyright TEXT NOT NULL DEFAULT '© 2026 THE KITE. All rights reserved.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_website_settings_updated_at
  BEFORE UPDATE ON public.website_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 14. homepage_sections
CREATE TABLE IF NOT EXISTS public.homepage_sections (
  section_key TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_homepage_sections_updated_at
  BEFORE UPDATE ON public.homepage_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 15. whatsapp_templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  status_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  template_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 16. newsletter_subscribers
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  is_subscribed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Public read policies for storefront catalog & CMS
CREATE POLICY "Public read active categories" ON public.categories FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Public read active products" ON public.products FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Public read product images" ON public.product_images FOR SELECT USING (TRUE);
CREATE POLICY "Public read inventory availability" ON public.inventory FOR SELECT USING (TRUE);
CREATE POLICY "Public read active delivery zones" ON public.delivery_zones FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Public read active reviews" ON public.customer_reviews FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Public read website settings" ON public.website_settings FOR SELECT USING (TRUE);
CREATE POLICY "Public read homepage sections" ON public.homepage_sections FOR SELECT USING (TRUE);

-- Newsletter public subscribe
CREATE POLICY "Public subscribe newsletter" ON public.newsletter_subscribers FOR INSERT WITH CHECK (TRUE);

-- Admin full access policies
CREATE POLICY "Admin manage profiles" ON public.profiles FOR ALL USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Admin read admin_users" ON public.admin_users FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin manage categories" ON public.categories FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage products" ON public.products FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage product_images" ON public.product_images FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage inventory" ON public.inventory FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage delivery_zones" ON public.delivery_zones FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage orders" ON public.orders FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage order_items" ON public.order_items FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage order_status_history" ON public.order_status_history FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage stock_movements" ON public.stock_movements FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage reviews" ON public.customer_reviews FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage website_settings" ON public.website_settings FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage homepage_sections" ON public.homepage_sections FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage whatsapp_templates" ON public.whatsapp_templates FOR ALL USING (public.is_admin());
CREATE POLICY "Admin manage newsletter" ON public.newsletter_subscribers FOR ALL USING (public.is_admin());

-- ============================================================================
-- ATOMIC INVENTORY & ORDER RPC FUNCTIONS (Prevents Overselling & Double-Restore)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.place_order_atomic(
  p_order_number TEXT,
  p_customer_name TEXT,
  p_phone TEXT,
  p_whatsapp_number TEXT,
  p_district TEXT,
  p_area_thana TEXT,
  p_delivery_address TEXT,
  p_order_notes TEXT,
  p_delivery_charge NUMERIC,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_subtotal NUMERIC(12, 2) := 0;
  v_item JSONB;
  v_product RECORD;
  v_inv RECORD;
  v_unit_price NUMERIC(12, 2);
  v_qty INT;
  v_line_total NUMERIC(12, 2);
  v_total NUMERIC(12, 2);
BEGIN
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must include at least one item';
  END IF;

  INSERT INTO public.orders (
    order_number, customer_name, phone, whatsapp_number,
    district, area_thana, delivery_address, order_notes,
    subtotal, delivery_charge, total_amount, payment_method, status
  ) VALUES (
    p_order_number, p_customer_name, p_phone, p_whatsapp_number,
    p_district, p_area_thana, p_delivery_address, COALESCE(p_order_notes, ''),
    0, p_delivery_charge, 0, 'Cash on Delivery', 'Pending'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::INT;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid item quantity';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID AND is_active = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or inactive', v_item->>'product_id';
    END IF;

    -- Lock inventory row for update to prevent concurrent overselling
    SELECT * INTO v_inv
    FROM public.inventory
    WHERE product_id = v_product.id
    FOR UPDATE;

    IF NOT FOUND OR v_inv.current_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for % (available: %)', v_product.name, COALESCE(v_inv.current_stock, 0);
    END IF;

    v_unit_price := COALESCE(v_product.discount_price, v_product.price);
    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_sku, weight_label,
      unit_price, quantity, line_total
    ) VALUES (
      v_order_id, v_product.id, v_product.name, v_product.sku, v_product.weight_label,
      v_unit_price, v_qty, v_line_total
    );

    UPDATE public.inventory
    SET current_stock = current_stock - v_qty,
        sold_quantity = sold_quantity + v_qty
    WHERE product_id = v_product.id;

    INSERT INTO public.stock_movements (
      product_id, movement_type, quantity_change, previous_stock, new_stock,
      reference_id, reason, created_by
    ) VALUES (
      v_product.id, 'sale', -v_qty, v_inv.current_stock, v_inv.current_stock - v_qty,
      p_order_number, 'Customer Order Placed', p_customer_name
    );
  END LOOP;

  v_total := v_subtotal + p_delivery_charge;

  UPDATE public.orders
  SET subtotal = v_subtotal,
      total_amount = v_total
  WHERE id = v_order_id;

  INSERT INTO public.order_status_history (order_id, status, note, changed_by)
  VALUES (v_order_id, 'Pending', 'Order placed via Cash on Delivery', p_customer_name);

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', p_order_number,
    'subtotal', v_subtotal,
    'delivery_charge', p_delivery_charge,
    'total_amount', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
  p_order_id UUID,
  p_note TEXT DEFAULT 'Cancelled by administrator',
  p_actor TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_inv RECORD;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'Cancelled' AND v_order.stock_restored = TRUE THEN
    RETURN jsonb_build_object('status', 'already_cancelled', 'stock_restored', TRUE);
  END IF;

  IF v_order.stock_restored = FALSE THEN
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id
    LOOP
      IF v_item.product_id IS NOT NULL THEN
        SELECT * INTO v_inv
        FROM public.inventory
        WHERE product_id = v_item.product_id
        FOR UPDATE;

        IF FOUND THEN
          UPDATE public.inventory
          SET current_stock = current_stock + v_item.quantity,
              sold_quantity = GREATEST(0, sold_quantity - v_item.quantity)
          WHERE product_id = v_item.product_id;

          INSERT INTO public.stock_movements (
            product_id, movement_type, quantity_change, previous_stock, new_stock,
            reference_id, reason, created_by
          ) VALUES (
            v_item.product_id, 'cancellation_restore', v_item.quantity,
            v_inv.current_stock, v_inv.current_stock + v_item.quantity,
            v_order.order_number, COALESCE(p_note, 'Order cancelled — stock restored'), p_actor
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET status = 'Cancelled',
      stock_restored = TRUE
  WHERE id = p_order_id;

  INSERT INTO public.order_status_history (order_id, status, note, changed_by)
  VALUES (p_order_id, 'Cancelled', COALESCE(p_note, 'Order cancelled'), p_actor);

  RETURN jsonb_build_object('status', 'Cancelled', 'stock_restored', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_stock_atomic(
  p_product_id UUID,
  p_delta INT,
  p_movement_type TEXT,
  p_reason TEXT,
  p_actor TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv RECORD;
  v_new_stock INT;
BEGIN
  SELECT * INTO v_inv
  FROM public.inventory
  WHERE product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory record not found for product';
  END IF;

  v_new_stock := v_inv.current_stock + p_delta;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot become negative (current: %, delta: %)', v_inv.current_stock, p_delta;
  END IF;

  UPDATE public.inventory
  SET current_stock = v_new_stock
  WHERE product_id = p_product_id;

  INSERT INTO public.stock_movements (
    product_id, movement_type, quantity_change, previous_stock, new_stock,
    reference_id, reason, created_by
  ) VALUES (
    p_product_id, p_movement_type, p_delta, v_inv.current_stock, v_new_stock,
    '', COALESCE(p_reason, 'Manual stock adjustment'), p_actor
  );

  RETURN jsonb_build_object(
    'product_id', p_product_id,
    'previous_stock', v_inv.current_stock,
    'new_stock', v_new_stock
  );
END;
$$;

-- ============================================================================
-- SUPABASE STORAGE BUCKET & POLICIES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('kite-media', 'kite-media', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read kite-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'kite-media');

CREATE POLICY "Admin upload kite-media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kite-media' AND public.is_admin());

CREATE POLICY "Admin update kite-media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'kite-media' AND public.is_admin());

CREATE POLICY "Admin delete kite-media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'kite-media' AND public.is_admin());
