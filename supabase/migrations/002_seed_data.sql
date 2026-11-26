-- ============================================================================
-- THE KITE — Initial Seed Data (Run after 001_initial_schema.sql)
-- ============================================================================

INSERT INTO public.categories (name, slug, description, display_order, is_active) VALUES
  ('Single Origin Arabica', 'single-origin-arabica', 'High-grown Brazilian Arabica lots with balanced sweetness and chocolate body.', 1, TRUE),
  ('Espresso Blends', 'espresso-blends', 'Rich crema-forward blends crafted for espresso machines and moka pots.', 2, TRUE),
  ('Specialty Roasts', 'specialty-roasts', 'Small-batch honey process and peaberry harvests from Minas Gerais.', 3, TRUE),
  ('Cold Brew & Filter', 'cold-brew-filter', 'Coarse-friendly bright roasts tailored for pour-over and cold extraction.', 4, TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.delivery_zones (district, area_thana, delivery_charge, estimated_days, is_active) VALUES
  ('Dhaka', 'Dhaka Metro (Gulshan, Banani, Dhanmondi, Uttara, Mirpur)', 70, '24–48 Hours', TRUE),
  ('Dhaka', 'Dhaka Suburbs (Savar, Keraniganj, Gazipur)', 110, '2–3 Days', TRUE),
  ('Chattogram', 'Chattogram City', 130, '2–4 Days', TRUE),
  ('Sylhet', 'Sylhet Sadar', 140, '3–4 Days', TRUE),
  ('Rajshahi', 'Rajshahi City', 140, '3–4 Days', TRUE),
  ('Khulna', 'Khulna City', 140, '3–4 Days', TRUE),
  ('Nationwide', 'Other Districts (Steadfast / RedX Courier)', 160, '3–5 Days', TRUE)
ON CONFLICT (district, area_thana) DO NOTHING;

INSERT INTO public.whatsapp_templates (status_key, label, template_text) VALUES
  ('Confirmed', 'Confirm Order', 'Hello [Customer Name], your order #[Order ID] from THE KITE has been confirmed successfully. Thank you for choosing our Brazilian Coffee. We will process your order shortly.'),
  ('Processing', 'Processing', 'Hello [Customer Name], your order #[Order ID] is now being prepared and freshly packed. Thank you for shopping with THE KITE.'),
  ('Shipped', 'Shipped', 'Hello [Customer Name], your order #[Order ID] has been shipped via courier. You will receive your coffee soon.'),
  ('Out for Delivery', 'Out for Delivery', 'Hello [Customer Name], your order #[Order ID] is out for delivery today (Total COD: [Total]). Please stay available to receive your package.'),
  ('Delivered', 'Delivered', 'Hello [Customer Name], your order #[Order ID] has been successfully delivered. We hope you enjoy your THE KITE Brazilian coffee!'),
  ('Cancelled', 'Cancelled', 'Hello [Customer Name], your order #[Order ID] from THE KITE has been cancelled as requested. Please reach out anytime if you would like to place a new order.')
ON CONFLICT (status_key) DO NOTHING;

INSERT INTO public.website_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customer_reviews (customer_name, customer_location, rating, review_text, product_name, display_order, is_active) VALUES
  ('Rafiqul Islam', 'Banani, Dhaka', 5, 'The Cerrado Mineiro Gold has an unmistakable roasted hazelnut aroma. Easily the freshest Brazilian beans I have brewed in Dhaka.', 'Cerrado Mineiro Gold', 1, TRUE),
  ('Nusrat Jahan', 'Dhanmondi, Dhaka', 5, 'Ordered on Tuesday afternoon and received the parcel the next morning. Rich crema on my moka pot with zero bitterness.', 'Sul de Minas Espresso', 2, TRUE),
  ('Tanvir Ahmed', 'Nasirabad, Chattogram', 5, 'Packaging keeps the aroma sealed wonderfully. The Mantiqueira Honey Process shines in pour-over with sweet caramel notes.', 'Mantiqueira Honey Process', 3, TRUE);
