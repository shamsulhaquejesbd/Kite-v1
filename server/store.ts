import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  Category,
  CustomerReview,
  DashboardMetrics,
  DeliveryZone,
  HomepageSections,
  Order,
  OrderStatus,
  Product,
  ProductImage,
  StockMovement,
  StorefrontPayload,
  WebsiteSettings,
  WhatsAppTemplate,
} from '../src/types/index.ts';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_DELIVERY_ZONES,
  DEFAULT_HOMEPAGE_SECTIONS,
  DEFAULT_PRODUCTS,
  DEFAULT_REVIEWS,
  DEFAULT_SAMPLE_ORDERS,
  DEFAULT_SETTINGS,
  DEFAULT_STOCK_MOVEMENTS,
  DEFAULT_WHATSAPP_TEMPLATES,
} from './seedDefaults.ts';
import { isSupabaseConfigured, supabaseAdmin } from './supabase.ts';

// Server-side in-memory operational store used only while Supabase env vars are not yet provided
const memState = {
  settings: structuredClone(DEFAULT_SETTINGS) as WebsiteSettings,
  sections: structuredClone(DEFAULT_HOMEPAGE_SECTIONS) as HomepageSections,
  categories: structuredClone(DEFAULT_CATEGORIES) as Category[],
  products: structuredClone(DEFAULT_PRODUCTS) as Product[],
  reviews: structuredClone(DEFAULT_REVIEWS) as CustomerReview[],
  deliveryZones: structuredClone(DEFAULT_DELIVERY_ZONES) as DeliveryZone[],
  whatsappTemplates: structuredClone(DEFAULT_WHATSAPP_TEMPLATES) as WhatsAppTemplate[],
  orders: structuredClone(DEFAULT_SAMPLE_ORDERS) as Order[],
  stockMovements: structuredClone(DEFAULT_STOCK_MOVEMENTS) as StockMovement[],
  newsletter: [] as Array<{ id: string; email: string; created_at: string }>,
  orderSeq: 1002,
};

function normalizeBdPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('880')) return digits.slice(2); // 01XXXXXXXXX
  if (digits.startsWith('88')) return digits.slice(2);
  return digits;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ============================================================================
// STOREFRONT & CATALOG READS
// ============================================================================

export async function getStorefrontData(): Promise<StorefrontPayload> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return {
      supabaseConfigured: false,
      settings: memState.settings,
      sections: memState.sections,
      categories: memState.categories
        .filter((c) => c.is_active)
        .sort((a, b) => a.display_order - b.display_order),
      products: memState.products
        .filter((p) => p.is_active)
        .sort((a, b) => a.display_order - b.display_order),
      reviews: memState.reviews
        .filter((r) => r.is_active)
        .sort((a, b) => a.display_order - b.display_order),
      deliveryZones: memState.deliveryZones.filter((z) => z.is_active),
    };
  }

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
    supabaseAdmin.from('website_settings').select('*').eq('id', 'default').maybeSingle(),
    supabaseAdmin.from('homepage_sections').select('*'),
    supabaseAdmin.from('categories').select('*').eq('is_active', true).order('display_order'),
    supabaseAdmin.from('products').select('*').eq('is_active', true).order('display_order'),
    supabaseAdmin.from('product_images').select('*').order('display_order'),
    supabaseAdmin.from('inventory').select('*'),
    supabaseAdmin.from('customer_reviews').select('*').eq('is_active', true).order('display_order'),
    supabaseAdmin.from('delivery_zones').select('*').eq('is_active', true).order('district'),
  ]);

  const settings: WebsiteSettings = settingsRes.data
    ? { ...DEFAULT_SETTINGS, ...settingsRes.data }
    : DEFAULT_SETTINGS;

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
      category_name: p.category_id ? catMap.get(p.category_id) || 'Brazilian Coffee' : 'Brazilian Coffee',
      images: imgMap.get(p.id) || [],
      current_stock: inv?.current_stock ?? 0,
      sold_quantity: inv?.sold_quantity ?? 0,
      low_stock_threshold: inv?.low_stock_threshold ?? settings.low_stock_threshold,
    };
  });

  return {
    supabaseConfigured: true,
    settings,
    sections,
    categories,
    products,
    reviews: (reviewsRes.data || []) as CustomerReview[],
    deliveryZones: (zonesRes.data || []).map((z) => ({
      ...z,
      delivery_charge: Number(z.delivery_charge),
    })) as DeliveryZone[],
  };
}

// ============================================================================
// PUBLIC ORDER PLACEMENT, TRACKING & NEWSLETTER
// ============================================================================

export interface CreateOrderInput {
  customer_name: string;
  phone: string;
  whatsapp_number: string;
  district: string;
  area_thana: string;
  delivery_address: string;
  order_notes?: string;
  delivery_zone_id?: string;
  items: Array<{ product_id: string; quantity: number }>;
}

