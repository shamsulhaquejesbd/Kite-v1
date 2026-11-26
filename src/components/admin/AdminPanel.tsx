import { useEffect, useState } from 'react';
import {
  Boxes,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  Settings,
  ShoppingBag,
  ShoppingCart,
  X,
} from 'lucide-react';
import type {
  CustomerReview,
  DeliveryZone,
  HomepageSections,
  WebsiteSettings,
  WhatsAppTemplate,
} from '../../types/index.ts';
import type { AdminSession } from './AdminLogin.tsx';
import { AdminDashboardTab } from './AdminDashboardTab.tsx';
import { AdminOrdersTab } from './AdminOrdersTab.tsx';
import { AdminProductsTab } from './AdminProductsTab.tsx';
import { AdminInventoryTab } from './AdminInventoryTab.tsx';
import { AdminCmsTab } from './AdminCmsTab.tsx';
import { AdminSettingsTab } from './AdminSettingsTab.tsx';

type AdminTab = 'dashboard' | 'orders' | 'products' | 'inventory' | 'cms' | 'settings';

interface AdminPanelProps {
  session: AdminSession;
  supabaseConfigured: boolean;
  onLogout: () => void;
  onExitToStore: () => void;
  onRefreshStorefront: () => void;
}

interface CmsPayload {
  settings: WebsiteSettings;
  sections: HomepageSections;
  reviews: CustomerReview[];
  whatsappTemplates: WhatsAppTemplate[];
  deliveryZones: DeliveryZone[];
}

export function AdminPanel({
  session,
  supabaseConfigured,
  onLogout,
  onExitToStore,
  onRefreshStorefront,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmsData, setCmsData] = useState<CmsPayload | null>(null);

  const loadCmsData = async () => {
    const res = await fetch('/api/admin/cms', {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setCmsData(data);
    }
  };

  useEffect(() => {
    loadCmsData();
  }, [session.token]);

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders & WhatsApp', icon: ShoppingCart },
    { id: 'products', label: 'Products', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
    { id: 'cms', label: 'Website CMS', icon: Palette },
    { id: 'settings', label: 'Settings & SQL', icon: Settings },
  ];

  const activeLabel = navItems.find((n) => n.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Desktop & Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#141210] text-[#E5DEC9] flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 no-print ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
            <div>
              <span className="font-display text-lg font-bold text-white">THE KITE</span>
              <p className="text-[11px] text-[#9E9585]">Operations Console</p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-[#9E9585] hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#4C8C3B] text-white'
                      : 'text-[#BDB4A4] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="px-2">
            <p className="text-xs font-semibold text-white truncate">{session.admin.name}</p>
            <p className="text-[11px] text-[#9E9585] truncate">{session.admin.email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-xs font-semibold text-[#E5DEC9] hover:bg-white/10 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace Canvas */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-5 sm:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Open admin sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm text-slate-500 flex items-center gap-2">
              <span className="font-semibold text-slate-900">Admin</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-[#3D732E]">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!supabaseConfigured && (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer"
              >
                Connect Supabase DB
              </button>
            )}
            <button
              type="button"
              onClick={onExitToStore}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Storefront
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <AdminDashboardTab
              token={session.token}
              currencySymbol={cmsData?.settings.currency_symbol || '৳'}
              onQuickJump={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'orders' && (
            <AdminOrdersTab
              token={session.token}
              currencySymbol={cmsData?.settings.currency_symbol || '৳'}
              templates={cmsData?.whatsappTemplates || []}
            />
          )}

          {activeTab === 'products' && (
            <AdminProductsTab
              token={session.token}
              currencySymbol={cmsData?.settings.currency_symbol || '৳'}
              onChanged={() => {
                onRefreshStorefront();
                loadCmsData();
              }}
            />
          )}

          {activeTab === 'inventory' && (
            <AdminInventoryTab
              token={session.token}
              onChanged={onRefreshStorefront}
            />
          )}

          {activeTab === 'cms' && cmsData && (
            <AdminCmsTab
              token={session.token}
              initialSettings={cmsData.settings}
              initialSections={cmsData.sections}
              initialReviews={cmsData.reviews}
              onRefreshStorefront={() => {
                onRefreshStorefront();
                loadCmsData();
              }}
            />
          )}

          {activeTab === 'settings' && cmsData && (
            <AdminSettingsTab
              token={session.token}
              initialSettings={cmsData.settings}
              initialTemplates={cmsData.whatsappTemplates}
              initialZones={cmsData.deliveryZones}
              onRefreshStorefront={() => {
                onRefreshStorefront();
                loadCmsData();
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
