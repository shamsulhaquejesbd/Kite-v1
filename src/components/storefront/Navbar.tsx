import { useEffect, useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';
import type { WebsiteSettings } from '../../types/index.ts';
import { isSafeHttpUrl } from '../../lib/format.ts';

interface NavbarProps {
  settings: WebsiteSettings;
  cartCount: number;
  activeView: 'home' | 'track' | 'admin';
  onNavigate: (view: 'home' | 'track' | 'admin', hash?: string) => void;
  onOpenCart: () => void;
}

export function Navbar({
  settings,
  cartCount,
  activeView,
  onNavigate,
  onOpenCart,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 36);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isSolid = scrolled || activeView !== 'home';

  const handleLink = (view: 'home' | 'track', hash?: string) => {
    setMobileOpen(false);
    onNavigate(view, hash);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isSolid
          ? 'bg-[#141210]/95 backdrop-blur-md border-b border-white/10 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Title */}
        <button
          type="button"
          onClick={() => handleLink('home', '#top')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4C8C3B] rounded"
        >
          {settings.logo_url && isSafeHttpUrl(settings.logo_url) && (
            <img
              src={settings.logo_url}
              alt={settings.brand_name}
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-full object-cover border border-white/20"
            />
          )}
          <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F7F4EE]">
            {settings.brand_name}
          </span>
        </button>

        {/* Zone 2: 5 concise single-line text links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#E5DEC9]">
          <button
            type="button"
            onClick={() => handleLink('home', '#top')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 border-transparent hover:border-[#4C8C3B]"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', '#collection')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 border-transparent hover:border-[#4C8C3B]"
          >
            Shop
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', '#our-coffee')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 border-transparent hover:border-[#4C8C3B]"
          >
            Our Coffee
          </button>
          <button
            type="button"
            onClick={() => handleLink('track')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 ${
              activeView === 'track'
                ? 'text-white border-[#4C8C3B]'
                : 'border-transparent hover:text-white hover:border-[#4C8C3B]'
            }`}
          >
            Track Order
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', '#contact')}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 border-b-2 border-transparent hover:border-[#4C8C3B]"
          >
            Contact
          </button>
        </nav>

        {/* Zone 3: Single Primary Cart Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Open shopping cart"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Cart</span>
            <span className="font-mono-tabular">({cartCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-[#F7F4EE] hover:bg-white/10 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-[#141210] border-t border-white/10 px-5 py-4 space-y-2">
          <button
            type="button"
            onClick={() => handleLink('home', '#top')}
            className="block w-full text-left py-2.5 text-sm font-medium text-[#E5DEC9] hover:text-white"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', '#collection')}
            className="block w-full text-left py-2.5 text-sm font-medium text-[#E5DEC9] hover:text-white"
          >
            Shop
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', '#our-coffee')}
            className="block w-full text-left py-2.5 text-sm font-medium text-[#E5DEC9] hover:text-white"
          >
            Our Coffee
          </button>
          <button
            type="button"
            onClick={() => handleLink('track')}
            className="block w-full text-left py-2.5 text-sm font-medium text-[#E5DEC9] hover:text-white"
          >
            Track Order
          </button>
          <button
            type="button"
            onClick={() => handleLink('home', '#contact')}
            className="block w-full text-left py-2.5 text-sm font-medium text-[#E5DEC9] hover:text-white"
          >
            Contact
          </button>
        </div>
      )}
    </header>
  );
}