export async function placeCustomerOrder(input: CreateOrderInput): Promise<Order> {
  const customerName = (input.customer_name || '').trim();
  const phone = (input.phone || '').trim();
  const whatsappNumber = (input.whatsapp_number || input.phone || '').trim();
  const district = (input.district || '').trim();
  const areaThana = (input.area_thana || '').trim();
  const deliveryAddress = (input.delivery_address || '').trim();

  if (!customerName || customerName.length < 2) {
    throw new Error('Customer name is required.');
  }
  if (normalizeBdPhone(phone).length < 10) {
    throw new Error('Please enter a valid Bangladesh mobile number.');
  }
  if (!district || !areaThana || !deliveryAddress) {
    throw new Error('District, Area/Thana, and Full Delivery Address are required.');
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Your cart is empty.');
  }

  for (const item of input.items) {
    if (!item.product_id || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('Invalid item quantity in cart.');
    }
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    const zone =
      memState.deliveryZones.find(
        (z) =>
          z.is_active &&
          (z.id === input.delivery_zone_id ||
            (z.district.toLowerCase() === district.toLowerCase() &&
              z.area_thana.toLowerCase() === areaThana.toLowerCase()))
      ) ||
      memState.deliveryZones.find(
        (z) => z.is_active && z.district.toLowerCase() === district.toLowerCase()
      );

    const deliveryCharge = zone ? zone.delivery_charge : memState.settings.default_delivery_charge;

    // Validate all stock first before mutating
    const resolvedItems: Array<{ product: Product; quantity: number; unitPrice: number }> = [];
    for (const reqItem of input.items) {
      const product = memState.products.find((p) => p.id === reqItem.product_id && p.is_active);
      if (!product) {
        throw new Error('One of the selected coffee products is no longer available.');
      }
      if (product.current_stock < reqItem.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name} (Available: ${product.current_stock}).`
        );
      }
      const unitPrice = product.discount_price ?? product.price;
      resolvedItems.push({ product, quantity: reqItem.quantity, unitPrice });
    }

    memState.orderSeq += 1;
    const prefix = memState.settings.order_id_prefix || 'KITE';
    const orderNumber = `${prefix}-${memState.orderSeq}`;
    const orderId = `ord-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    let subtotal = 0;
    const orderItems = resolvedItems.map(({ product, quantity, unitPrice }) => {
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;
      const prevStock = product.current_stock;
      product.current_stock -= quantity;
      product.sold_quantity += quantity;

      memState.stockMovements.unshift({
        id: `sm-${crypto.randomUUID().slice(0, 8)}`,
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        movement_type: 'sale',
        quantity_change: -quantity,
        previous_stock: prevStock,
        new_stock: product.current_stock,
        reference_id: orderNumber,
        reason: 'Customer Order Placed',
        created_by: customerName,
        created_at: now,
      });

      return {
        id: `oi-${crypto.randomUUID().slice(0, 8)}`,
        order_id: orderId,
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        weight_label: product.weight_label,
        unit_price: unitPrice,
        quantity,
        line_total: lineTotal,
      };
    });

    const newOrder: Order = {
      id: orderId,
      order_number: orderNumber,
      customer_name: customerName,
      phone,
      whatsapp_number: whatsappNumber,
      district,
      area_thana: areaThana,
      delivery_address: deliveryAddress,
      order_notes: (input.order_notes || '').trim(),
      internal_notes: '',
      subtotal,
      delivery_charge: deliveryCharge,
      total_amount: subtotal + deliveryCharge,
      payment_method: 'Cash on Delivery',
      payment_status: 'Unpaid',
      status: 'Pending',
      stock_restored: false,
      created_at: now,
      updated_at: now,
      items: orderItems,
      history: [
        {
          id: `h-${crypto.randomUUID().slice(0, 8)}`,
          order_id: orderId,
          status: 'Pending',
          note: 'Order placed via Cash on Delivery',
          changed_by: customerName,
          created_at: now,
        },
      ],
    };

    memState.orders.unshift(newOrder);
    return newOrder;
  }

  // Supabase atomic RPC path
  const { data: settingsRow } = await supabaseAdmin
    .from('website_settings')
    .select('order_id_prefix, default_delivery_charge')
    .eq('id', 'default')
    .maybeSingle();

  const prefix = settingsRow?.order_id_prefix || 'KITE';
  let deliveryCharge = Number(settingsRow?.default_delivery_charge ?? 120);

  if (input.delivery_zone_id) {
    const { data: zone } = await supabaseAdmin
      .from('delivery_zones')
      .select('delivery_charge')
      .eq('id', input.delivery_zone_id)
      .eq('is_active', true)
      .maybeSingle();
    if (zone) deliveryCharge = Number(zone.delivery_charge);
  } else {
    const { data: zones } = await supabaseAdmin
      .from('delivery_zones')
      .select('delivery_charge, district, area_thana')
      .eq('is_active', true);
    const match = (zones || []).find(
      (z) =>
        z.district.toLowerCase() === district.toLowerCase() &&
        z.area_thana.toLowerCase() === areaThana.toLowerCase()
    );
    if (match) deliveryCharge = Number(match.delivery_charge);
  }

  const orderNumber = `${prefix}-${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 89)}`;

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('place_order_atomic', {
    p_order_number: orderNumber,
    p_customer_name: customerName,
    p_phone: phone,
    p_whatsapp_number: whatsappNumber,
    p_district: district,
    p_area_thana: areaThana,
    p_delivery_address: deliveryAddress,
    p_order_notes: (input.order_notes || '').trim(),
    p_delivery_charge: deliveryCharge,
    p_items: input.items,
  });

  if (rpcError || !rpcData) {
    throw new Error(rpcError?.message || 'Unable to place order. Please verify stock.');
  }

  const created = await getOrderById(rpcData.order_id);
  if (!created) throw new Error('Order created but could not be loaded.');
  return created;
}

export async function trackCustomerOrder(orderNumber: string, phone: string) {
  const cleanOrderNum = (orderNumber || '').trim().toUpperCase();
  const normInputPhone = normalizeBdPhone(phone);

  if (!cleanOrderNum || normInputPhone.length < 8) {
    throw new Error('Please enter both your Order ID and Mobile Number.');
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    const match = memState.orders.find(
      (o) =>
        o.order_number.toUpperCase() === cleanOrderNum &&
        normalizeBdPhone(o.phone) === normInputPhone
    );
    if (!match) return null;
    return {
      order_number: match.order_number,
      customer_name: match.customer_name,
      district: match.district,
      area_thana: match.area_thana,
      status: match.status,
      payment_method: match.payment_method,
      subtotal: match.subtotal,
      delivery_charge: match.delivery_charge,
      total_amount: match.total_amount,
      created_at: match.created_at,
      updated_at: match.updated_at,
      items: match.items,
      history: match.history || [],
    };
  }

  const { data: orderRow } = await supabaseAdmin
    .from('orders')
    .select('*')
    .ilike('order_number', cleanOrderNum)
    .maybeSingle();

  if (!orderRow || normalizeBdPhone(orderRow.phone) !== normInputPhone) {
    return null;
  }

  const [itemsRes, historyRes] = await Promise.all([
    supabaseAdmin.from('order_items').select('*').eq('order_id', orderRow.id),
    supabaseAdmin
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderRow.id)
      .order('created_at', { ascending: true }),
  ]);

  return {
    order_number: orderRow.order_number,
    customer_name: orderRow.customer_name,
    district: orderRow.district,
    area_thana: orderRow.area_thana,
    status: orderRow.status as OrderStatus,
    payment_method: orderRow.payment_method,
    subtotal: Number(orderRow.subtotal),
    delivery_charge: Number(orderRow.delivery_charge),
    total_amount: Number(orderRow.total_amount),
    created_at: orderRow.created_at,
    updated_at: orderRow.updated_at,
    items: (itemsRes.data || []).map((i) => ({
      ...i,
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
    })),
    history: historyRes.data || [],
  };
}

