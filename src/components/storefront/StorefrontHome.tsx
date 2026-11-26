import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react';
import {
  ArrowRight,
  Award,
  Check,
  Coffee,
  Eye,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Star,
  Wind,
  Youtube,
} from 'lucide-react';
import type {
  Category,
  CustomerReview,
  HomepageSections,
  Product,
  WebsiteSettings,
} from '../../types/index.ts';
import { buildWhatsAppClickToChatUrl, formatBDT, isSafeHttpUrl } from '../../lib/format.ts';
import { subscribeNewsletterClient } from '../../lib/storefrontClient.ts';
import { CoffeeVisual } from '../CoffeeVisual.tsx';

interface StorefrontHomeProps {
  settings: WebsiteSettings;
  sections: HomepageSections;
  categories: Category[];
  products: Product[];
  reviews: CustomerReview[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onNavigateTrack: () => void;
  onNavigateAdmin: () => void;
}

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const totalFrames = 36;
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = 1 - Math.pow(1 - frame / totalFrames, 3);
      setDisplay(Math.round(value * progress));
      if (frame >= totalFrames) {
        setDisplay(value);
        window.clearInterval(timer);
      }
    }, 24);
    return () => window.clearInterval(timer);
  }, [inView, value, reduceMotion]);

  return (
    <span ref={ref} className="font-display font-bold tabular-nums">
      {display.toLocaleString('en-BD')}
      {suffix}
    </span>
  );
}

function FeatureIcon({ name }: { name: string }) {
  switch (name) {
    case 'award':
      return <Award className="w-6 h-6 text-[#4C8C3B]" />;
    case 'wind':
      return <Wind className="w-6 h-6 text-[#4C8C3B]" />;
    case 'shield':
      return <ShieldCheck className="w-6 h-6 text-[#4C8C3B]" />;
    case 'check':
      return <Check className="w-6 h-6 text-[#4C8C3B]" />;
    case 'package':
      return <Package className="w-6 h-6 text-[#4C8C3B]" />;
    default:
      return <Coffee className="w-6 h-6 text-[#4C8C3B]" />;
  }
}

