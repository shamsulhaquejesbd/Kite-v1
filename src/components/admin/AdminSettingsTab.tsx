import { useEffect, useState } from 'react';
import { Check, Copy, Database, Plus, Save, Trash2 } from 'lucide-react';
import type {
  DeliveryZone,
  WebsiteSettings,
  WhatsAppTemplate,
} from '../../types/index.ts';
import { formatBDT } from '../../lib/format.ts';

interface AdminSettingsTabProps {
  token: string;
  initialSettings: WebsiteSettings;
  initialTemplates: WhatsAppTemplate[];
  initialZones: DeliveryZone[];
  onRefreshStorefront: () => void;
}

export function AdminSettingsTab({
  token,
  initialSettings,
  initialTemplates,
  initialZones,
  onRefreshStorefront,
}: AdminSettingsTabProps) {
  const [settings, setSettings] = useState<WebsiteSettings>(initialSettings);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(initialTemplates);
  const [zones, setZones] = useState<DeliveryZone[]>(initialZones);
  const [newZone, setNewZone] = useState({
    district: '',
    area_thana: '',
    delivery_charge: '120',
    estimated_days: '2–3 Days',
  });
  const [sqlInfo, setSqlInfo] = useState<{
    supabaseConfigured: boolean;
    missingSupabaseVars: string[];
    schemaSql: string;
    seedSql: string;
  } | null>(null);
  const [copiedType, setCopiedType] = useState<'schema' | 'seed' | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/system/sql', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setSqlInfo(d))
      .catch(() => {});
  }, [token]);

  const handleSaveSettings = async () => {
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
      if (!res.ok) throw new Error(data.error || 'Could not save settings.');
      setSettings(data.settings);
      setFeedback('General, order prefix, and currency settings saved.');
      onRefreshStorefront();
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplates = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/settings/whatsapp-templates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ templates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save WhatsApp templates.');
      setTemplates(data.whatsappTemplates);
      setFeedback('WhatsApp message templates saved.');
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/settings/delivery-zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newZone,
          delivery_charge: Number(newZone.delivery_charge),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add delivery zone.');
      setZones((prev) => [...prev, data.zone]);
      setNewZone({ district: '', area_thana: '', delivery_charge: '120', estimated_days: '2–3 Days' });
      setFeedback('Delivery zone added.');
      onRefreshStorefront();
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async (id: string) => {
    const res = await fetch(`/api/admin/settings/delivery-zones/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setZones((prev) => prev.filter((z) => z.id !== id));
      onRefreshStorefront();
    }
  };

  const handleSeedSupabase = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/system/seed-supabase', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Seed failed');
      setFeedback(data.message);
      onRefreshStorefront();
    } catch (err) {
      setFeedback((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copySql = async (type: 'schema' | 'seed') => {
    if (!sqlInfo) return;
    await navigator.clipboard.writeText(type === 'schema' ? sqlInfo.schemaSql : sqlInfo.seedSql);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="px-4 py-2.5 rounded-lg bg-[#EBF3E8] border border-[#C6DFBF] text-xs font-medium text-[#2F5D23] flex items-center gap-2">
          <Check className="w-4 h-4" />
          {feedback}
        </div>
      )}

      {/* Supabase Status & SQL Migration Center */}
      {sqlInfo && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-[#4C8C3B]" />
              <div>
                <h3 className="font-sans text-sm font-bold text-slate-900">
                  Supabase Database & Storage Status
                </h3>
                <p className="text-xs text-slate-500">
                  {sqlInfo.supabaseConfigured
                    ? 'Connected to Supabase PostgreSQL & Storage (kite-media).'
                    : `Running in preview mode until env secrets are set: ${sqlInfo.missingSupabaseVars.join(', ')}`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => copySql('schema')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {copiedType === 'schema' ? <Check className="w-3.5 h-3.5 text-[#4C8C3B]" /> : <Copy className="w-3.5 h-3.5" />}
                Copy 001_initial_schema.sql
              </button>
              <button
                type="button"
                onClick={() => copySql('seed')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {copiedType === 'seed' ? <Check className="w-3.5 h-3.5 text-[#4C8C3B]" /> : <Copy className="w-3.5 h-3.5" />}
                Copy 002_seed_data.sql
              </button>
              {sqlInfo.supabaseConfigured && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSeedSupabase}
                  className="px-3.5 py-1.5 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold cursor-pointer"
                >
                  Seed 7 Coffee Products
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Store Operations & Currency Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-sm font-bold text-slate-900">
            Store Operations, Order Prefix & Currency
          </h3>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveSettings}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Save Settings
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Order ID Prefix
            </label>
            <input
              type="text"
              value={settings.order_id_prefix}
              onChange={(e) =>
                setSettings({ ...settings, order_id_prefix: e.target.value.toUpperCase() })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Currency Symbol
            </label>
            <input
              type="text"
              value={settings.currency_symbol}
              onChange={(e) =>
                setSettings({ ...settings, currency_symbol: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Default Delivery Charge ({settings.currency_symbol})
            </label>
            <input
              type="number"
              min={0}
              value={settings.default_delivery_charge}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_delivery_charge: Number(e.target.value),
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Low Stock Alert Threshold
            </label>
            <input
              type="number"
              min={0}
              value={settings.low_stock_threshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  low_stock_threshold: Number(e.target.value),
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
            />
          </div>
        </div>
      </div>

      {/* WhatsApp Message Templates */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-sans text-sm font-bold text-slate-900">
              WhatsApp Message Templates
            </h3>
            <p className="text-xs text-slate-500">
              Available placeholders: <code>[Customer Name]</code>, <code>[Order ID]</code>, <code>[Total]</code>
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveTemplates}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Save Templates
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl, idx) => (
            <div key={tpl.status_key} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <label className="block text-xs font-bold text-slate-900">
                {tpl.label} ({tpl.status_key})
              </label>
              <textarea
                rows={3}
                value={tpl.template_text}
                onChange={(e) => {
                  const next = [...templates];
                  next[idx] = { ...tpl, template_text: e.target.value };
                  setTemplates(next);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bangladesh District & Area Delivery Zones */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h3 className="font-sans text-sm font-bold text-slate-900">
          District & Area Delivery Charges (Bangladesh)
        </h3>

        <form onSubmit={handleAddZone} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              District
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dhaka"
              value={newZone.district}
              onChange={(e) => setNewZone({ ...newZone, district: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Area / Thana
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Uttara / Mirpur"
              value={newZone.area_thana}
              onChange={(e) => setNewZone({ ...newZone, area_thana: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Charge ({settings.currency_symbol})
            </label>
            <input
              type="number"
              required
              min={0}
              value={newZone.delivery_charge}
              onChange={(e) =>
                setNewZone({ ...newZone, delivery_charge: e.target.value })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono-tabular"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Zone
            </button>
          </div>
        </form>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {zones.map((z) => (
            <div key={z.id} className="px-4 py-2.5 flex items-center justify-between text-xs bg-white">
              <div>
                <span className="font-bold text-slate-900">{z.district}</span>
                <span className="text-slate-500"> — {z.area_thana} ({z.estimated_days})</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono-tabular font-bold text-[#3D732E]">
                  {formatBDT(z.delivery_charge, settings.currency_symbol)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteZone(z.id)}
                  className="text-slate-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