export async function subscribeNewsletter(email: string): Promise<void> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    if (!memState.newsletter.some((n) => n.email === cleanEmail)) {
      memState.newsletter.push({
        id: `nl-${crypto.randomUUID().slice(0, 8)}`,
        email: cleanEmail,
        created_at: new Date().toISOString(),
      });
    }
    return;
  }

  const { error } = await supabaseAdmin
    .from('newsletter_subscribers')
    .upsert({ email: cleanEmail, is_subscribed: true }, { onConflict: 'email' });

  if (error) throw new Error(error.message);
}

// ============================================================================
// ADMIN: ORDERS, DASHBOARD & ANALYTICS
// ============================================================================

export async function getAllOrders(): Promise<Order[]> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return memState.orders;
  }

  const [ordersRes, itemsRes, historyRes] = await Promise.all([
    supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('order_items').select('*'),
    supabaseAdmin.from('order_status_history').select('*').order('created_at', { ascending: true }),
  ]);

  const itemsByOrder = new Map<string, Order['items']>();
  for (const item of itemsRes.data || []) {
    const arr = itemsByOrder.get(item.order_id) || [];
    arr.push({
      ...item,
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
    });
    itemsByOrder.set(item.order_id, arr);
  }

  const histByOrder = new Map<string, NonNullable<Order['history']>>();
  for (const h of historyRes.data || []) {
    const arr = histByOrder.get(h.order_id) || [];
    arr.push(h);
    histByOrder.set(h.order_id, arr);
  }

  return (ordersRes.data || []).map((o) => ({
    ...o,
    subtotal: Number(o.subtotal),
    delivery_charge: Number(o.delivery_charge),
    total_amount: Number(o.total_amount),
    items: itemsByOrder.get(o.id) || [],
    history: histByOrder.get(o.id) || [],
  })) as Order[];
}

