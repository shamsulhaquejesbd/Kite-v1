import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  Package,
  Search,
  Truck,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import type { OrderStatus, OrderStatusHistoryEntry, WebsiteSettings } from '../../types/index.ts';
import { buildWhatsAppClickToChatUrl, formatBDT, formatDateTime } from '../../lib/format.ts';
import { trackCustomerOrderClient } from '../../lib/storefrontClient.ts';

interface TrackedOrderData {
  order_number: string;
  customer_name: string;
  district: string;
  area_thana: string;
  status: OrderStatus;
  payment_method: string;
  subtotal: number;
  delivery_charge: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  items: Array<{
    id: string;
    product_name: string;
    weight_label: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }>;
  history: OrderStatusHistoryEntry[];
}

const TIMELINE_STEPS: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

interface OrderTrackingPageProps {
  settings: WebsiteSettings;
  initialOrderNumber?: string;
  initialPhone?: string;
  onBackToStore: () => void;
}

export function OrderTrackingPage({
  settings,
  initialOrderNumber = '',
  initialPhone = '',
  onBackToStore,
}: OrderTrackingPageProps) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracked, setTracked] = useState<TrackedOrderData | null>(null);

  const performTrack = async (num: string, ph: string) => {
    setError(null);
    setLoading(true);
    try {
      const order = await trackCustomerOrderClient(num, ph);
      setTracked({ ...order, history: order.history || [] });
    } catch (err) {
      setTracked(null);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderNumber && initialPhone) {
      setOrderNumber(initialOrderNumber);
      setPhone(initialPhone);
      performTrack(initialOrderNumber, initialPhone);
    }
  }, [initialOrderNumber, initialPhone]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performTrack(orderNumber, phone);
  };

  const currency = settings.currency_symbol || '৳';
  const currentStepIndex = tracked ? TIMELINE_STEPS.indexOf(tracked.status) : -1;

  return (
    <section className="min-h-screen pt-28 pb-20 px-5 sm:px-8 bg-[#F7F4EE]">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4C8C3B] hover:text-[#3D732E] mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Coffee Store
          </button>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1B1714]">
            Track Your Coffee Order
          </h1>
          <p className="text-sm sm:text-base text-[#5A524A] mt-2">
            Enter your Order ID and mobile number used at checkout to check real-time fulfillment status.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#E2D9C8] p-6 grid grid-cols-1 sm:grid-cols-12 gap-4 items-end shadow-xs"
        >
          <div className="sm:col-span-5">
            <label className="block text-xs font-semibold text-[#4A433C] mb-1.5">
              Order ID
            </label>
            <input
              type="text"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. KITE-1001"
              className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE]/60 px-3.5 py-2.5 text-sm font-mono-tabular text-[#1B1714] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-[#4A433C] mb-1.5">
              Mobile Number
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="017XXXXXXXX"
              className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE]/60 px-3.5 py-2.5 text-sm font-mono-tabular text-[#1B1714] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Checking...' : 'Track Order'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {tracked && (
          <div className="bg-white rounded-2xl border border-[#E2D9C8] p-6 sm:p-8 space-y-8 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#E2D9C8]">
              <div>
                <p className="text-xs text-[#5A524A]">
                  Placed on {formatDateTime(tracked.created_at)}
                </p>
                <h2 className="font-display text-2xl font-bold text-[#1B1714] mt-0.5">
                  Order #{tracked.order_number}
                </h2>
                <p className="text-sm text-[#5A524A] mt-0.5">
                  {tracked.customer_name} · {tracked.area_thana}, {tracked.district}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-[#5A524A]">Current Status</p>
                <p
                  className={`inline-flex items-center gap-1.5 text-base font-bold mt-0.5 ${
                    tracked.status === 'Cancelled' ? 'text-red-700' : 'text-[#3D732E]'
                  }`}
                >
                  {tracked.status === 'Cancelled' ? (
                    <XCircle className="w-5 h-5" />
                  ) : tracked.status === 'Delivered' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Truck className="w-5 h-5" />
                  )}
                  {tracked.status}
                </p>
              </div>
            </div>

            {/* 7-Step Visual Timeline */}
            {tracked.status === 'Cancelled' ? (
              <div className="p-5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-800">
                <XCircle className="w-6 h-6 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">This order has been cancelled</p>
                  <p className="text-xs mt-0.5">
                    Any reserved stock was safely released. Contact us on WhatsApp if you need assistance.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-[#5A524A] mb-5">
                  Fulfillment Progress
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const reached = currentStepIndex >= idx;
                    const isCurrent = currentStepIndex === idx;
                    return (
                      <div key={step} className="relative flex flex-col items-center text-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                            reached
                              ? 'bg-[#4C8C3B] border-[#4C8C3B] text-white'
                              : 'bg-[#F7F4EE] border-[#D4C9B8] text-[#8C8277]'
                          } ${isCurrent ? 'ring-4 ring-[#4C8C3B]/20' : ''}`}
                        >
                          {reached ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>
                        <span
                          className={`mt-2 text-xs font-semibold ${
                            reached ? 'text-[#1B1714]' : 'text-[#8C8277]'
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status History + Order Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#E2D9C8]">
              <div>
                <h3 className="font-sans text-sm font-bold text-[#1B1714] mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#4C8C3B]" />
                  Order Items
                </h3>
                <div className="space-y-2.5 text-sm">
                  {tracked.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-[#4A433C]">
                        {item.product_name} ({item.weight_label}) × {item.quantity}
                      </span>
                      <span className="font-mono-tabular font-semibold text-[#1B1714]">
                        {formatBDT(item.line_total, currency)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[#5A524A] pt-2 border-t border-[#E2D9C8]">
                    <span>Delivery Charge</span>
                    <span className="font-mono-tabular">
                      {formatBDT(tracked.delivery_charge, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-[#1B1714]">
                    <span>Total ({tracked.payment_method})</span>
                    <span className="font-mono-tabular text-[#3D732E]">
                      {formatBDT(tracked.total_amount, currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-sans text-sm font-bold text-[#1B1714] mb-3">
                  Activity Log
                </h3>
                <div className="space-y-3">
                  {tracked.history.map((h) => (
                    <div key={h.id} className="flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-[#1B1714]">{h.status}</p>
                        {h.note && <p className="text-[#5A524A]">{h.note}</p>}
                      </div>
                      <span className="font-mono-tabular text-[#8C8277] shrink-0">
                        {formatDateTime(h.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E2D9C8] flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-[#5A524A]">
                Need an update on your delivery? Reach our Dhaka team directly.
              </p>
              <a
                href={buildWhatsAppClickToChatUrl(
                  settings.whatsapp_number,
                  `Hello ${settings.brand_name}, I would like an update on Order #${tracked.order_number}.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp Support
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
