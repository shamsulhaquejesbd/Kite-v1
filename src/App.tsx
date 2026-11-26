import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { CartItem, Product, StorefrontPayload } from './types/index.ts';
import { Navbar } from './components/storefront/Navbar.tsx';
import { StorefrontHome } from './components/storefront/StorefrontHome.tsx';
import { ProductDetailModal } from './components/storefront/ProductDetailModal.tsx';
import { CartDrawer } from './components/storefront/CartDrawer.tsx';
import { CheckoutModal } from './components/storefront/CheckoutModal.tsx';
import { OrderTrackingPage } from './components/storefront/OrderTrackingPage.tsx';
import { AdminLogin, type AdminSession } from './components/admin/AdminLogin.tsx';
import { AdminPanel } from './components/admin/AdminPanel.tsx';
import { fetchStorefrontPayload } from './lib/storefrontClient.ts';

type AppView = 'home' | 'track' | 'admin';

function resolveInitialView(): AppView {
  const p = window.location.pathname;
  if (p.startsWith('/admin')) return 'admin';
  if (p.startsWith('/track')) return 'track';
  return 'home';
}

export default function App() {
  const [view, setView] = useState<AppView>(resolveInitialView);
  const [storefront, setStorefront] = useState<StorefrontPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cart & Shopping UI state (kept in memory; permanent data is stored on Supabase/server)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Order Tracking prefill after checkout
  const [trackPrefill, setTrackPrefill] = useState<{
    orderNumber: string;
    phone: string;
  }>({ orderNumber: '', phone: '' });

  // Admin auth session held strictly in React memory (never localStorage)
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);

  const loadStorefront = useCallback(async () => {
    try {
      const data = await fetchStorefrontPayload();
      setStorefront(data);
      if (data.settings?.website_title) {
        document.title = data.settings.website_title;
      }
      setSelectedZoneId((prev) => prev || data.deliveryZones[0]?.id || '');
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStorefront();
  }, [loadStorefront]);

  useEffect(() => {
    const onPopState = () => setView(resolveInitialView());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextView: AppView, hash?: string) => {
    const targetPath =
      nextView === 'admin' ? '/admin' : nextView === 'track' ? '/track' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setView(nextView);
    if (hash) {
      window.setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  const handleAddToCart = (product: Product, quantity: number) => {
    if (product.current_stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(product.current_stock, existing.quantity + quantity);
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, product, quantity: nextQty } : i
        );
      }
      return [...prev, { product, quantity: Math.min(product.current_stock, quantity) }];
    });
    showToast(`Added ${product.name} to your bag`);
  };

  const handleBuyNow = (product: Product, quantity: number) => {
    handleAddToCart(product, quantity);
    setActiveProduct(null);
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const handleUpdateQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, quantity: Math.min(i.product.current_stock, quantity) }
          : i
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141210] flex flex-col items-center justify-center text-[#F7F4EE] gap-3">
        <span className="font-display text-3xl font-bold tracking-tight">THE KITE</span>
        <span className="text-xs text-[#BDB4A4]">Roasting & Preparing Storefront...</span>
      </div>
    );
  }

  if (error || !storefront) {
    return (
      <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center p-6">
        <div className="max-w-md bg-white border border-[#E2D9C8] rounded-2xl p-6 text-center space-y-4">
          <h1 className="font-display text-xl font-bold text-[#1B1714]">
            Connection Issue
          </h1>
          <p className="text-sm text-[#5A524A]">{error || 'Could not reach server.'}</p>
          <button
            type="button"
            onClick={loadStorefront}
            className="px-5 py-2.5 rounded-lg bg-[#4C8C3B] text-white text-sm font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ADMIN ROUTE (/admin)
  if (view === 'admin') {
    if (!adminSession) {
      return (
        <AdminLogin
          onSuccess={(session) => setAdminSession(session)}
          onBackToStore={() => navigate('home')}
        />
      );
    }
    return (
      <AdminPanel
        session={adminSession}
        supabaseConfigured={storefront.supabaseConfigured}
        onLogout={() => setAdminSession(null)}
        onExitToStore={() => navigate('home')}
        onRefreshStorefront={loadStorefront}
      />
    );
  }

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        settings={storefront.settings}
        cartCount={cartCount}
        activeView={view}
        onNavigate={(nextView, hash) => navigate(nextView, hash)}
        onOpenCart={() => setCartOpen(true)}
      />

      {view === 'track' ? (
        <OrderTrackingPage
          settings={storefront.settings}
          initialOrderNumber={trackPrefill.orderNumber}
          initialPhone={trackPrefill.phone}
          onBackToStore={() => navigate('home')}
        />
      ) : (
        <StorefrontHome
          settings={storefront.settings}
          sections={storefront.sections}
          categories={storefront.categories}
          products={storefront.products}
          reviews={storefront.reviews}
          onSelectProduct={(p) => setActiveProduct(p)}
          onAddToCart={handleAddToCart}
          onNavigateTrack={() => navigate('track')}
          onNavigateAdmin={() => navigate('admin')}
        />
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={activeProduct}
        currencySymbol={storefront.settings.currency_symbol || '৳'}
        onClose={() => setActiveProduct(null)}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
      />

      {/* Slide-Over Cart Drawer */}
      <CartDrawer
        open={cartOpen}
        items={cart}
        deliveryZones={storefront.deliveryZones}
        selectedZoneId={selectedZoneId}
        defaultDeliveryCharge={storefront.settings.default_delivery_charge}
        currencySymbol={storefront.settings.currency_symbol || '৳'}
        onSelectZone={(id) => setSelectedZoneId(id)}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
      />

      {/* Checkout & Order Confirmation Modal */}
      <CheckoutModal
        open={checkoutOpen}
        items={cart}
        deliveryZones={storefront.deliveryZones}
        selectedZoneId={selectedZoneId}
        settings={storefront.settings}
        onSelectZone={(id) => setSelectedZoneId(id)}
        onClose={() => setCheckoutOpen(false)}
        onOrderSuccess={() => {
          setCart([]);
          loadStorefront();
        }}
        onTrackOrder={(orderNumber, phone) => {
          setTrackPrefill({ orderNumber, phone });
          navigate('track');
        }}
      />

      {/* Lightweight Add-to-Cart Toast Feedback */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#141210] text-white text-xs font-semibold shadow-xl border border-white/15">
          <CheckCircle2 className="w-4 h-4 text-[#7CC267]" />
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => {
              setToast(null);
              setCartOpen(true);
            }}
            className="ml-2 text-[#8FD47B] underline cursor-pointer"
          >
            View Bag
          </button>
        </div>
      )}
    </div>
  );
}
