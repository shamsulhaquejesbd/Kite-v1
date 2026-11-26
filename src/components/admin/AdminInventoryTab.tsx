import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Plus, X } from 'lucide-react';
import type { Product, StockMovement } from '../../types/index.ts';
import { formatDateTime } from '../../lib/format.ts';
import { CoffeeVisual } from '../CoffeeVisual.tsx';

interface AdminInventoryTabProps {
  token: string;
  onChanged: () => void;
}

export function AdminInventoryTab({ token, onChanged }: AdminInventoryTabProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [filterAlert, setFilterAlert] = useState<'all' | 'low' | 'out'>('all');
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [movementType, setMovementType] = useState<'purchase' | 'adjustment'>('purchase');
  const [delta, setDelta] = useState('10');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = async () => {
    const res = await fetch('/api/admin/inventory', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setProducts(data.products || []);
      setMovements(data.movements || []);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [token]);

  const filteredProducts = products.filter((p) => {
    if (filterAlert === 'out') return p.current_stock === 0;
    if (filterAlert === 'low')
      return p.current_stock > 0 && p.current_stock <= p.low_stock_threshold;
    return true;
  });

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inventory/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: adjustTarget.id,
          delta: Number(delta),
          movement_type: movementType,
          reason: reason || (movementType === 'purchase' ? 'New roast batch stock' : 'Stock count adjustment'),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not adjust stock.');
      setAdjustTarget(null);
      setReason('');
      await loadInventory();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stock Alert Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-sans text-sm font-bold text-slate-900">
            Inventory & Stock Control
          </h3>
          <p className="text-xs text-slate-500">
            Atomic stock deductions on orders & idempotent stock restoration on cancellations.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['all', 'low', 'out'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterAlert(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                filterAlert === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {key === 'all' ? 'All Stock' : key === 'low' ? 'Low Stock Alerts' : 'Out of Stock'}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">SKU</th>
                <th className="px-4 py-3 font-semibold text-right">Current Stock</th>
                <th className="px-4 py-3 font-semibold text-right">Sold Qty</th>
                <th className="px-4 py-3 font-semibold text-right">Available</th>
                <th className="px-4 py-3 font-semibold text-right">Threshold</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const isOut = p.current_stock === 0;
                const isLow = !isOut && p.current_stock <= p.low_stock_threshold;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md overflow-hidden border border-slate-200 shrink-0">
                          <CoffeeVisual
                            src={p.images?.[0]?.image_url}
                            alt={p.name}
                            variant="pouch"
                            className="w-full h-full"
                          />
                        </div>
                        <span className="font-semibold text-slate-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-slate-600">{p.sku}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-bold text-slate-900">
                      {p.current_stock}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-slate-600">
                      {p.sold_quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-slate-900">
                      {p.current_stock}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular text-slate-500">
                      {p.low_stock_threshold}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      <span
                        className={
                          isOut ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-[#3D732E]'
                        }
                      >
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustTarget(p);
                          setDelta('10');
                          setMovementType('purchase');
                          setError(null);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#EBF3E8] text-[#2F5D23] hover:bg-[#4C8C3B] hover:text-white font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movement Audit Ledger */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h4 className="font-sans text-sm font-bold text-slate-900">
            Stock Movement & Adjustment History
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Timestamp</th>
                <th className="px-4 py-2.5 font-semibold">Product</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold text-right">Change</th>
                <th className="px-4 py-2.5 font-semibold text-right">Prev → New</th>
                <th className="px-4 py-2.5 font-semibold">Reason / Reference</th>
                <th className="px-4 py-2.5 font-semibold">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 font-mono-tabular text-slate-500 whitespace-nowrap">
                    {formatDateTime(m.created_at)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {m.product_name || m.product_id}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-slate-700">
                    {m.movement_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular font-bold">
                    <span
                      className={`inline-flex items-center gap-0.5 ${
                        m.quantity_change >= 0 ? 'text-[#3D732E]' : 'text-red-700'
                      }`}
                    >
                      {m.quantity_change >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular text-slate-600">
                    {m.previous_stock} → {m.new_stock}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {m.reason} {m.reference_id ? `(${m.reference_id})` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{m.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust / Purchase Stock Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Adjust Stock</h4>
                <p className="text-xs text-slate-500">
                  {adjustTarget.name} (Current: {adjustTarget.current_stock})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-5 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Movement Type
                </label>
                <select
                  value={movementType}
                  onChange={(e) =>
                    setMovementType(e.target.value as 'purchase' | 'adjustment')
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                >
                  <option value="purchase">Stock Purchase (Restock)</option>
                  <option value="adjustment">Manual Stock Adjustment (+ / -)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity Change (use negative e.g. -2 to deduct)
                </label>
                <input
                  type="number"
                  required
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Batch Note
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Fresh Minas Gerais roast batch #14"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold cursor-pointer"
                >
                  {saving ? 'Updating...' : 'Apply Stock Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