export async function getOrderById(id: string): Promise<Order | null> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return memState.orders.find((o) => o.id === id) || null;
  }

  const [orderRes, itemsRes, historyRes] = await Promise.all([
    supabaseAdmin.from('orders').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin.from('order_items').select('*').eq('order_id', id),
    supabaseAdmin
      .from('order_status_history')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!orderRes.data) return null;

  return {
    ...orderRes.data,
    subtotal: Number(orderRes.data.subtotal),
    delivery_charge: Number(orderRes.data.delivery_charge),
    total_amount: Number(orderRes.data.total_amount),
    items: (itemsRes.data || []).map((i) => ({
      ...i,
      unit_price: Number(i.unit_price),
      line_total: Number(i.line_total),
    })),
    history: historyRes.data || [],
  } as Order;
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  note: string,
  actor: string
): Promise<Order> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    const order = memState.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found.');

    if (newStatus === 'Cancelled') {
      if (!order.stock_restored) {
        for (const item of order.items) {
          if (item.product_id) {
            const prod = memState.products.find((p) => p.id === item.product_id);
            if (prod) {
              const prevStock = prod.current_stock;
              prod.current_stock += item.quantity;
              prod.sold_quantity = Math.max(0, prod.sold_quantity - item.quantity);
              memState.stockMovements.unshift({
                id: `sm-${crypto.randomUUID().slice(0, 8)}`,
                product_id: prod.id,
                product_name: prod.name,
                product_sku: prod.sku,
                movement_type: 'cancellation_restore',
                quantity_change: item.quantity,
                previous_stock: prevStock,
                new_stock: prod.current_stock,
                reference_id: order.order_number,
                reason: note || 'Order cancelled — stock restored',
                created_by: actor,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
        order.stock_restored = true;
      }
    }

    order.status = newStatus;
    order.updated_at = new Date().toISOString();
    if (!order.history) order.history = [];
    order.history.push({
      id: `h-${crypto.randomUUID().slice(0, 8)}`,
      order_id: order.id,
      status: newStatus,
      note: note || `Status updated to ${newStatus}`,
      changed_by: actor,
      created_at: order.updated_at,
    });
    return order;
  }

  if (newStatus === 'Cancelled') {
    const { error } = await supabaseAdmin.rpc('cancel_order_atomic', {
      p_order_id: orderId,
      p_note: note || 'Cancelled by administrator',
      p_actor: actor,
    });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from('orders')
      .update({
        status: newStatus,
        payment_status: newStatus === 'Delivered' ? 'Paid' : undefined,
      })
      .eq('id', orderId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from('order_status_history').insert({
      order_id: orderId,
      status: newStatus,
      note: note || `Status updated to ${newStatus}`,
      changed_by: actor,
    });
  }

  const updated = await getOrderById(orderId);
  if (!updated) throw new Error('Order not found after update.');
  return updated;
}

export async function updateOrderDetails(
  orderId: string,
  updates: {
    customer_name?: string;
    phone?: string;
    whatsapp_number?: string;
    district?: string;
    area_thana?: string;
    delivery_address?: string;
    internal_notes?: string;
    payment_status?: 'Unpaid' | 'Paid' | 'Refunded';
  }
): Promise<Order> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    const order = memState.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found.');
    Object.assign(order, updates, { updated_at: new Date().toISOString() });
    return order;
  }

  const { error } = await supabaseAdmin.from('orders').update(updates).eq('id', orderId);
  if (error) throw new Error(error.message);
  const updated = await getOrderById(orderId);
  if (!updated) throw new Error('Order not found.');
  return updated;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [orders, products] = await Promise.all([getAllOrders(), getAllProductsAdmin()]);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let pendingOrders = 0;
  let confirmedOrders = 0;
  let processingOrders = 0;
  let shippedOrders = 0;
  let outForDeliveryOrders = 0;
  let deliveredOrders = 0;
  let cancelledOrders = 0;
  let totalRevenue = 0;
  let monthlyRevenue = 0;

  const dailyMap = new Map<string, { revenue: number; orders: number }>();
  const monthlyMap = new Map<string, { revenue: number; orders: number }>();
  const bestSellersMap = new Map<string, { sold_quantity: number; revenue: number }>();

  for (const order of orders) {
    switch (order.status) {
      case 'Pending':
        pendingOrders++;
        break;
      case 'Confirmed':
        confirmedOrders++;
        break;
      case 'Processing':
        processingOrders++;
        break;
      case 'Shipped':
        shippedOrders++;
        break;
      case 'Out for Delivery':
        outForDeliveryOrders++;
        break;
      case 'Delivered':
        deliveredOrders++;
        break;
      case 'Cancelled':
        cancelledOrders++;
        break;
    }

    if (order.status !== 'Cancelled') {
      totalRevenue += order.total_amount;
      const monthKey = order.created_at.slice(0, 7);
      const dayKey = order.created_at.slice(0, 10);
      if (monthKey === currentMonth) {
        monthlyRevenue += order.total_amount;
      }

      const dEntry = dailyMap.get(dayKey) || { revenue: 0, orders: 0 };
      dEntry.revenue += order.total_amount;
      dEntry.orders += 1;
      dailyMap.set(dayKey, dEntry);

      const mEntry = monthlyMap.get(monthKey) || { revenue: 0, orders: 0 };
      mEntry.revenue += order.total_amount;
      mEntry.orders += 1;
      monthlyMap.set(monthKey, mEntry);

      for (const item of order.items) {
        const b = bestSellersMap.get(item.product_name) || { sold_quantity: 0, revenue: 0 };
        b.sold_quantity += item.quantity;
        b.revenue += item.line_total;
        bestSellersMap.set(item.product_name, b);
      }
    }
  }

  // Fill last 7 days for smooth chart continuity
  const dailySales: Array<{ date: string; revenue: number; orders: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const entry = dailyMap.get(d) || { revenue: 0, orders: 0 };
    dailySales.push({ date: d, revenue: entry.revenue, orders: entry.orders });
  }

  const monthlySales = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, v]) => ({ month, revenue: v.revenue, orders: v.orders }));

  const lowStockProducts = products.filter(
    (p) => p.current_stock > 0 && p.current_stock <= p.low_stock_threshold
  ).length;
  const outOfStockProducts = products.filter((p) => p.current_stock === 0).length;

  const bestSellingProducts = Array.from(bestSellersMap.entries())
    .map(([product_name, v]) => ({ product_name, ...v }))
    .sort((a, b) => b.sold_quantity - a.sold_quantity)
    .slice(0, 5);

  return {
    totalOrders: orders.length,
    pendingOrders,
    confirmedOrders,
    processingOrders,
    shippedOrders,
    outForDeliveryOrders,
    deliveredOrders,
    cancelledOrders,
    totalRevenue,
    monthlyRevenue,
    totalProducts: products.length,
    lowStockProducts,
    outOfStockProducts,
    dailySales,
    monthlySales,
    statusDistribution: [
      { status: 'Pending', count: pendingOrders },
      { status: 'Confirmed', count: confirmedOrders },
      { status: 'Processing', count: processingOrders },
      { status: 'Shipped', count: shippedOrders },
      { status: 'Out for Delivery', count: outForDeliveryOrders },
      { status: 'Delivered', count: deliveredOrders },
      { status: 'Cancelled', count: cancelledOrders },
    ],
    bestSellingProducts,
  };
}

// ============================================================================
// ADMIN: PRODUCTS & INVENTORY
// ============================================================================

