import { Minus, Plus, ShoppingBag, Trash2, X, ArrowRight } from 'lucide-react';
import type { CartItem, DeliveryZone } from '../../types/index.ts';
import { formatBDT } from '../../lib/format.ts';
import { CoffeeVisual } from '../CoffeeVisual.tsx';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  deliveryZones: DeliveryZone[];
  selectedZoneId: string;
  defaultDeliveryCharge: number;
  currencySymbol: string;
  onSelectZone: (zoneId: string) => void;
  onUpdateQty: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartDrawer({
  open,
  items,
  deliveryZones,
  selectedZoneId,
  defaultDeliveryCharge,
  currencySymbol,
  onSelectZone,
  onUpdateQty,
  onRemoveItem,
  onClose,
  onCheckout,
}: CartDrawerProps) {
  if (!open) return null;

  const subtotal = items.reduce(
    (sum, item) => sum + (item.product.discount_price ?? item.product.price) * item.quantity,
    0
  );
  const activeZone = deliveryZones.find((z) => z.id === selectedZoneId) || deliveryZones[0];
  const deliveryCharge = items.length > 0 ? activeZone?.delivery_charge ?? defaultDeliveryCharge : 0;
  const total = subtotal + deliveryCharge;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#F7F4EE] h-full flex flex-col shadow-2xl border-l border-[#E2D9C8]">
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E2D9C8]">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[#4C8C3B]" />
            <h2 className="font-display text-lg font-bold text-[#1B1714]">Your Coffee Bag</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#5A524A] hover:bg-[#F7F4EE] cursor-pointer"
            aria-label="Close cart drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-[#EBF3E8] flex items-center justify-center mb-4">
                <ShoppingBag className="w-7 h-7 text-[#4C8C3B]" />
              </div>
              <p className="font-display text-lg font-semibold text-[#1B1714] mb-1">
                Your cart is empty
              </p>
              <p className="text-sm text-[#5A524A] mb-6 max-w-xs">
                Explore our freshly roasted Brazilian Arabica and Espresso blends to begin your order.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-[#4C8C3B] text-white text-sm font-semibold hover:bg-[#3D732E] cursor-pointer"
              >
                Browse Coffee Collection
              </button>
            </div>
          ) : (
            items.map(({ product, quantity }) => {
              const unitPrice = product.discount_price ?? product.price;
              const thumb = product.images?.[0]?.image_url || null;
              return (
                <div
                  key={product.id}
                  className="flex gap-3.5 p-3.5 rounded-xl bg-white border border-[#E2D9C8]"
                >
                  <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-[#E2D9C8]">
                    <CoffeeVisual
                      src={thumb}
                      alt={product.name}
                      variant="pouch"
                      label={product.weight_label}
                      className="w-full h-full"
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-sans text-sm font-semibold text-[#1B1714] leading-snug">
                          {product.name}
                        </h3>
                        <p className="text-xs text-[#5A524A]">
                          {product.weight_label} · {formatBDT(unitPrice, currencySymbol)} each
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(product.id)}
                        className="p-1 text-[#8C8277] hover:text-red-600 cursor-pointer"
                        aria-label={`Remove ${product.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="inline-flex items-center border border-[#D4C9B8] rounded-md bg-[#F7F4EE]">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(product.id, quantity - 1)}
                          className="p-1.5 text-[#1B1714] hover:bg-white cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center font-mono-tabular text-xs font-semibold">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          disabled={quantity >= product.current_stock}
                          onClick={() => onUpdateQty(product.id, quantity + 1)}
                          className="p-1.5 text-[#1B1714] hover:bg-white disabled:opacity-40 cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="font-mono-tabular text-sm font-bold text-[#1B1714]">
                        {formatBDT(unitPrice * quantity, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="p-5 bg-white border-t border-[#E2D9C8] space-y-4">
            {deliveryZones.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#5A524A] mb-1.5">
                  Delivery Zone (Bangladesh)
                </label>
                <select
                  value={activeZone?.id || ''}
                  onChange={(e) => onSelectZone(e.target.value)}
                  className="w-full rounded-lg border border-[#D4C9B8] bg-[#F7F4EE] px-3 py-2 text-xs font-medium text-[#1B1714] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                >
                  {deliveryZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.district} — {zone.area_thana} ({formatBDT(zone.delivery_charge, currencySymbol)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#5A524A]">
                <span>Subtotal</span>
                <span className="font-mono-tabular font-medium text-[#1B1714]">
                  {formatBDT(subtotal, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between text-[#5A524A]">
                <span>Delivery Charge</span>
                <span className="font-mono-tabular font-medium text-[#1B1714]">
                  {formatBDT(deliveryCharge, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#1B1714] pt-2 border-t border-[#E2D9C8]">
                <span>Total Payable (COD)</span>
                <span className="font-mono-tabular text-[#3D732E]">
                  {formatBDT(total, currencySymbol)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onCheckout}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Proceed to Checkout
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
