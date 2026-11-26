import {
  DEFAULT_CATEGORIES,
  DEFAULT_DELIVERY_ZONES,
  DEFAULT_HOMEPAGE_SECTIONS,
  DEFAULT_PRODUCTS,
  DEFAULT_REVIEWS,
  DEFAULT_SAMPLE_ORDERS,
  DEFAULT_SETTINGS,
} from '../../server/seedDefaults.ts';
import type {
  CartItem,
  Category,
  CustomerReview,
  DeliveryZone,
  HomepageSections,
  Order,
  Product,
  ProductImage,
  StorefrontPayload,
  WebsiteSettings,
} from '../types/index.ts';
import { isBrowserSupabaseConfigured, supabaseBrowser } from './supabaseClient.ts';

type ApiResult<T> =
  | { kind: 'json'; ok: boolean; status: number; data: T }
  | { kind: 'html' };

async function tryApiJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(url, init);
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return { kind: 'html' };
  }
  const data = (await res.json()) as T;
  return { kind: 'json', ok: res.ok, status: res.status, data };
}

export async function parseJsonResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    throw new Error(
      'Backend API is unavailable in static preview mode. Please run the full-stack Node server for admin operations.'
    );
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data?.error || fallbackMessage);
  }
  return data;
}

function normalizeBdPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('880')) return digits.slice(2);
  if (digits.startsWith('88')) return digits.slice(2);
  return digits;
}

const STATIC_ORDERS_KEY = 'kite_static_orders';

function readStaticOrders(): Order[] {
  try {
    const raw = window.sessionStorage.getItem(STATIC_ORDERS_KEY);
    if (!raw) return [...DEFAULT_SAMPLE_ORDERS];
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) ? parsed : [...DEFAULT_SAMPLE_ORDERS];
  } catch {
    return [...DEFAULT_SAMPLE_ORDERS];
  }
}