export async function getAllProductsAdmin(): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return [...memState.products].sort((a, b) => a.display_order - b.display_order);
  }

  const [categoriesRes, productsRes, imagesRes, inventoryRes] = await Promise.all([
    supabaseAdmin.from('categories').select('*').order('display_order'),
    supabaseAdmin.from('products').select('*').order('display_order'),
    supabaseAdmin.from('product_images').select('*').order('display_order'),
    supabaseAdmin.from('inventory').select('*'),
  ]);

  const catMap = new Map((categoriesRes.data || []).map((c) => [c.id, c.name]));
  const invMap = new Map((inventoryRes.data || []).map((i) => [i.product_id, i]));
  const imgMap = new Map<string, ProductImage[]>();
  for (const img of (imagesRes.data || []) as ProductImage[]) {
    const arr = imgMap.get(img.product_id) || [];
    arr.push(img);
    imgMap.set(img.product_id, arr);
  }

  return (productsRes.data || []).map((p) => {
    const inv = invMap.get(p.id);
    return {
      ...p,
      price: Number(p.price),
      discount_price: p.discount_price !== null ? Number(p.discount_price) : null,
      category_name: p.category_id ? catMap.get(p.category_id) || 'Brazilian Coffee' : 'Brazilian Coffee',
      images: imgMap.get(p.id) || [],
      current_stock: inv?.current_stock ?? 0,
      sold_quantity: inv?.sold_quantity ?? 0,
      low_stock_threshold: inv?.low_stock_threshold ?? 10,
    };
  });
}

export async function getCategoriesAdmin(): Promise<Category[]> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return memState.categories;
  }
  const { data } = await supabaseAdmin.from('categories').select('*').order('display_order');
  return (data || []) as Category[];
}

export async function saveProductAdmin(
  payload: Partial<Product> & { id?: string; image_urls?: string[] },
  actor: string
): Promise<Product> {
  const name = (payload.name || '').trim();
  const sku = (payload.sku || '').trim();
  if (!name || !sku) throw new Error('Product name and SKU are required.');

  const price = Number(payload.price ?? 0);
  const discountPrice =
    payload.discount_price !== null && payload.discount_price !== undefined && payload.discount_price !== ('' as unknown)
      ? Number(payload.discount_price)
      : null;

  if (price < 0 || (discountPrice !== null && discountPrice < 0)) {
    throw new Error('Prices cannot be negative.');
  }

  const stockQty = Math.max(0, Math.floor(Number(payload.current_stock ?? 0)));
  const threshold = Math.max(0, Math.floor(Number(payload.low_stock_threshold ?? 10)));

  if (!isSupabaseConfigured || !supabaseAdmin) {
    const cat = memState.categories.find((c) => c.id === payload.category_id);
    const urls = payload.image_urls || payload.images?.map((i) => i.image_url) || [];

    if (payload.id) {
      const existing = memState.products.find((p) => p.id === payload.id);
      if (!existing) throw new Error('Product not found.');
      const prevStock = existing.current_stock;
      Object.assign(existing, {
        category_id: payload.category_id ?? existing.category_id,
        category_name: cat?.name || existing.category_name,
        name,
        slug: payload.slug ? slugify(payload.slug) : slugify(name),
        sku,
        short_description: payload.short_description ?? existing.short_description,
        description: payload.description ?? existing.description,
        tasting_notes: payload.tasting_notes ?? existing.tasting_notes,
        origin: payload.origin ?? existing.origin,
        roast_level: payload.roast_level ?? existing.roast_level,
        weight_label: payload.weight_label ?? existing.weight_label,
        price,
        discount_price: discountPrice,
        is_featured: Boolean(payload.is_featured),
        is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : existing.is_active,
        display_order: Number(payload.display_order ?? existing.display_order),
        current_stock: stockQty,
        low_stock_threshold: threshold,
        images: urls.map((url, idx) => ({
          id: `img-${crypto.randomUUID().slice(0, 8)}`,
          product_id: existing.id,
          image_url: url,
          alt_text: name,
          is_primary: idx === 0,
          display_order: idx,
        })),
      });

      if (prevStock !== stockQty) {
        memState.stockMovements.unshift({
          id: `sm-${crypto.randomUUID().slice(0, 8)}`,
          product_id: existing.id,
          product_name: existing.name,
          product_sku: existing.sku,
          movement_type: 'adjustment',
          quantity_change: stockQty - prevStock,
          previous_stock: prevStock,
          new_stock: stockQty,
          reference_id: '',
          reason: 'Updated via Product Editor',
          created_by: actor,
          created_at: new Date().toISOString(),
        });
      }
      return existing;
    }

    const newId = `prod-${crypto.randomUUID().slice(0, 8)}`;
    const newProd: Product = {
      id: newId,
      category_id: payload.category_id || memState.categories[0]?.id || null,
      category_name: cat?.name || 'Single Origin Arabica',
      name,
      slug: payload.slug ? slugify(payload.slug) : `${slugify(name)}-${newId.slice(-4)}`,
      sku,
      short_description: payload.short_description || '',
      description: payload.description || '',
      tasting_notes: payload.tasting_notes || [],
      origin: payload.origin || 'Minas Gerais, Brazil',
      roast_level: payload.roast_level || 'Medium Roast',
      weight_label: payload.weight_label || '250g',
      price,
      discount_price: discountPrice,
      is_featured: Boolean(payload.is_featured),
      is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
      display_order: Number(payload.display_order ?? memState.products.length + 1),
      images: urls.map((url, idx) => ({
        id: `img-${crypto.randomUUID().slice(0, 8)}`,
        product_id: newId,
        image_url: url,
        alt_text: name,
        is_primary: idx === 0,
        display_order: idx,
      })),
      current_stock: stockQty,
      sold_quantity: 0,
      low_stock_threshold: threshold,
    };
    memState.products.push(newProd);
    memState.stockMovements.unshift({
      id: `sm-${crypto.randomUUID().slice(0, 8)}`,
      product_id: newId,
      product_name: name,
      product_sku: sku,
      movement_type: 'purchase',
      quantity_change: stockQty,
      previous_stock: 0,
      new_stock: stockQty,
      reference_id: '',
      reason: 'Initial product stock',
      created_by: actor,
      created_at: new Date().toISOString(),
    });
    return newProd;
  }

  const productFields = {
    category_id: payload.category_id || null,
    name,
    slug: payload.slug ? slugify(payload.slug) : slugify(name),
    sku,
    short_description: payload.short_description || '',
    description: payload.description || '',
    tasting_notes: payload.tasting_notes || [],
    origin: payload.origin || 'Brazil',
    roast_level: payload.roast_level || 'Medium Roast',
    weight_label: payload.weight_label || '250g',
    price,
    discount_price: discountPrice,
    is_featured: Boolean(payload.is_featured),
    is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
    display_order: Number(payload.display_order ?? 0),
  };

  let productId = payload.id;
  if (productId) {
    const { error } = await supabaseAdmin.from('products').update(productFields).eq('id', productId);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from('inventory')
      .upsert(
        {
          product_id: productId,
          current_stock: stockQty,
          low_stock_threshold: threshold,
        },
        { onConflict: 'product_id' }
      );
  } else {
    const { data: inserted, error } = await supabaseAdmin
      .from('products')
      .insert(productFields)
      .select('id')
      .single();
    if (error || !inserted) throw new Error(error?.message || 'Failed to create product.');
    productId = inserted.id;

    await supabaseAdmin.from('inventory').insert({
      product_id: productId,
      current_stock: stockQty,
      sold_quantity: 0,
      low_stock_threshold: threshold,
    });

    if (stockQty > 0) {
      await supabaseAdmin.from('stock_movements').insert({
        product_id: productId,
        movement_type: 'purchase',
        quantity_change: stockQty,
        previous_stock: 0,
        new_stock: stockQty,
        reason: 'Initial product stock',
        created_by: actor,
      });
    }
  }

  if (payload.image_urls) {
    await supabaseAdmin.from('product_images').delete().eq('product_id', productId);
    if (payload.image_urls.length > 0) {
      await supabaseAdmin.from('product_images').insert(
        payload.image_urls.map((url, idx) => ({
          product_id: productId,
          image_url: url,
          alt_text: name,
          is_primary: idx === 0,
          display_order: idx,
        }))
      );
    }
  }

  const all = await getAllProductsAdmin();
  const saved = all.find((p) => p.id === productId);
  if (!saved) throw new Error('Product saved but could not be loaded.');
  return saved;
}