export function StorefrontHome({
  settings,
  sections,
  categories,
  products,
  reviews,
  onSelectProduct,
  onAddToCart,
  onNavigateTrack,
  onNavigateAdmin,
}: StorefrontHomeProps) {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroParallaxY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 72]);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterAgreed, setNewsletterAgreed] = useState(true);
  const [newsletterStatus, setNewsletterStatus] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  const currency = settings.currency_symbol || '৳';
  const featuredProduct =
    products.find((p) => p.is_featured) || products[0] || null;

  const heroSlides = (() => {
    const candidates = [
      {
        src:
          sections.hero.product_image_url ||
          featuredProduct?.images?.[0]?.image_url ||
          '/src/assets/images/hero_coffee_pouch_1795674313314.jpg',
        alt: 'THE KITE Brazilian Coffee Pouch',
        label: featuredProduct?.name.replace('THE KITE ', '') || 'Cerrado Mineiro',
        sublabel: 'Fresh Brazilian Harvest',
      },
      {
        src: '/src/assets/images/product_arabica_collection_1795674313874.jpg',
        alt: 'Single-Origin Brazilian Arabica Collection',
        label: 'Arabica Collection',
        sublabel: 'Small-Batch Roasted',
      },
      {
        src: '/src/assets/images/experience_espresso_cup_1795674313813.jpg',
        alt: 'Freshly Brewed Brazilian Espresso Crema',
        label: 'Rich Espresso Crema',
        sublabel: 'Sul de Minas Roast',
      },
      {
        src: '/src/assets/images/brand_plantation_harvest_1795674314245.jpg',
        alt: 'Minas Gerais Coffee Harvest',
        label: 'Minas Gerais Farms',
        sublabel: '100% Hand-Picked Cherries',
      },
    ];
    for (const p of products) {
      const imgUrl = p.images?.[0]?.image_url;
      if (imgUrl && !candidates.some((c) => c.src === imgUrl)) {
        candidates.push({
          src: imgUrl,
          alt: p.name,
          label: p.name.replace('THE KITE ', ''),
          sublabel: `${p.roast_level} · ${p.weight_label}`,
        });
      }
    }
    const seen = new Set<string>();
    return candidates.filter((item) => {
      if (!item.src || seen.has(item.src)) return false;
      seen.add(item.src);
      return true;
    });
  })();

  const [heroSlideIdx, setHeroSlideIdx] = useState(0);
  const [heroSlidePaused, setHeroSlidePaused] = useState(false);

  useEffect(() => {
    if (reduceMotion || heroSlidePaused || heroSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroSlideIdx((prev) => (prev + 1) % heroSlides.length);
    }, 3400);
    return () => window.clearInterval(timer);
  }, [reduceMotion, heroSlidePaused, heroSlides.length]);

  const activeHeroSlide = heroSlides[heroSlideIdx % heroSlides.length] || heroSlides[0];

  const filteredProducts =
    activeCategory === 'all'
      ? products
      : products.filter((p) => p.category_id === activeCategory);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterAgreed) {
      setNewsletterStatus({ type: 'err', text: 'Please agree to receive roast updates.' });
      return;
    }
    try {
      const data = await subscribeNewsletterClient(newsletterEmail);
      setNewsletterStatus({ type: 'ok', text: data.message });
      setNewsletterEmail('');
    } catch (err) {
      setNewsletterStatus({ type: 'err', text: (err as Error).message });
    }
  };

  const revealProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-60px' },
        transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
      };

  const leftFeatures = sections.why_choose.features.slice(0, 3);
  const rightFeatures = sections.why_choose.features.slice(3, 6);

  return (
    <main id="top" className="overflow-x-hidden">
      {/* ================================================================
          1. HERO SECTION
         ================================================================ */}
      <section
        ref={heroRef}
        className="relative min-h-[88vh] flex flex-col justify-between bg-roast-pattern text-[#F7F4EE] pt-28 pb-0 overflow-hidden"
      >
        {sections.hero.background_image_url &&
          isSafeHttpUrl(sections.hero.background_image_url) && (
            <motion.div
              style={{ y: heroParallaxY }}
              className="absolute inset-0 pointer-events-none"
            >
              <img
                src={sections.hero.background_image_url}
                alt="Brazilian coffee beans backdrop"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#141210]/20 via-[#141210]/10 to-[#141210]/25" />
            </motion.div>
          )}

        <div className="relative z-10 max-w-7xl mx-auto w-full px-5 sm:px-8 pt-6 pb-12 text-center flex flex-col items-center">
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-xs sm:text-sm font-medium tracking-wide text-[#8FD47B] mb-4"
          >
            {sections.hero.origin_badge}
          </motion.p>

          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="font-display text-4xl sm:text-5xl lg:text-[4rem] font-bold tracking-tight text-white max-w-4xl leading-[1.08]"
          >
            {sections.hero.headline}
          </motion.h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mt-5 text-base sm:text-lg text-[#D7CEBF] max-w-2xl leading-relaxed"
          >
            {sections.hero.subtitle}
          </motion.p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <a
              href={sections.hero.primary_cta_link || '#collection'}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-[#4C8C3B]/25 whitespace-nowrap"
            >
              {sections.hero.primary_cta_text}
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href={sections.hero.secondary_cta_link || '#featured'}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/25 bg-white/5 hover:bg-white/15 text-[#F7F4EE] text-sm font-semibold transition-all duration-200 whitespace-nowrap"
            >
              {sections.hero.secondary_cta_text}
            </a>
          </motion.div>

          {/* Hero Focal Product Showcase */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.3 }}
            className="relative mt-12 w-full max-w-md mx-auto z-20"
            onMouseEnter={() => setHeroSlidePaused(true)}
            onMouseLeave={() => setHeroSlidePaused(false)}
          >
            <motion.div
              animate={
                reduceMotion
                  ? undefined
                  : { y: [0, -8, 0] }
              }
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
              className="relative rounded-3xl overflow-hidden border border-white/20 shadow-md shadow-black/10 bg-[#1D1815]"
            >
              <div className="relative w-full aspect-4/3 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeHeroSlide.src}
                    initial={reduceMotion ? false : { opacity: 0, x: 24, scale: 1.03 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: -24, scale: 0.98 }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full h-full"
                  >
                    <CoffeeVisual
                      src={activeHeroSlide.src}
                      alt={activeHeroSlide.alt}
                      variant="hero"
                      label={activeHeroSlide.label}
                      sublabel={activeHeroSlide.sublabel}
                      className="w-full h-full"
                    />
                  </motion.div>
                </AnimatePresence>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-left min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {activeHeroSlide.label}
                    </p>
                    <p className="text-[11px] text-[#D7CEBF] truncate">
                      {activeHeroSlide.sublabel}
                    </p>
                  </div>

                  {heroSlides.length > 1 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {heroSlides.map((slide, idx) => {
                        const isActive = idx === heroSlideIdx % heroSlides.length;
                        return (
                          <button
                            key={slide.src}
                            type="button"
                            aria-label={`Show ${slide.label}`}
                            onClick={() => setHeroSlideIdx(idx)}
                            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                              isActive
                                ? 'w-5 bg-[#8FD47B]'
                                : 'w-1.5 bg-white/45 hover:bg-white/75'
                            }`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Signature Botanical Green Base Band inspired by reference */}
        <div className="relative z-10 h-20 sm:h-28 -mt-14 bg-botanical-green border-t border-white/10" />
      </section>

      {/* ================================================================
          2. BRAND INTRODUCTION SECTION
         ================================================================ */}
      <section id="our-coffee" className="py-20 sm:py-24 px-5 sm:px-8 bg-white">
        <motion.div
          {...revealProps}
          className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
        >
          <div className="lg:col-span-6 space-y-6">
            <div>
              <p className="text-sm font-semibold text-[#4C8C3B] mb-2">
                {sections.brand.kicker}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1B1714] leading-tight">
                {sections.brand.heading}
              </h2>
            </div>

            <p className="text-base text-[#4A433C] leading-relaxed max-w-xl">
              {sections.brand.description}
            </p>

            <div className="space-y-2.5 pt-1 text-sm text-[#1B1714]">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#4C8C3B]" />
                <span>Direct-trade Minas Gerais & São Paulo harvests</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#4C8C3B]" />
                <span className="font-mono-tabular font-semibold">{settings.phone}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="#collection"
                className="px-6 py-3 rounded-full bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-sm font-semibold transition-colors whitespace-nowrap"
              >
                {sections.brand.cta_text}
              </a>
              <button
                type="button"
                onClick={onNavigateTrack}
                className="px-6 py-3 rounded-full bg-[#1B1714] hover:bg-[#2F2823] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Track Order
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            {!sections.brand.image_url ||
            sections.brand.image_url === '/assets/aistudio/image_68e14a32.png' ||
            sections.brand.image_url ===
              '/src/assets/images/brand_plantation_harvest_1795674314245.jpg' ? (
              <div className="relative mx-auto max-w-lg">
                <img
                  src="/assets/aistudio/image_68e14a32.png"
                  alt="THE KITE Brazilian Coffee Café & Barista Experience"
                  className="w-full h-auto object-contain mix-blend-multiply select-none"
                />
              </div>
            ) : (
              <div className="relative mx-auto max-w-lg">
                <div className="relative overflow-hidden rounded-[46%_54%_42%_58%/48%_44%_56%_52%] aspect-[11/10] bg-[#F7F4EE]">
                  <CoffeeVisual
                    src={sections.brand.image_url}
                    alt="THE KITE Brazilian Coffee Plantation & Harvest"
                    variant="beans"
                    label="Minas Gerais · Hand-Picked Harvest"
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 sm:mt-0 sm:top-2 sm:left-2 sm:absolute bg-white/95 backdrop-blur-xs border border-[#E2D9C8] rounded-2xl px-5 py-3.5 shadow-sm inline-block">
              <p className="text-xs font-medium text-[#5A524A]">
                {sections.brand.heritage_label}
              </p>
              <p className="font-display text-2xl font-bold text-[#4C8C3B]">
                {sections.brand.heritage_value}
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ================================================================
          3. FOUR COFFEE VARIETIES / ORIGINS STRIP
         ================================================================ */}
      <section className="py-20 px-5 sm:px-8 bg-parchment-grain border-y border-[#E6DEC8]">
        <motion.div {...revealProps} className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1B1714] leading-snug">
              {sections.varieties.heading}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {sections.varieties.items.map((item) => (
              <div key={item.number} className="text-center flex flex-col items-center group">
                <div className="relative w-36 h-36 mb-5">
                  <div className="w-full h-full rounded-full overflow-hidden border-4 border-white shadow-md transition-transform duration-300 group-hover:scale-105">
                    <CoffeeVisual
                      src={item.image_url}
                      alt={item.title}
                      variant="beans"
                      className="w-full h-full"
                    />
                  </div>
                  <span className="absolute -top-1 -left-1 w-10 h-10 rounded-full bg-[#4C8C3B] text-white font-mono-tabular text-xs font-bold flex items-center justify-center shadow-sm">
                    {item.number}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-[#1B1714] mb-1.5">
                  {item.title}
                </h3>
                <p className="text-sm text-[#5A524A] leading-relaxed max-w-xs">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ================================================================
          4. DIVINE AROMA SPLIT EXPERIENCE
         ================================================================ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 min-h-[420px]">
        <div className="lg:col-span-4 min-h-[260px] bg-[#1B1714]">
          <CoffeeVisual
            src={sections.experience.left_image_url}
            alt="Freshly roasted Brazilian coffee beans"
            variant="beans"
            label="Small-Batch Drum Roasted"
            className="w-full h-full"
          />
        </div>

        <div className="lg:col-span-4 bg-botanical-green text-white p-10 sm:p-14 flex flex-col justify-center">
          <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight mb-4">
            {sections.experience.heading}
          </h2>
          <p className="text-sm sm:text-base text-[#EBF3E8] leading-relaxed mb-7">
            {sections.experience.description}
          </p>
          <div>
            <a
              href="#collection"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#141210] hover:bg-black text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              {sections.experience.cta_text}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-4 min-h-[260px] bg-[#251E19]">
          <CoffeeVisual
            src={sections.experience.right_image_url}
            alt="Enjoying a warm cup of THE KITE coffee"
            variant="cup"
            className="w-full h-full"
          />
        </div>
      </section>

      {/* ================================================================
          5. WHY CHOOSE THE KITE? (SYMMETRIC FEATURE MATRIX)
         ================================================================ */}
      <section className="py-20 sm:py-24 px-5 sm:px-8 bg-white">
        <motion.div {...revealProps} className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-semibold text-[#4C8C3B] mb-2">
              Crafted Without Compromise
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1B1714]">
              {sections.why_choose.heading}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-4 space-y-8">
              {leftFeatures.map((feat) => (
                <div key={feat.title} className="flex items-start gap-4 lg:flex-row-reverse lg:text-right">
                  <div className="w-12 h-12 rounded-xl bg-[#EBF3E8] flex items-center justify-center shrink-0">
                    <FeatureIcon name={feat.icon} />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#1B1714]">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-[#5A524A] mt-1 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-4 flex justify-center">
              <div className="w-72 h-72 sm:w-80 sm:h-80 rounded-full overflow-hidden border border-[#E2D9C8] shadow-sm">
                <CoffeeVisual
                  src={sections.why_choose.center_image_url}
                  alt="Top-down espresso cup surrounded by coffee leaves"
                  variant="cup"
                  className="w-full h-full"
                />
              </div>
            </div>

            <div className="lg:col-span-4 space-y-8">
              {rightFeatures.map((feat) => (
                <div key={feat.title} className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#EBF3E8] flex items-center justify-center shrink-0">
                    <FeatureIcon name={feat.icon} />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#1B1714]">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-[#5A524A] mt-1 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ================================================================
          6. ROASTERY CRAFT & ANIMATED STATISTICS BAND
         ================================================================ */}
      <section className="bg-roast-pattern text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-20 text-center">
          <p className="text-xs font-semibold text-[#8FD47B] mb-2">From Farm to Cup</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
            {sections.stats.heading}
          </h2>
          <p className="text-sm sm:text-base text-[#D7CEBF] max-w-xl mx-auto mb-8">
            {sections.stats.subtext}
          </p>
          <a
            href="#collection"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-sm font-semibold transition-colors"
          >
            Explore Fresh Roasts
          </a>
        </div>

        <div className="bg-botanical-green py-12 px-5 sm:px-8">
          <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {sections.stats.items.map((stat) => (
              <div key={stat.label}>
                <div className="text-4xl sm:text-5xl text-white">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <p className="mt-2 text-xs sm:text-sm font-medium text-[#EBF3E8]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          7. FEATURED PRODUCT SPOTLIGHT + COFFEE COLLECTION
         ================================================================ */}
      <section id="featured" className="py-20 sm:py-24 px-5 sm:px-8 bg-[#F7F4EE]">
        <div className="max-w-7xl mx-auto space-y-20">
          {/* Featured Product Spotlight */}
          {featuredProduct && (
            <motion.div {...revealProps}>
              <div className="text-center max-w-2xl mx-auto mb-12">
                <p className="text-xs font-semibold text-[#4C8C3B] mb-1.5">
                  {sections.collection.kicker}
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1B1714]">
                  {sections.collection.featured_heading}
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center bg-white rounded-3xl border border-[#E2D9C8] p-6 sm:p-10 shadow-xs">
                <div className="lg:col-span-6 aspect-square max-w-md mx-auto w-full rounded-2xl overflow-hidden border border-[#E2D9C8]">
                  <CoffeeVisual
                    src={featuredProduct.images?.[0]?.image_url}
                    alt={featuredProduct.name}
                    variant="pouch"
                    label={featuredProduct.name.replace('THE KITE ', '')}
                    sublabel={`${featuredProduct.weight_label} · ${featuredProduct.roast_level}`}
                    className="w-full h-full"
                    imgClassName="transition-transform duration-500 hover:scale-105"
                  />
                </div>

                <div className="lg:col-span-6 space-y-5">
                  <div className="flex items-center gap-2 text-xs text-[#5A524A]">
                    <span>{featuredProduct.category_name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{featuredProduct.origin}</span>
                    <span aria-hidden="true">·</span>
                    <span>{featuredProduct.weight_label}</span>
                  </div>

                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#1B1714]">
                    {featuredProduct.name}
                  </h3>

                  <p className="text-sm sm:text-base text-[#4A433C] leading-relaxed">
                    {featuredProduct.description}
                  </p>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {featuredProduct.tasting_notes.map((note) => (
                      <li key={note} className="flex items-center gap-2 text-sm text-[#1B1714]">
                        <Check className="w-4 h-4 text-[#4C8C3B] shrink-0" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-baseline gap-3 pt-2">
                    <span className="font-mono-tabular text-2xl font-bold text-[#1B1714]">
                      {formatBDT(
                        featuredProduct.discount_price ?? featuredProduct.price,
                        currency
                      )}
                    </span>
                    {featuredProduct.discount_price !== null &&
                      featuredProduct.discount_price < featuredProduct.price && (
                        <span className="font-mono-tabular text-base text-[#8C8277] line-through">
                          {formatBDT(featuredProduct.price, currency)}
                        </span>
                      )}
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="button"
                      disabled={featuredProduct.current_stock <= 0}
                      onClick={() => onAddToCart(featuredProduct, 1)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-sm font-semibold transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {featuredProduct.current_stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectProduct(featuredProduct)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1B1714] hover:bg-black text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Full Coffee Collection Grid */}
          <div id="collection" className="scroll-mt-24 space-y-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <p className="text-xs font-semibold text-[#4C8C3B] mb-1.5">
                  Freshly Roasted in Small Batches
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1B1714]">
                  {sections.collection.heading}
                </h2>
                <p className="text-sm sm:text-base text-[#5A524A] mt-2 max-w-xl">
                  {sections.collection.description}
                </p>
              </div>

              {/* Interactive Category Segmented Filter */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-[#E2D9C8] rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeCategory === 'all'
                      ? 'bg-[#4C8C3B] text-white'
                      : 'text-[#4A433C] hover:bg-[#F7F4EE]'
                  }`}
                >
                  All Coffees
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      activeCategory === cat.id
                        ? 'bg-[#4C8C3B] text-white'
                        : 'text-[#4A433C] hover:bg-[#F7F4EE]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E2D9C8] p-12 text-center text-[#5A524A]">
                No coffee products found in this category.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product) => {
                  const effectivePrice = product.discount_price ?? product.price;
                  const hasDiscount =
                    product.discount_price !== null &&
                    product.discount_price < product.price;
                  const outOfStock = product.current_stock <= 0;

                  return (
                    <motion.article
                      key={product.id}
                      whileHover={reduceMotion ? undefined : { y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white rounded-2xl border border-[#E2D9C8] overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-md transition-shadow"
                    >
                      <div>
                        <div
                          onClick={() => onSelectProduct(product)}
                          className="aspect-square overflow-hidden bg-[#F4EFE6] cursor-pointer group"
                        >
                          <CoffeeVisual
                            src={product.images?.[0]?.image_url}
                            alt={product.name}
                            variant="pouch"
                            label={product.name.replace('THE KITE ', '')}
                            sublabel={`${product.weight_label} · ${product.roast_level}`}
                            className="w-full h-full"
                            imgClassName="transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>

                        <div className="p-5 space-y-2.5">
                          <div className="flex items-center justify-between text-xs text-[#5A524A]">
                            <span className="truncate">{product.roast_level}</span>
                            <span
                              className={`font-medium shrink-0 ${
                                outOfStock ? 'text-red-700' : 'text-[#3D732E]'
                              }`}
                            >
                              {outOfStock
                                ? 'Out of Stock'
                                : product.current_stock <= product.low_stock_threshold
                                ? `${product.current_stock} left`
                                : 'In Stock'}
                            </span>
                          </div>

                          <h3
                            onClick={() => onSelectProduct(product)}
                            className="font-display text-lg font-bold text-[#1B1714] leading-snug cursor-pointer hover:text-[#4C8C3B] transition-colors"
                          >
                            {product.name}
                          </h3>

                          <p className="text-xs sm:text-sm text-[#5A524A] line-clamp-2 leading-relaxed">
                            {product.short_description}
                          </p>
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-2 space-y-3">
                        <div className="flex items-baseline justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono-tabular text-lg font-bold text-[#1B1714]">
                              {formatBDT(effectivePrice, currency)}
                            </span>
                            {hasDiscount && (
                              <span className="font-mono-tabular text-xs text-[#8C8277] line-through">
                                {formatBDT(product.price, currency)}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-mono-tabular text-[#5A524A]">
                            {product.weight_label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={outOfStock}
                            onClick={() => onAddToCart(product, 1)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            Add to Cart
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectProduct(product)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#D4C9B8] bg-[#F7F4EE] hover:bg-[#1B1714] hover:text-white text-[#1B1714] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================================================================
          8. CUSTOMER REVIEWS (ADMIN CMS MANAGED)
         ================================================================ */}
      {reviews.length > 0 && (
        <section className="py-20 px-5 sm:px-8 bg-white border-t border-[#E2D9C8]">
          <motion.div {...revealProps} className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs font-semibold text-[#4C8C3B] mb-1.5">Customer Voices</p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1B1714]">
                {sections.reviews_section.heading}
              </h2>
              <p className="text-sm sm:text-base text-[#5A524A] mt-2">
                {sections.reviews_section.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-[#F7F4EE] rounded-2xl border border-[#E2D9C8] p-6 flex flex-col justify-between gap-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-1 text-[#C58A2B]">
                      {Array.from({ length: rev.rating }).map((_, idx) => (
                        <Star key={idx} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                    <p className="text-sm text-[#1B1714] leading-relaxed">
                      “{rev.review_text}”
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-[#E2D9C8]">
                    <CoffeeVisual
                      src={rev.avatar_url}
                      alt={rev.customer_name}
                      variant="avatar"
                      className="w-10 h-10 rounded-full shrink-0 text-xs"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1B1714] truncate">
                        {rev.customer_name}
                      </p>
                      <p className="text-xs text-[#5A524A] truncate">
                        {rev.customer_location}
                        {rev.product_name ? ` · ${rev.product_name}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* ================================================================
          9. NEWSLETTER & DARK ROAST FOOTER
         ================================================================ */}
      <footer id="contact" className="bg-roast-pattern text-[#D7CEBF]">
        {/* Newsletter Band */}
        <div className="border-b border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                {sections.newsletter.heading}
              </h2>
              <p className="text-sm text-[#BDB4A4] max-w-lg">
                {sections.newsletter.description}
              </p>
            </div>

            <form onSubmit={handleNewsletterSubmit} className="lg:col-span-6 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="flex-1 rounded-full bg-white px-5 py-3 text-sm text-[#1B1714] placeholder:text-[#8C8277] focus:outline-none focus:ring-2 focus:ring-[#4C8C3B]"
                />
                <button
                  type="submit"
                  className="px-7 py-3 rounded-full bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {sections.newsletter.button_text}
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#BDB4A4] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newsletterAgreed}
                  onChange={(e) => setNewsletterAgreed(e.target.checked)}
                  className="accent-[#4C8C3B]"
                />
                <span>I agree to receive roast updates and promotional emails from {settings.brand_name}.</span>
              </label>
              {newsletterStatus && (
                <p
                  className={`text-xs font-medium ${
                    newsletterStatus.type === 'ok' ? 'text-[#8FD47B]' : 'text-red-400'
                  }`}
                >
                  {newsletterStatus.text}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              {settings.logo_url && isSafeHttpUrl(settings.logo_url) && (
                <img
                  src={settings.logo_url}
                  alt={settings.brand_name}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full object-cover border border-white/20"
                />
              )}
              <span className="font-display text-2xl font-bold text-white">
                {settings.brand_name}
              </span>
            </div>
            <p className="text-sm text-[#BDB4A4] leading-relaxed max-w-sm">
              {settings.footer_about}
            </p>
            <div className="flex items-center gap-3 pt-1">
              {settings.facebook_url && isSafeHttpUrl(settings.facebook_url) && (
                <a
                  href={settings.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="p-2 rounded-lg bg-white/5 hover:bg-[#4C8C3B] text-white transition-colors"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {settings.instagram_url && isSafeHttpUrl(settings.instagram_url) && (
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="p-2 rounded-lg bg-white/5 hover:bg-[#4C8C3B] text-white transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {settings.youtube_url && isSafeHttpUrl(settings.youtube_url) && (
                <a
                  href={settings.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="p-2 rounded-lg bg-white/5 hover:bg-[#4C8C3B] text-white transition-colors"
                >
                  <Youtube className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="font-sans text-sm font-bold text-white">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#top" className="hover:text-white transition-colors">
                  Home
                </a>
              </li>
              <li>
                <a href="#collection" className="hover:text-white transition-colors">
                  Coffee Collection
                </a>
              </li>
              <li>
                <a href="#our-coffee" className="hover:text-white transition-colors">
                  Brazilian Origins
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateTrack}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Track Your Order
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onNavigateAdmin}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Admin Console
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-5 space-y-3">
            <h3 className="font-sans text-sm font-bold text-white">Contact & Support</h3>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#7CC267] shrink-0 mt-0.5" />
                <span>{settings.address}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#7CC267] shrink-0" />
                <span className="font-mono-tabular">{settings.phone}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#7CC267] shrink-0" />
                <span>{settings.email}</span>
              </li>
            </ul>

            <div className="pt-2">
              <a
                href={buildWhatsAppClickToChatUrl(
                  settings.whatsapp_number,
                  `Hello ${settings.brand_name}, I would like to inquire about your Brazilian coffee.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4C8C3B] hover:bg-[#3D732E] text-white text-xs font-semibold transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Order Support on WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Copyright Row */}
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-[#9E9585]">
            <p>{settings.footer_copyright}</p>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="hover:text-white cursor-pointer"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="hover:text-white cursor-pointer"
              >
                Terms & Conditions
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Privacy & Terms Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E2D9C8] p-6 space-y-4">
            <h3 className="font-display text-xl font-bold text-[#1B1714]">
              {legalModal === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
            </h3>
            <p className="text-sm text-[#4A433C] leading-relaxed">
              {legalModal === 'privacy'
                ? `${settings.brand_name} collects only the customer details required to fulfill your coffee delivery across Bangladesh (name, mobile number, WhatsApp number, and delivery address). We never sell or share customer phone numbers with third parties.`
                : `All coffee orders placed through ${settings.brand_name} are payable via Cash on Delivery (COD) in BDT unless otherwise specified. Standard delivery takes 24–48 hours inside Dhaka Metro and 2–5 days nationwide.`}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 rounded-lg bg-[#1B1714] text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
