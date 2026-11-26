import { useState } from 'react';
import { Check, Plus, Save, Trash2 } from 'lucide-react';
import type {
  CustomerReview,
  HomepageSections,
  WebsiteSettings,
} from '../../types/index.ts';
import { ImageCropUploader } from './ImageCropUploader.tsx';

interface AdminCmsTabProps {
  token: string;
  initialSettings: WebsiteSettings;
  initialSections: HomepageSections;
  initialReviews: CustomerReview[];
  onRefreshStorefront: () => void;
}

type CmsSubTab = 'hero' | 'brand' | 'features' | 'reviews' | 'branding';

export function AdminCmsTab({
  token,
  initialSettings,
  initialSections,
  initialReviews,
  onRefreshStorefront,
}: AdminCmsTabProps) {
  const [subTab, setSubTab] = useState<CmsSubTab>('hero');
  const [settings, setSettings] = useState<WebsiteSettings>(initialSettings);
  const [sections, setSections] = useState<HomepageSections>(initialSections);
  const [reviews, setReviews] = useState<CustomerReview[]>(initialReviews);
  const [newReview, setNewReview] = useState({
    customer_name: '',
    customer_location: 'Dhaka, Bangladesh',
    rating: 5,
    review_text: '',
    product_name: '',
    avatar_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const saveSections = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/cms/sections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sections),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save homepage sections.');
      setSections(data.sections);
      setFeedback('Homepage content updated and published live.');
      onRefreshStorefront();
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/cms/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save website settings.');
      setSettings(data.settings);
      setFeedback('Website branding, contact info, and footer saved.');
      onRefreshStorefront();
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/cms/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newReview,
          is_active: true,
          display_order: reviews.length + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add review.');
      setReviews((prev) => [...prev, data.review]);
      setNewReview({
        customer_name: '',
        customer_location: 'Dhaka, Bangladesh',
        rating: 5,
        review_text: '',
        product_name: '',
        avatar_url: '',
      });
      setFeedback('Customer review added.');
      onRefreshStorefront();
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleReviewActive = async (rev: CustomerReview) => {
    const res = await fetch(`/api/admin/cms/reviews/${rev.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...rev, is_active: !rev.is_active }),
    });
    const data = await res.json();
    if (res.ok) {
      setReviews((prev) => prev.map((r) => (r.id === rev.id ? data.review : r)));
      onRefreshStorefront();
    }
  };

  const deleteReview = async (id: string) => {
    const res = await fetch(`/api/admin/cms/reviews/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setReviews((prev) => prev.filter((r) => r.id !== id));
      onRefreshStorefront();
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 flex flex-wrap items-center gap-1.5">
        {(
          [
            ['hero', 'Hero & Banner'],
            ['brand', 'Brand & Origins'],
            ['features', 'Why Choose Us & Stats'],
            ['reviews', 'Customer Reviews'],
            ['branding', 'Logo, Contact, Footer & SEO'],
          ] as Array<[CmsSubTab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSubTab(key);
              setFeedback(null);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              subTab === key
                ? 'bg-[#4C8C3B] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg bg-[#EBF3E8] border border-[#C6DFBF] text-xs font-medium text-[#2F5D23] flex items-center gap-2">
          <Check className="w-4 h-4" />
          {feedback}
        </div>
      )}

      {/* HERO TAB */}
      {subTab === 'hero' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-sm font-bold text-slate-900">Hero Section</h3>
            <button
              type="button"
              disabled={saving}
              onClick={saveSections}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Publish Hero Changes'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Main Headline
              </label>
              <input
                type="text"
                value={sections.hero.headline}
                onChange={(e) =>
                  setSections({
                    ...sections,
                    hero: { ...sections.hero, headline: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subtitle
              </label>
              <textarea
                rows={2}
                value={sections.hero.subtitle}
                onChange={(e) =>
                  setSections({
                    ...sections,
                    hero: { ...sections.hero, subtitle: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Button Text
              </label>
              <input
                type="text"
                value={sections.hero.primary_cta_text}
                onChange={(e) =>
                  setSections({
                    ...sections,
                    hero: { ...sections.hero, primary_cta_text: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Secondary Button Text
              </label>
              <input
                type="text"
                value={sections.hero.secondary_cta_text}
                onChange={(e) =>
                  setSections({
                    ...sections,
                    hero: { ...sections.hero, secondary_cta_text: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="text-xs font-bold text-slate-900">Hero Background Image (16:9)</p>
              <ImageCropUploader
                token={token}
                preset="hero_banner"
                folder="hero"
                label="Upload & Crop Hero Background"
                currentImageUrl={sections.hero.background_image_url}
                onUploaded={(url) =>
                  setSections({
                    ...sections,
                    hero: { ...sections.hero, background_image_url: url },
                  })
                }
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="text-xs font-bold text-slate-900">Hero Product Showcase Image (4:3 / 1:1)</p>
              <ImageCropUploader
                token={token}
                preset="brand_section"
                folder="hero"
                label="Upload & Crop Hero Product"
                currentImageUrl={sections.hero.product_image_url}
                onUploaded={(url) =>
                  setSections({
                    ...sections,
                    hero: { ...sections.hero, product_image_url: url },
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* BRAND & ORIGINS TAB */}
      {subTab === 'brand' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-sm font-bold text-slate-900">
              Brand Introduction & Coffee Experience
            </h3>
            <button
              type="button"
              disabled={saving}
              onClick={saveSections}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Publish Brand Sections'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Brand Kicker
              </label>
              <input
                type="text"
                value={sections.brand.kicker}
                onChange={(e) =>
                  setSections({
                    ...sections,
                    brand: { ...sections.brand, kicker: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Brand Heading
              </label>
              <input
                type="text"
                value={sections.brand.heading}
                onChange={(e) =>
                  setSections({
                    ...sections,
                    brand: { ...sections.brand, heading: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Brand Story Description
              </label>
              <textarea
                rows={3}
                value={sections.brand.description}
                onChange={(e) =>
                  setSections({
                    ...sections,
                    brand: { ...sections.brand, description: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-bold text-slate-900 mb-2">Brand Section Image (4:3)</p>
              <ImageCropUploader
                token={token}
                preset="brand_section"
                folder="brand"
                label="Upload & Crop Brand Photo"
                currentImageUrl={sections.brand.image_url}
                onUploaded={(url) =>
                  setSections({
                    ...sections,
                    brand: { ...sections.brand, image_url: url },
                  })
                }
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <p className="text-xs font-bold text-slate-900">Experience Banner Heading</p>
              <input
                type="text"
                value={sections.experience.heading}
                onChange={(e) =>
                  setSections({
                    ...sections,
                    experience: { ...sections.experience, heading: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
              />
              <ImageCropUploader
                token={token}
                preset="brand_section"
                folder="brand"
                label="Upload Left Experience Photo"
                currentImageUrl={sections.experience.left_image_url}
                onUploaded={(url) =>
                  setSections({
                    ...sections,
                    experience: { ...sections.experience, left_image_url: url },
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* WHY CHOOSE US & STATS TAB */}
      {subTab === 'features' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-sm font-bold text-slate-900">
              Why Choose THE KITE & Animated Stats
            </h3>
            <button
              type="button"
              disabled={saving}
              onClick={saveSections}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Publish Features & Stats'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Why Choose Section Heading
              </label>
              <input
                type="text"
                value={sections.why_choose.heading}
                onChange={(e) =>
                  setSections({
                    ...sections,
                    why_choose: { ...sections.why_choose, heading: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Collection Section Title
              </label>
              <input
                type="text"
                value={sections.collection.heading}
                onChange={(e) =>
                  setSections({
                    ...sections,
                    collection: { ...sections.collection, heading: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sections.why_choose.features.map((feat, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <input
                  type="text"
                  value={feat.title}
                  onChange={(e) => {
                    const next = [...sections.why_choose.features];
                    next[idx] = { ...feat, title: e.target.value };
                    setSections({
                      ...sections,
                      why_choose: { ...sections.why_choose, features: next },
                    });
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                />
                <textarea
                  rows={2}
                  value={feat.description}
                  onChange={(e) => {
                    const next = [...sections.why_choose.features];
                    next[idx] = { ...feat, description: e.target.value };
                    setSections({
                      ...sections,
                      why_choose: { ...sections.why_choose, features: next },
                    });
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {sections.stats.items.map((stat, idx) => (
              <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={stat.value}
                    onChange={(e) => {
                      const next = [...sections.stats.items];
                      next[idx] = { ...stat, value: Number(e.target.value) };
                      setSections({
                        ...sections,
                        stats: { ...sections.stats, items: next },
                      });
                    }}
                    className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-mono-tabular font-bold"
                  />
                  <input
                    type="text"
                    value={stat.suffix}
                    placeholder="Suffix"
                    onChange={(e) => {
                      const next = [...sections.stats.items];
                      next[idx] = { ...stat, suffix: e.target.value };
                      setSections({
                        ...sections,
                        stats: { ...sections.stats, items: next },
                      });
                    }}
                    className="w-14 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
                <input
                  type="text"
                  value={stat.label}
                  onChange={(e) => {
                    const next = [...sections.stats.items];
                    next[idx] = { ...stat, label: e.target.value };
                    setSections({
                      ...sections,
                      stats: { ...sections.stats, items: next },
                    });
                  }}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CUSTOMER REVIEWS TAB */}
      {subTab === 'reviews' && (
        <div className="space-y-5">
          <form
            onSubmit={handleAddReview}
            className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
          >
            <h3 className="font-sans text-sm font-bold text-slate-900">
              Add Customer Review
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Customer Name *"
                value={newReview.customer_name}
                onChange={(e) =>
                  setNewReview({ ...newReview, customer_name: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                placeholder="Location (e.g. Banani, Dhaka)"
                value={newReview.customer_location}
                onChange={(e) =>
                  setNewReview({ ...newReview, customer_location: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                placeholder="Coffee Purchased"
                value={newReview.product_name}
                onChange={(e) =>
                  setNewReview({ ...newReview, product_name: e.target.value })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <textarea
              required
              rows={2}
              placeholder="Customer testimonial quote *"
              value={newReview.review_text}
              onChange={(e) =>
                setNewReview({ ...newReview, review_text: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <ImageCropUploader
                token={token}
                preset="review_avatar"
                folder="reviews"
                label="Upload Customer Photo (1:1)"
                currentImageUrl={newReview.avatar_url}
                onUploaded={(url) => setNewReview({ ...newReview, avatar_url: url })}
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Review
              </button>
            </div>
          </form>

          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {reviews.map((rev) => (
              <div key={rev.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">
                    {rev.customer_name} · {rev.customer_location} ({rev.rating}/5)
                  </p>
                  <p className="text-xs text-slate-600 mt-1">“{rev.review_text}”</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleReviewActive(rev)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      rev.is_active
                        ? 'bg-[#EBF3E8] text-[#2F5D23]'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {rev.is_active ? 'Visible' : 'Hidden'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteReview(rev.id)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BRANDING, CONTACT, FOOTER & SEO TAB */}
      {subTab === 'branding' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-sm font-bold text-slate-900">
              Brand Logo, Contact Information, Footer & SEO
            </h3>
            <button
              type="button"
              disabled={saving}
              onClick={saveSettings}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Website Branding'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Brand Name
              </label>
              <input
                type="text"
                value={settings.brand_name}
                onChange={(e) => setSettings({ ...settings, brand_name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Website Page Title
              </label>
              <input
                type="text"
                value={settings.website_title}
                onChange={(e) => setSettings({ ...settings, website_title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SEO Meta Description
              </label>
              <input
                type="text"
                value={settings.meta_description}
                onChange={(e) =>
                  setSettings({ ...settings, meta_description: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Store Support WhatsApp Number (880...)
              </label>
              <input
                type="text"
                value={settings.whatsapp_number}
                onChange={(e) =>
                  setSettings({ ...settings, whatsapp_number: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dhaka Office / Roastery Address
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Facebook URL
              </label>
              <input
                type="url"
                value={settings.facebook_url}
                onChange={(e) => setSettings({ ...settings, facebook_url: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instagram URL
              </label>
              <input
                type="url"
                value={settings.instagram_url}
                onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Footer About Copy
              </label>
              <textarea
                rows={2}
                value={settings.footer_about}
                onChange={(e) => setSettings({ ...settings, footer_about: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-bold text-slate-900 mb-2">Website Logo (1:1)</p>
              <ImageCropUploader
                token={token}
                preset="product_thumb"
                folder="branding"
                label="Upload & Crop Brand Logo"
                currentImageUrl={settings.logo_url}
                onUploaded={(url) => setSettings({ ...settings, logo_url: url })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