export async function deleteProductAdmin(productId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    memState.products = memState.products.filter((p) => p.id !== productId);
    return;
  }
  const { error } = await supabaseAdmin.from('products').delete().eq('id', productId);
  if (error) throw new Error(error.message);
}

export async function adjustInventoryAdmin(
  productId: string,
  delta: number,
  movementType: 'purchase' | 'adjustment',
  reason: string,
  actor: string
) {
  const intDelta = Math.trunc(Number(delta));
  if (!Number.isFinite(intDelta) || intDelta === 0) {
    throw new Error('Quantity change must be a non-zero integer.');
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    const product = memState.products.find((p) => p.id === productId);
    if (!product) throw new Error('Product not found.');
    const next = product.current_stock + intDelta;
    if (next < 0) {
      throw new Error(`Stock cannot become negative (current: ${product.current_stock}).`);
    }
    const prev = product.current_stock;
    product.current_stock = next;
    memState.stockMovements.unshift({
      id: `sm-${crypto.randomUUID().slice(0, 8)}`,
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      movement_type: movementType,
      quantity_change: intDelta,
      previous_stock: prev,
      new_stock: next,
      reference_id: '',
      reason: reason || 'Manual stock update',
      created_by: actor,
      created_at: new Date().toISOString(),
    });
    return { previous_stock: prev, new_stock: next };
  }

  const { data, error } = await supabaseAdmin.rpc('adjust_stock_atomic', {
    p_product_id: productId,
    p_delta: intDelta,
    p_movement_type: movementType,
    p_reason: reason || 'Manual stock adjustment',
    p_actor: actor,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function getStockMovementsAdmin(): Promise<StockMovement[]> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return memState.stockMovements.slice(0, 100);
  }

  const [movesRes, prodsRes] = await Promise.all([
    supabaseAdmin.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('products').select('id, name, sku'),
  ]);

  const prodMap = new Map((prodsRes.data || []).map((p) => [p.id, p]));
  return (movesRes.data || []).map((m) => {
    const p = prodMap.get(m.product_id);
    return {
      ...m,
      product_name: p?.name || 'Product',
      product_sku: p?.sku || '',
    };
  }) as StockMovement[];
}

// ============================================================================
// ADMIN: CMS, REVIEWS, WHATSAPP TEMPLATES & DELIVERY ZONES
// ============================================================================

export async function getCmsAdminData() {
  const storefront = await getStorefrontData();
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return {
      settings: memState.settings,
      sections: memState.sections,
      reviews: memState.reviews,
      whatsappTemplates: memState.whatsappTemplates,
      deliveryZones: memState.deliveryZones,
      categories: memState.categories,
    };
  }

  const [reviewsRes, templatesRes, zonesRes, catsRes] = await Promise.all([
    supabaseAdmin.from('customer_reviews').select('*').order('display_order'),
    supabaseAdmin.from('whatsapp_templates').select('*'),
    supabaseAdmin.from('delivery_zones').select('*').order('district'),
    supabaseAdmin.from('categories').select('*').order('display_order'),
  ]);

  return {
    settings: storefront.settings,
    sections: storefront.sections,
    reviews: (reviewsRes.data || []) as CustomerReview[],
    whatsappTemplates:
      templatesRes.data && templatesRes.data.length > 0
        ? (templatesRes.data as WhatsAppTemplate[])
        : DEFAULT_WHATSAPP_TEMPLATES,
    deliveryZones: (zonesRes.data || []).map((z) => ({
      ...z,
      delivery_charge: Number(z.delivery_charge),
    })) as DeliveryZone[],
    categories: (catsRes.data || []) as Category[],
  };
}

