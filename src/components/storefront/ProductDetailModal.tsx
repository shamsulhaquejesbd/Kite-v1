import { useEffect, useState } from 'react';
import { Check, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import type { Product } from '../../types/index.ts';
import { formatBDT } from '../../lib/format.ts';
import { CoffeeVisual } from '../CoffeeVisual.tsx';

interface ProductDetailModalProps {
  product: Product | null;
  currencySymbol: string;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onBuyNow: (product: Product, quantity: number) => void;
}

export function ProductDetailModal({
  product,
  currencySymbol,
  onClose,
  onAddToCart,
  onBuyNow,
}: ProductDetailModalProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setSelectedIdx(0);
    setQuantity(1);
  }, [product?.id]);

  if (!product) return null;

  const images = product.images || [];
  const activeImage = images[selectedIdx]?.image_url || images[0]?.image_url || null;
  const effectivePrice = product.discount_price ?? product.price;
  const hasDiscount = product.discount_price !== null && product.discount_price < product.price;
  const outOfStock = product.current_stock <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-[#F7F4EE] rounded-2xl shadow-2xl border border-[#E2D9C8] overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2D9C8] bg-white">
          <div className="flex items-center gap-2 text-xs text-[#5A524A]">
            <span>{product.category_name || 'Brazilian Coffee'}</span>
            <span aria-hidden="true">·</span>
            <span>{product.origin}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{product.sku}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#5A524A] hover:bg-[#F7F4EE] hover:text-[#1B1714] cursor-pointer"
            aria-label="Close product details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left Sticky Gallery */}
          <div className="md:col-span-6 space-y-3">
            <div className="aspect-square rounded-xl overflow-hidden border border-[#E2D9C8] bg-white">
              <CoffeeVisual
                src={activeImage}
                alt={product.name}
                variant="pouch"
                label={product.name.replace('THE KITE ', '')}
                sublabel={`${product.weight_label} · ${product.roast_level}`}
                className="w-full h-full"
              />
            </div>

            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2.5">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${
                      idx === selectedIdx
                        ? 'border-[#4C8C3B]'
                        : 'border-transparent hover:border-[#C5B496]'
                    }`}
                  >
                    <img
                      src={img.image_url}
                      alt={img.alt_text || product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Contiguous Purchase Module */}
          <div className="md:col-span-6 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-[#4C8C3B] mb-1">
                  {product.roast_level} · {product.weight_label}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1B1714] leading-tight">
                  {product.name}
                </h2>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="font-mono-tabular text-2xl font-bold text-[#1B1714]">
                  {formatBDT(effectivePrice, currencySymbol)}
                </span>
                {hasDiscount && (
                  <span className="font-mono-tabular text-base text-[#8C8277] line-through">
                    {formatBDT(product.price, currencySymbol)}
                  </span>
                )}
                <span
                  className={`ml-auto text-xs font-medium ${
                    outOfStock ? 'text-red-700' : 'text-[#3D732E]'
                  }`}
                >
                  {outOfStock
                    ? 'Out of Stock'
                    : product.current_stock <= product.low_stock_threshold
                    ? `Low Stock (${product.current_stock} left)`
                    : `In Stock (${product.current_stock} available)`}
                </span>
              </div>

              <p className="text-sm sm:text-base text-[#4A433C] leading-relaxed">
                {product.description}
              </p>

              {product.tasting_notes && product.tasting_notes.length > 0 && (
                <div className="pt-2 border-t border-[#E2D9C8]">
                  <p className="text-xs font-semibold text-[#1B1714] mb-2">
                    Roast & Tasting Profile
                  </p>
                  <ul className="grid grid-cols-2 gap-2">
                    {product.tasting_notes.map((note) => (
                      <li
                        key={note}
                        className="flex items-center gap-2 text-xs text-[#4A433C]"
                      >
                        <Check className="w-3.5 h-3.5 text-[#4C8C3B] shrink-0" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-[#E2D9C8]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#1B1714]">Quantity</span>
                <div className="inline-flex items-center border border-[#D4C9B8] rounded-lg bg-white">
                  <button
                    type="button"
                    disabled={quantity <= 1 || outOfStock}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2.5 text-[#1B1714] hover:bg-[#F7F4EE] disabled:opacity-40 cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-10 text-center font-mono-tabular text-sm font-semibold">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={quantity >= product.current_stock || outOfStock}
                    onClick={() =>
                      setQuantity((q) => Math.min(product.current_stock, q + 1))
                    }
                    className="p-2.5 text-[#1B1714] hover:bg-[#F7F4EE] disabled:opacity-40 cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => {
                    onAddToCart(product, quantity);
                    onClose();
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[#1B1714] bg-white text-[#1B1714] text-sm font-semibold hover:bg-[#1B1714] hover:text-white disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Add to Cart
                </button>
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => onBuyNow(product, quantity)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#4C8C3B] text-white text-sm font-semibold hover:bg-[#3D732E] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Buy Now (COD)
                </button>
              </div>
              <p className="text-xs text-[#5A524A] text-center">
                Cash on Delivery available nationwide across Bangladesh
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
