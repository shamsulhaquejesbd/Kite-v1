export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string;
  is_primary: boolean;
  display_order: number;
}

export interface InventoryRecord {
  product_id: string;
  current_stock: number;
  sold_quantity: number;
  low_stock_threshold: number;
}

export interface Product {
  id: string;
  category_id: string | null;
  category_name?: string;
  name: string;
  slug: string;
  sku: string;
  short_description: string;
  description: string;
  tasting_notes: string[];
  origin: string;
  roast_level: string;
  weight_label: string;
  price: number;
  discount_price: number | null;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
  images: ProductImage[];
  current_stock: number;
  sold_quantity: number;
  low_stock_threshold: number;
  created_at?: string;
}

export interface DeliveryZone {
  id: string;
  district: string;
  area_thana: string;
  delivery_charge: number;
  estimated_days: string;
  is_active: boolean;
}

export interface CustomerReview {
  id: string;
  customer_name: string;
  customer_location: string;
  rating: number;
  review_text: string;
  avatar_url: string;
  product_name: string;
  is_active: boolean;
  display_order: number;
}

export interface WebsiteSettings {
  id: string;
  brand_name: string;
  website_title: string;
  meta_description: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  phone: string;
  whatsapp_number: string;
  email: string;
  address: string;
  facebook_url: string;
  instagram_url: string;
  youtube_url: string;
  currency_symbol: string;
  currency_code: string;
  order_id_prefix: string;
  default_delivery_charge: number;
  low_stock_threshold: number;
  footer_about: string;
  footer_copyright: string;
}

export interface HomepageSections {
  hero: {
    headline: string;
    subtitle: string;
    primary_cta_text: string;
    primary_cta_link: string;
    secondary_cta_text: string;
    secondary_cta_link: string;
    background_image_url: string;
    product_image_url: string;
    origin_badge: string;
  };
  brand: {
    kicker: string;
    heading: string;
    description: string;
    heritage_label: string;
    heritage_value: string;
    image_url: string;
    cta_text: string;
  };
  varieties: {
    heading: string;
    items: Array<{
      number: string;
      title: string;
      description: string;
      image_url: string;
    }>;
  };
  experience: {
    heading: string;
    description: string;
    left_image_url: string;
    right_image_url: string;
    cta_text: string;
  };
  why_choose: {
    heading: string;
    center_image_url: string;
    features: Array<{
      title: string;
      description: string;
      icon: string;
    }>;
  };
  stats: {
    heading: string;
    subtext: string;
    items: Array<{
      value: number;
      suffix: string;
      label: string;
    }>;
  };
  collection: {
    kicker: string;
    heading: string;
    description: string;
    featured_heading: string;
  };
  reviews_section: {
    heading: string;
    subtitle: string;
  };
  newsletter: {
    heading: string;
    description: string;
    button_text: string;
  };
}

export interface WhatsAppTemplate {
  status_key: string;
  label: string;
  template_text: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_sku: string;
  weight_label: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface OrderStatusHistoryEntry {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string;
  changed_by: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  whatsapp_number: string;
  district: string;
  area_thana: string;
  delivery_address: string;
  order_notes: string;
  internal_notes: string;
  subtotal: number;
  delivery_charge: number;
  total_amount: number;
  payment_method: string;
  payment_status: 'Unpaid' | 'Paid' | 'Refunded';
  status: OrderStatus;
  stock_restored: boolean;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  history?: OrderStatusHistoryEntry[];
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  movement_type: 'purchase' | 'adjustment' | 'sale' | 'cancellation_restore';
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reference_id: string;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface StorefrontPayload {
  supabaseConfigured: boolean;
  settings: WebsiteSettings;
  sections: HomepageSections;
  categories: Category[];
  products: Product[];
  reviews: CustomerReview[];
  deliveryZones: DeliveryZone[];
}

export interface DashboardMetrics {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  shippedOrders: number;
  outForDeliveryOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  dailySales: Array<{ date: string; revenue: number; orders: number }>;
  monthlySales: Array<{ month: string; revenue: number; orders: number }>;
  statusDistribution: Array<{ status: OrderStatus; count: number }>;
  bestSellingProducts: Array<{ product_name: string; sold_quantity: number; revenue: number }>;
}