export async function updateWebsiteSettingsAdmin(updates: Partial<WebsiteSettings>) {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    Object.assign(memState.settings, updates);
    return memState.settings;
  }

  const { data, error } = await supabaseAdmin
    .from('website_settings')
    .upsert({ id: 'default', ...updates }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as WebsiteSettings;
}

export async function updateHomepageSectionsAdmin(sections: Partial<HomepageSections>) {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    for (const [k, v] of Object.entries(sections)) {
      if (k in memState.sections && v) {
        (memState.sections as unknown as Record<string, unknown>)[k] = v;
      }
    }
    return memState.sections;
  }

  const upserts = Object.entries(sections).map(([section_key, content]) => ({
    section_key,
    content,
    is_visible: true,
  }));

  const { error } = await supabaseAdmin
    .from('homepage_sections')
    .upsert(upserts, { onConflict: 'section_key' });
  if (error) throw new Error(error.message);

  const storefront = await getStorefrontData();
  return storefront.sections;
}

export async function saveReviewAdmin(payload: Partial<CustomerReview> & { id?: string }) {
  if (!payload.customer_name?.trim() || !payload.review_text?.trim()) {
    throw new Error('Customer name and review text are required.');
  }

  if (!isSupabaseConfigured || !supabaseAdmin) {
    if (payload.id) {
      const idx = memState.reviews.findIndex((r) => r.id === payload.id);
      if (idx === -1) throw new Error('Review not found.');
      memState.reviews[idx] = { ...memState.reviews[idx], ...payload } as CustomerReview;
      return memState.reviews[idx];
    }
    const created: CustomerReview = {
      id: `rev-${crypto.randomUUID().slice(0, 8)}`,
      customer_name: payload.customer_name.trim(),
      customer_location: payload.customer_location || 'Dhaka, Bangladesh',
      rating: Math.min(5, Math.max(1, Number(payload.rating ?? 5))),
      review_text: payload.review_text.trim(),
      avatar_url: payload.avatar_url || '',
      product_name: payload.product_name || '',
      is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
      display_order: Number(payload.display_order ?? memState.reviews.length + 1),
    };
    memState.reviews.push(created);
    return created;
  }

  const row = {
    customer_name: payload.customer_name.trim(),
    customer_location: payload.customer_location || 'Dhaka, Bangladesh',
    rating: Math.min(5, Math.max(1, Number(payload.rating ?? 5))),
    review_text: payload.review_text.trim(),
    avatar_url: payload.avatar_url || '',
    product_name: payload.product_name || '',
    is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
    display_order: Number(payload.display_order ?? 0),
  };

  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('customer_reviews')
      .update(row)
      .eq('id', payload.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as CustomerReview;
  }

  const { data, error } = await supabaseAdmin
    .from('customer_reviews')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CustomerReview;
}

export async function deleteReviewAdmin(id: string) {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    memState.reviews = memState.reviews.filter((r) => r.id !== id);
    return;
  }
  const { error } = await supabaseAdmin.from('customer_reviews').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateWhatsappTemplatesAdmin(templates: WhatsAppTemplate[]) {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    memState.whatsappTemplates = templates;
    return memState.whatsappTemplates;
  }

  const { error } = await supabaseAdmin
    .from('whatsapp_templates')
    .upsert(templates, { onConflict: 'status_key' });
  if (error) throw new Error(error.message);
  return templates;
}

export async function saveDeliveryZoneAdmin(zone: Partial<DeliveryZone> & { id?: string }) {
  if (!zone.district?.trim() || !zone.area_thana?.trim()) {
    throw new Error('District and Area/Thana are required.');
  }
  const charge = Math.max(0, Number(zone.delivery_charge ?? 0));

  if (!isSupabaseConfigured || !supabaseAdmin) {
    if (zone.id) {
      const idx = memState.deliveryZones.findIndex((z) => z.id === zone.id);
      if (idx === -1) throw new Error('Delivery zone not found.');
      memState.deliveryZones[idx] = {
        ...memState.deliveryZones[idx],
        ...zone,
        delivery_charge: charge,
      } as DeliveryZone;
      return memState.deliveryZones[idx];
    }
    const created: DeliveryZone = {
      id: `dz-${crypto.randomUUID().slice(0, 8)}`,
      district: zone.district.trim(),
      area_thana: zone.area_thana.trim(),
      delivery_charge: charge,
      estimated_days: zone.estimated_days || '2–3 Days',
      is_active: zone.is_active !== undefined ? Boolean(zone.is_active) : true,
    };
    memState.deliveryZones.push(created);
    return created;
  }

  const row = {
    district: zone.district.trim(),
    area_thana: zone.area_thana.trim(),
    delivery_charge: charge,
    estimated_days: zone.estimated_days || '2–3 Days',
    is_active: zone.is_active !== undefined ? Boolean(zone.is_active) : true,
  };

  if (zone.id) {
    const { data, error } = await supabaseAdmin
      .from('delivery_zones')
      .update(row)
      .eq('id', zone.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...data, delivery_charge: Number(data.delivery_charge) } as DeliveryZone;
  }

  const { data, error } = await supabaseAdmin
    .from('delivery_zones')
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ...data, delivery_charge: Number(data.delivery_charge) } as DeliveryZone;
}