function writeStaticOrders(orders: Order[]): void {
  try {
    window.sessionStorage.setItem(STATIC_ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // Ignore storage quota errors
  }
}

function buildDefaultStorefront(): StorefrontPayload {
  return {
    supabaseConfigured: false,
    settings: structuredClone(DEFAULT_SETTINGS),
    sections: structuredClone(DEFAULT_HOMEPAGE_SECTIONS),
    categories: DEFAULT_CATEGORIES.filter((c) => c.is_active).sort(
      (a, b) => a.display_order - b.display_order
    ),
    products: DEFAULT_PRODUCTS.filter((p) => p.is_active).sort(
      (a, b) => a.display_order - b.display_order
    ),
    reviews: DEFAULT_REVIEWS.filter((r) => r.is_active).sort(
      (a, b) => a.display_order - b.display_order
    ),
    deliveryZones: DEFAULT_DELIVERY_ZONES.filter((z) => z.is_active),
  };
}

async function fetchStorefrontFromBrowserSupabase(): Promise<StorefrontPayload | null> {
  if (!isBrowserSupabaseConfigured || !supabaseBrowser) return null;

  try {
    const [
      settingsRes,
      sectionsRes,
      categoriesRes,
      productsRes,
      imagesRes,
      inventoryRes,
      reviewsRes,
      zonesRes,
    ] = await Promise.all([
      supabaseBrowser.from('website_settings').select('*').eq('id', 'default').maybeSingle(),
      supabaseBrowser.from('homepage_sections').select('*'),
      supabaseBrowser.from('categories').select('*').eq('is_active', true).order('display_order'),
      supabaseBrowser.from('products').select('*').eq('is_active', true).order('display_order'),
      supabaseBrowser.from('product_images').select('*').order('display_order'),
      supabaseBrowser.from('inventory').select('*'),
      supabaseBrowser.from('customer_reviews').select('*').eq('is_active', true).order('display_order'),
      supabaseBrowser.from('delivery_zones').select('*').eq('is_active', true).order('district'),
    ]);

    if (productsRes.error || categoriesRes.error) {
      return null;
    }

    const settings: WebsiteSettings = settingsRes.data
      ? { ...DEFAULT_SETTINGS, ...settingsRes.data }
      : structuredClone(DEFAULT_SETTINGS);

    const sections: HomepageSections = structuredClone(DEFAULT_HOMEPAGE_SECTIONS);
    if (sectionsRes.data) {
      for (const row of sectionsRes.data) {
        if (row.section_key && row.content && row.section_key in sections) {
          const target = sections as unknown as Record<string, Record<string, unknown>>;
          target[row.section_key] = {
            ...target[row.section_key],
            ...(row.content as Record<string, unknown>),
          };
        }
      }
    }

    const categories: Category[] = (categoriesRes.data || []) as Category[];
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const invMap = new Map((inventoryRes.data || []).map((i) => [i.product_id, i]));
    const imgMap = new Map<string, ProductImage[]>();
    for (const img of (imagesRes.data || []) as ProductImage[]) {
      const arr = imgMap.get(img.product_id) || [];
      arr.push(img);
      imgMap.set(img.product_id, arr);
    }

    const products: Product[] = (productsRes.data || []).map((p) => {
      const inv = invMap.get(p.id);
      return {
        ...p,
        price: Number(p.price),
        discount_price: p.discount_price !== null ? Number(p.discount_price) : null,
        category_name: p.category_id
          ? catMap.get(p.category_id) || 'Brazilian Coffee'
          : 'Brazilian Coffee',
        images: imgMap.get(p.id) || [],
        current_stock: inv?.current_stock ?? 0,
        sold_quantity: inv?.sold_quantity ?? 0,
        low_stock_threshold: inv?.low_stock_threshold ?? 10,
      };
    });

    if (products.length === 0) {
      return null;
    }

    const reviews: CustomerReview[] =
      reviewsRes.data && reviewsRes.data.length > 0
        ? (reviewsRes.data as CustomerReview[])
        : structuredClone(DEFAULT_REVIEWS);

    const deliveryZones: DeliveryZone[] =
      zonesRes.data && zonesRes.data.length > 0
        ? (zonesRes.data as DeliveryZone[])
        : structuredClone(DEFAULT_DELIVERY_ZONES);

    return {
      supabaseConfigured: true,
      settings,
      sections,
      categories: categories.length > 0 ? categories : structuredClone(DEFAULT_CATEGORIES),
      products,
      reviews,
      deliveryZones,
    };
  } catch {
    return null;
  }
}

export async function fetchStorefrontPayload(): Promise<StorefrontPayload> {
  try {
    const result = await tryApiJson<StorefrontPayload>('/api/storefront');
    if (result.kind === 'json') {
      if (!result.ok) throw new Error('Unable to load store catalog.');
      return result.data;
    }
  } catch (err) {
    // Fall through to browser Supabase / bundled catalog if API server is absent
    if (err instanceof Error && err.message === 'Unable to load store catalog.') {
      throw err;
    }
  }

  const supabasePayload = await fetchStorefrontFromBrowserSupabase();
  if (supabasePayload) return supabasePayload;

  return buildDefaultStorefront();
}

export async function submitCustomerOrder(
  payload: {
    customer_name: string;
    phone: string;
    whatsapp_number: string;
    district: string;
    area_thana: string;
    delivery_address: string;
    order_notes: string;
    delivery_zone_id?: string;
    items: Array<{ product_id: string; quantity: number }>;
  },
  context: {
    items: CartItem[];
    zone?: DeliveryZone;
    settings: WebsiteSettings;
  }
): Promise<Order> {
  const result = await tryApiJson<{ order?: Order; error?: string }>('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (result.kind === 'json') {
    if (!result.ok || !result.data.order) {
      throw new Error(result.data.error || 'Could not place your order.');
    }
    return result.data.order;
  }

  // Static deployment fallback
  if (!payload.customer_name.trim()) throw new Error('Customer name is required.');
  if (!payload.phone.trim()) throw new Error('Mobile number is required.');
  if (!payload.delivery_address.trim()) throw new Error('Delivery address is required.');
  if (context.items.length === 0) throw new Error('Your cart is empty.');

  const existing = readStaticOrders();
  const nextNumber = 1003 + existing.length;
  const prefix = context.settings.order_id_prefix || 'KITE';
  const orderId = `ord-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const orderItems = context.items.map((item, idx) => {
    const unitPrice = item.product.discount_price ?? item.product.price;
    return {
      id: `oi-${Date.now()}-${idx}`,
      order_id: orderId,
      product_id: item.product.id,
      product_name: item.product.name,
      product_sku: item.product.sku,
      weight_label: item.product.weight_label,
      unit_price: unitPrice,
      quantity: item.quantity,
      line_total: unitPrice * item.quantity,
    };
  });

  const subtotal = orderItems.reduce((sum, i) => sum + i.line_total, 0);
  const deliveryCharge = context.zone?.delivery_charge ?? context.settings.default_delivery_charge;

  const order: Order = {
    id: orderId,
    order_number: `${prefix}-${nextNumber}`,
    customer_name: payload.customer_name.trim(),
    phone: payload.phone.trim(),
    whatsapp_number: payload.whatsapp_number.trim() || payload.phone.trim(),
    district: payload.district,
    area_thana: payload.area_thana,
    delivery_address: payload.delivery_address.trim(),
    order_notes: payload.order_notes.trim(),
    internal_notes: '',
    subtotal,
    delivery_charge: deliveryCharge,
    total_amount: subtotal + deliveryCharge,
    payment_method: 'Cash on Delivery',
    payment_status: 'Unpaid',
    status: 'Pending',
    stock_restored: false,
    created_at: nowIso,
    updated_at: nowIso,
    items: orderItems,
    history: [
      {
        id: `h-${Date.now()}`,
        order_id: orderId,
        status: 'Pending',
        note: 'Order placed via Cash on Delivery',
        changed_by: payload.customer_name.trim(),
        created_at: nowIso,
      },
    ],
  };

  writeStaticOrders([order, ...existing]);
  return order;
}

export async function trackCustomerOrderClient(
  orderNumber: string,
  phone: string
): Promise<Order> {
  const result = await tryApiJson<{ order?: Order; error?: string }>('/api/orders/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_number: orderNumber, phone }),
  });

  if (result.kind === 'json') {
    if (!result.ok || !result.data.order) {
      throw new Error(result.data.error || 'Order not found.');
    }
    return result.data.order;
  }

  const targetNum = orderNumber.trim().toUpperCase();
  const targetPhone = normalizeBdPhone(phone);
  const match = readStaticOrders().find(
    (o) =>
      o.order_number.toUpperCase() === targetNum &&
      normalizeBdPhone(o.phone) === targetPhone
  );
  if (!match) {
    throw new Error('No matching order found. Please check your Order ID and Mobile Number.');
  }
  return match;
}

export async function subscribeNewsletterClient(
  email: string
): Promise<{ ok: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }

  const result = await tryApiJson<{ ok?: boolean; message?: string; error?: string }>(
    '/api/newsletter',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    }
  );

  if (result.kind === 'json') {
    if (!result.ok) {
      throw new Error(result.data.error || 'Could not subscribe.');
    }
    return {
      ok: true,
      message: result.data.message || 'Thank you for subscribing to THE KITE dispatch.',
    };
  }

  if (isBrowserSupabaseConfigured && supabaseBrowser) {
    await supabaseBrowser.from('newsletter_subscribers').upsert({ email: cleanEmail });
  }

  return { ok: true, message: 'Thank you for subscribing to THE KITE dispatch.' };
}
