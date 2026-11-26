import { useState } from 'react';
import { CheckCircle2, MessageCircle, PackageCheck, ShieldCheck, X } from 'lucide-react';
import type { CartItem, DeliveryZone, Order, WebsiteSettings } from '../../types/index.ts';
import { buildWhatsAppClickToChatUrl, formatBDT } from '../../lib/format.ts';
import { submitCustomerOrder } from '../../lib/storefrontClient.ts';

interface CheckoutModalProps {
  open: boolean;
  items: CartItem[];
  deliveryZones: DeliveryZone[];
  selectedZoneId: string;
  settings: WebsiteSettings;
  onSelectZone: (zoneId: string) => void;
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
  onTrackOrder: (orderNumber: string, phone: string) => void;
}

export function CheckoutModal({
  open,
  items,
  deliveryZones,
  selectedZoneId,
  settings,
  onSelectZone,
  onClose,
  onOrderSuccess,
  onTrackOrder,
}: CheckoutModalProps) {
  const activeZone = deliveryZones.find((z) => z.id === selectedZoneId) || deliveryZones[0];

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [district, setDistrict] = useState(activeZone?.district || 'Dhaka');
  const [areaThana, setAreaThana] = useState(activeZone?.area_thana || '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  if (!open) return null;

  const subtotal = items.reduce(
    (sum, item) => sum + (item.product.discount_price ?? item.product.price) * item.quantity,
    0
  );
  const deliveryCharge = activeZone?.delivery_charge ?? settings.default_delivery_charge;
  const totalAmount = subtotal + deliveryCharge;
  const currency = settings.currency_symbol || '৳';

  const handleZoneChange = (zoneId: string) => {
    onSelectZone(zoneId);
    const z = deliveryZones.find((item) => item.id === zoneId);
    if (z) {
      setDistrict(z.district);
      setAreaThana(z.area_thana);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const order = await submitCustomerOrder(
        {
          customer_name: customerName,
          phone,
          whatsapp_number: sameAsPhone ? phone : whatsappNumber,
          district: district || activeZone?.district || 'Dhaka',
          area_thana: areaThana || activeZone?.area_thana || 'Dhaka Metro',
          delivery_address: deliveryAddress,
          order_notes: orderNotes,
          delivery_zone_id: activeZone?.id,
          items: items.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
        },
        { items, zone: activeZone, settings }
      );
      setConfirmedOrder(order);
      onOrderSuccess(order);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setConfirmedOrder(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-[#F7F4EE] rounded-2xl shadow-2xl border border-[#E2D9C8] overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E2D9C8]">
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#1B1714]">
            {confirmedOrder ? 'Order Confirmed' : 'Express Cash on Delivery Checkout'}
          </h2>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-2 rounded-lg text-[#5A524A] hover:bg-[#F7F4EE] cursor-pointer"
            aria-label="Close checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {confirmedOrder ? (
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#E2D9C8] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-[#EBF3E8] flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-[#4C8C3B]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#4C8C3B] tracking-wide">
                    Thank You for Choosing {settings.brand_name}
                  </p>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#1B1714] mt-1">
                    Order #{confirmedOrder.order_number}
                  </h3>
                  <p className="text-sm text-[#5A524A] mt-1">
                    We have received your order and our Dhaka roastery team will confirm shortly.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-[#F7F4EE] border border-[#E2D9C8] p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#5A524A]">Customer</span>
                  <span className="font-semibold text-[#1B1714]">{confirmedOrder.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5A524A]">Mobile Number</span>
                  <span className="font-mono-tabular font-medium text-[#1B1714]">{confirmedOrder.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5A524A]">Delivery Location</span>
                  <span className="text-right text-[#1B1714]">
                    {confirmedOrder.delivery_address}, {confirmedOrder.area_thana}, {confirmedOrder.district}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5A524A]">Payment Method</span>
                  <span className="font-medium text-[#1B1714]">{confirmedOrder.payment_method}</span>
                </div>
              </div>

              <div className="space-y-2 border-t border-[#E2D9C8] pt-4">
                <p className="text-xs font-semibold text-[#5A524A]">Items Ordered</p>
                {confirmedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-[#1B1714]">
                      {item.product_name} × {item.quantity}
                    </span>
                    <span className="font-mono-tabular font-medium">
                      {formatBDT(item.line_total, currency)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm text-[#5A524A] pt-2 border-t border-[#E2D9C8]">
                  <span>Delivery Charge</span>
                  <span className="font-mono-tabular">
                    {formatBDT(confirmedOrder.delivery_charge, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-[#1B1714]">
                  <span>Total Payable on Delivery</span>
                  <span className="font-mono-tabular text-[#3D732E]">
                    {formatBDT(confirmedOrder.total_amount, currency)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const num = confirmedOrder.order_number;
                    const ph = confirmedOrder.phone;
                    handleCloseModal();
                    onTrackOrder(num, ph);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[#1B1714] bg-white text-[#1B1714] text-sm font-semibold hover:bg-[#1B1714] hover:text-white transition-colors cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4" />
                  Track Order Status
                </button>
                <a
                  href={buildWhatsAppClickToChatUrl(
                    settings.whatsapp_number,
                    `Hello ${settings.brand_name}, I just placed order #${confirmedOrder.order_number} (Total: ${formatBDT(
                      confirmedOrder.total_amount,
                      currency
                    )}).`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-sm font-semibold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-4">
                {error && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="bg-white rounded-xl border border-[#E2D9C8] p-5 space-y-4">
                  <h3 className="font-display text-base font-bold text-[#1B1714]">
                    Customer & Delivery Details
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-[#4A433C] mb-1">
                      Customer Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Tariqul Islam"
                      className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE]/50 px-3.5 py-2.5 text-sm text-[#1B1714] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#4A433C] mb-1">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE]/50 px-3.5 py-2.5 text-sm font-mono-tabular text-[#1B1714] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-[#4A433C]">
                          WhatsApp Number *
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-[#5A524A] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sameAsPhone}
                            onChange={(e) => setSameAsPhone(e.target.checked)}
                            className="accent-[#4C8C3B]"
                          />
                          Same as mobile
                        </label>
                      </div>
                      <input
                        type="tel"
                        required
                        disabled={sameAsPhone}
                        value={sameAsPhone ? phone : whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE]/50 px-3.5 py-2.5 text-sm font-mono-tabular text-[#1B1714] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#4A433C] mb-1">
                      Delivery Zone (Sets Delivery Charge) *
                    </label>
                    <select
                      value={activeZone?.id || ''}
                      onChange={(e) => handleZoneChange(e.target.value)}
                      className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE]/50 px-3.5 py-2.5 text-sm text-[#1B1714] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                    >
                      {deliveryZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.district} — {zone.area_thana} ({formatBDT(zone.delivery_charge, currency)} · {zone.estimated_days})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#4A433C] mb-1">
                        District *
                      </label>
                      <input
                        type="text"
                        required
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        placeholder="e.g. Dhaka"
                        className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE]/50 px-3.5 py-2.5 text-sm text-[#1B1714] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#4A433C] mb-1">
                        Area / Thana *
                      </label>
                      <input
                        type="text"
                        required
                        value={areaThana}
                        onChange={(e) => setAreaThana(e.target.value)}
                        placeholder="e.g. Banani / Dhanmondi"
                        className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE]/50 px-3.5 py-2.5 text-sm text-[#1B1714] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#4A433C] mb-1">
                      Full Delivery Address *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="House, Road, Floor, Landmark"
                      className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE]/50 px-3.5 py-2.5 text-sm text-[#1B1714] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#4A433C] mb-1">
                      Order Notes (Optional — e.g., Grind Preference)
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Whole Bean, Espresso Grind, Moka Pot, or French Press"
                      className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE]/50 px-3.5 py-2.5 text-sm text-[#1B1714] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                    />
                  </div>
                </div>
              </div>

              {/* Order Summary & COD Payment */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white rounded-xl border border-[#E2D9C8] p-5 space-y-4">
                  <h3 className="font-display text-base font-bold text-[#1B1714]">
                    Order Summary
                  </h3>

                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {items.map(({ product, quantity }) => {
                      const unit = product.discount_price ?? product.price;
                      return (
                        <div key={product.id} className="flex justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-[#1B1714] truncate">{product.name}</p>
                            <p className="text-xs text-[#5A524A]">
                              {quantity} × {formatBDT(unit, currency)} ({product.weight_label})
                            </p>
                          </div>
                          <span className="font-mono-tabular font-semibold text-[#1B1714] shrink-0">
                            {formatBDT(unit * quantity, currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-[#E2D9C8] space-y-2 text-sm">
                    <div className="flex justify-between text-[#5A524A]">
                      <span>Subtotal</span>
                      <span className="font-mono-tabular">{formatBDT(subtotal, currency)}</span>
                    </div>
                    <div className="flex justify-between text-[#5A524A]">
                      <span>Delivery Charge</span>
                      <span className="font-mono-tabular">{formatBDT(deliveryCharge, currency)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-[#1B1714] pt-2 border-t border-[#E2D9C8]">
                      <span>Total Payable</span>
                      <span className="font-mono-tabular text-[#3D732E]">
                        {formatBDT(totalAmount, currency)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#EBF3E8] border border-[#C6DFBF] p-3.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#2F5D23]">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Payment Method: Cash on Delivery (COD)</span>
                    </div>
                    <p className="text-xs text-[#3D5935] mt-1">
                      Pay in cash when your freshly sealed {settings.brand_name} coffee arrives. No account required.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || items.length === 0}
                    className="w-full py-3.5 px-5 rounded-xl bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {submitting
                      ? 'Confirming Order...'
                      : `Place Order · ${formatBDT(totalAmount, currency)}`}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