export async function deleteDeliveryZoneAdmin(id: string) {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    memState.deliveryZones = memState.deliveryZones.filter((z) => z.id !== id);
    return;
  }
  const { error } = await supabaseAdmin.from('delivery_zones').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// MEDIA UPLOAD (Supabase Storage 'kite-media' with preview filesystem fallback)
// ============================================================================

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ALLOWED_FOLDERS = new Set(['hero', 'products', 'brand', 'reviews', 'branding', 'general']);

export async function uploadCroppedMedia(
  dataUrl: string,
  folder: string,
  fileNameHint?: string
): Promise<{ url: string; storage: 'supabase' | 'local' }> {
  const safeFolder = ALLOWED_FOLDERS.has(folder) ? folder : 'general';
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) {
    throw new Error('Invalid image payload. Expected JPEG, PNG, or WebP base64 data.');
  }

  const mime = match[1];
  const ext = ALLOWED_MIME[mime];
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.byteLength > 5 * 1024 * 1024) {
    throw new Error('Cropped image exceeds 5MB limit.');
  }

  const safeBase = (fileNameHint || 'asset')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 32);
  const objectName = `${safeFolder}/${safeBase || 'img'}-${Date.now()}-${crypto
    .randomBytes(4)
    .toString('hex')}.${ext}`;

  if (isSupabaseConfigured && supabaseAdmin) {
    const { error } = await supabaseAdmin.storage
      .from('kite-media')
      .upload(objectName, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    const { data: pubData } = supabaseAdmin.storage.from('kite-media').getPublicUrl(objectName);
    return { url: pubData.publicUrl, storage: 'supabase' };
  }

  // Preview sandbox fallback inside /public/uploads with strict path confinement
  const baseDir = path.resolve(process.cwd(), 'public', 'uploads');
  const targetPath = path.resolve(baseDir, objectName);
  if (!targetPath.startsWith(baseDir + path.sep)) {
    throw new Error('Invalid storage path.');
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);

  return { url: `/uploads/${objectName}`, storage: 'local' };
}

export async function seedSupabaseInitialCatalog(actor: string) {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    throw new Error('Supabase is not configured yet.');
  }

  const { count } = await supabaseAdmin
    .from('products')
    .select('id', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    return { seeded: false, message: 'Catalog already has products in Supabase.' };
  }

  // Ensure categories exist
  const { data: existingCats } = await supabaseAdmin.from('categories').select('*');
  let cats = existingCats || [];
  if (cats.length === 0) {
    const { data: insertedCats } = await supabaseAdmin
      .from('categories')
      .insert(
        DEFAULT_CATEGORIES.map(({ id: _id, ...rest }) => rest)
      )
      .select();
    cats = insertedCats || [];
  }

  const slugToCatId = new Map(cats.map((c) => [c.slug, c.id]));

  for (const prod of DEFAULT_PRODUCTS) {
    const catSlug =
      DEFAULT_CATEGORIES.find((c) => c.id === prod.category_id)?.slug || 'single-origin-arabica';
    const realCatId = slugToCatId.get(catSlug) || cats[0]?.id || null;

    const { data: insertedProd, error } = await supabaseAdmin
      .from('products')
      .insert({
        category_id: realCatId,
        name: prod.name,
        slug: prod.slug,
        sku: prod.sku,
        short_description: prod.short_description,
        description: prod.description,
        tasting_notes: prod.tasting_notes,
        origin: prod.origin,
        roast_level: prod.roast_level,
        weight_label: prod.weight_label,
        price: prod.price,
        discount_price: prod.discount_price,
        is_featured: prod.is_featured,
        is_active: prod.is_active,
        display_order: prod.display_order,
      })
      .select('id')
      .single();

    if (error || !insertedProd) continue;

    if (prod.images && prod.images.length > 0) {
      await supabaseAdmin.from('product_images').insert(
        prod.images.map((img, idx) => ({
          product_id: insertedProd.id,
          image_url: img.image_url,
          alt_text: img.alt_text,
          is_primary: idx === 0,
          display_order: idx,
        }))
      );
    }

    await supabaseAdmin.from('inventory').insert({
      product_id: insertedProd.id,
      current_stock: prod.current_stock,
      sold_quantity: prod.sold_quantity,
      low_stock_threshold: prod.low_stock_threshold,
    });

    await supabaseAdmin.from('stock_movements').insert({
      product_id: insertedProd.id,
      movement_type: 'purchase',
      quantity_change: prod.current_stock,
      previous_stock: 0,
      new_stock: prod.current_stock,
      reason: 'Initial THE KITE catalog seed',
      created_by: actor,
    });
  }

  await updateHomepageSectionsAdmin(DEFAULT_HOMEPAGE_SECTIONS);
  return { seeded: true, message: '7 THE KITE Brazilian coffee products seeded into Supabase.' };
}
