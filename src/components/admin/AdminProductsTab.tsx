import { useEffect, useState } from 'react';
import { Edit2, Plus, Star, Trash2, X } from 'lucide-react';
import type { Category, Product } from '../../types/index.ts';
import { formatBDT } from '../../lib/format.ts';
import { CoffeeVisual } from '../CoffeeVisual.tsx';
import { ImageCropUploader } from './ImageCropUploader.tsx';

interface AdminProductsTabProps {
  token: string;
  currencySymbol: string;
  onChanged: () => void;
}

interface ProductFormState {
  id?: string;
  category_id: string;
  name: string;
  sku: string;
  short_description: string;
  description: string;
  tasting_notes_text: string;
  origin: string;
  roast_level: string;
  weight_label: string;
  price: string;
  discount_price: string;
  current_stock: string;
  low_stock_threshold: string;
  display_order: string;
  is_featured: boolean;
  is_active: boolean;
  image_urls: string[];
}

export function AdminProductsTab({
  token,
  currencySymbol,
  onChanged,
}: AdminProductsTabProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
        setCategories(data.categories || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [token]);

  const openNewModal = () => {
    setForm({
      category_id: categories[0]?.id || '',
      name: '',
      sku: `KITE-${Math.floor(100 + Math.random() * 899)}`,
      short_description: '',
      description: '',
      tasting_notes_text: 'Dark Chocolate, Hazelnut, Balanced Body',
      origin: 'Minas Gerais, Brazil',
      roast_level: 'Medium Roast',
      weight_label: '250g',
      price: '1250',
      discount_price: '',
      current_stock: '30',
      low_stock_threshold: '10',
      display_order: String(products.length + 1),
      is_featured: false,
      is_active: true,
      image_urls: [],
    });
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setForm({
      id: p.id,
      category_id: p.category_id || categories[0]?.id || '',
      name: p.name,
      sku: p.sku,
      short_description: p.short_description,
      description: p.description,
      tasting_notes_text: (p.tasting_notes || []).join(', '),
      origin: p.origin,
      roast_level: p.roast_level,
      weight_label: p.weight_label,
      price: String(p.price),
      discount_price: p.discount_price !== null ? String(p.discount_price) : '',
      current_stock: String(p.current_stock),
      low_stock_threshold: String(p.low_stock_threshold),
      display_order: String(p.display_order),
      is_featured: p.is_featured,
      is_active: p.is_active,
      image_urls: (p.images || []).map((img) => img.image_url),
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        category_id: form.category_id || null,
        name: form.name,
        sku: form.sku,
        short_description: form.short_description,
        description: form.description,
        tasting_notes: form.tasting_notes_text
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        origin: form.origin,
        roast_level: form.roast_level,
        weight_label: form.weight_label,
        price: Number(form.price),
        discount_price: form.discount_price ? Number(form.discount_price) : null,
        current_stock: Number(form.current_stock),
        low_stock_threshold: Number(form.low_stock_threshold),
        display_order: Number(form.display_order),
        is_featured: form.is_featured,
        is_active: form.is_active,
        image_urls: form.image_urls,
      };

      const url = form.id ? `/api/admin/products/${form.id}` : '/api/admin/products';
      const method = form.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save product.');

      setModalOpen(false);
      await loadProducts();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await loadProducts();
      onChanged();
    }
  };

  const handleToggleActive = async (p: Product) => {
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...p,
        is_active: !p.is_active,
        image_urls: (p.images || []).map((i) => i.image_url),
      }),
    });
    if (res.ok) {
      await loadProducts();
      onChanged();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-4">
        <div>
          <h3 className="font-sans text-sm font-bold text-slate-900">
            Coffee Products ({products.length})
          </h3>
          <p className="text-xs text-slate-500">
            Manage packaging photos, prices in BDT, roast notes, and display order.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Coffee Product
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">SKU</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold text-right">Price</th>
                <th className="px-4 py-3 font-semibold text-right">Stock</th>
                <th className="px-4 py-3 font-semibold">Visibility</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Loading products...
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                          <CoffeeVisual
                            src={p.images?.[0]?.image_url}
                            alt={p.name}
                            variant="pouch"
                            className="w-full h-full"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900">{p.name}</span>
                            {p.is_featured && (
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {p.weight_label} · {p.roast_level}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono-tabular text-slate-600">{p.sku}</td>
                    <td className="px-4 py-3 text-slate-600">{p.category_name}</td>
                    <td className="px-4 py-3 text-right font-mono-tabular">
                      <span className="font-bold text-slate-900">
                        {formatBDT(p.discount_price ?? p.price, currencySymbol)}
                      </span>
                      {p.discount_price !== null && p.discount_price < p.price && (
                        <span className="block text-[10px] text-slate-400 line-through">
                          {formatBDT(p.price, currencySymbol)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-tabular font-semibold">
                      <span
                        className={
                          p.current_stock === 0
                            ? 'text-red-700'
                            : p.current_stock <= p.low_stock_threshold
                            ? 'text-amber-700'
                            : 'text-[#3D732E]'
                        }
                      >
                        {p.current_stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className={`text-xs font-semibold cursor-pointer ${
                          p.is_active ? 'text-[#3D732E]' : 'text-slate-400'
                        }`}
                      >
                        {p.is_active ? 'Active' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {modalOpen && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-sans text-sm font-bold text-slate-900">
                {form.id ? `Edit ${form.name}` : 'Add New Coffee Product'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Weight / Size
                  </label>
                  <input
                    type="text"
                    value={form.weight_label}
                    onChange={(e) => setForm({ ...form, weight_label: e.target.value })}
                    placeholder="250g"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Roast Level
                  </label>
                  <input
                    type="text"
                    value={form.roast_level}
                    onChange={(e) => setForm({ ...form, roast_level: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount Price ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.discount_price}
                    onChange={(e) => setForm({ ...form, discount_price: e.target.value })}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.current_stock}
                    onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low Stock Alert
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.low_stock_threshold}
                    onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={form.short_description}
                  onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tasting Notes (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={form.tasting_notes_text}
                    onChange={(e) => setForm({ ...form, tasting_notes_text: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Origin & Display Order
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.origin}
                      onChange={(e) => setForm({ ...form, origin: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                    <input
                      type="number"
                      value={form.display_order}
                      onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                      className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
                      title="Display Order"
                    />
                  </div>
                </div>
              </div>

              {/* Multi-image upload & cropping */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-900">
                    Product Packaging Images (1:1 Cropped & Saved to Storage)
                  </p>
                </div>

                <ImageCropUploader
                  token={token}
                  preset="product_main"
                  folder="products"
                  label="Upload & Crop Product Photo"
                  onUploaded={(url) =>
                    setForm((prev) =>
                      prev ? { ...prev, image_urls: [...prev.image_urls, url] } : prev
                    )
                  }
                />

                {form.image_urls.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 pt-2">
                    {form.image_urls.map((url, idx) => (
                      <div key={url + idx} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white aspect-square">
                        <img
                          src={url}
                          alt={`Product photo ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              image_urls: form.image_urls.filter((_, i) => i !== idx),
                            })
                          }
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-90 hover:bg-red-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                    className="accent-[#4C8C3B]"
                  />
                  Featured Product Spotlight
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="accent-[#4C8C3B]"
                  />
                  Active on Storefront
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
