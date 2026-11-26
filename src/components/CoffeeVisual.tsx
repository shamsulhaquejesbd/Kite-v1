import { useState } from 'react';
import { Coffee } from 'lucide-react';

interface CoffeeVisualProps {
  src?: string | null;
  alt: string;
  variant?: 'hero' | 'pouch' | 'beans' | 'cup' | 'harvest' | 'avatar';
  label?: string;
  sublabel?: string;
  className?: string;
  imgClassName?: string;
}

/**
 * Renders uploaded photography from Supabase Storage / CMS cleanly with zero distortion,
 * and falls back to domain-authentic studio coffee vector compositions when no photo
 * has been uploaded yet (respecting Zero-Broken-Image policy).
 */
export function CoffeeVisual({
  src,
  alt,
  variant = 'pouch',
  label,
  sublabel,
  className = '',
  imgClassName = '',
}: CoffeeVisualProps) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`w-full h-full object-cover ${imgClassName}`}
        />
      </div>
    );
  }

  if (variant === 'avatar') {
    const initials = (alt || 'TK')
      .split(' ')
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('');
    return (
      <div
        className={`flex items-center justify-center bg-[#EBF3E8] text-[#2F5D23] font-semibold select-none ${className}`}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }

  if (variant === 'cup') {
    return (
      <div
        className={`relative flex items-center justify-center bg-gradient-to-br from-[#F7F4EE] via-[#EFEAE0] to-[#E5DEC9] overflow-hidden ${className}`}
        aria-label={alt}
      >
        <svg viewBox="0 0 260 260" className="w-4/5 h-4/5 drop-shadow-md" aria-hidden="true">
          <circle cx="130" cy="130" r="102" fill="#FFFFFF" stroke="#E5DEC9" strokeWidth="2" />
          <circle cx="130" cy="130" r="88" fill="#F9F7F3" />
          <circle cx="130" cy="130" r="62" fill="#FFFFFF" stroke="#D8CEBE" strokeWidth="3" />
          <circle cx="130" cy="130" r="52" fill="#2A1C15" />
          <ellipse cx="124" cy="122" rx="34" ry="26" fill="#5A3925" opacity="0.55" />
          <path d="M98 118 Q130 96 162 122" stroke="#C69563" strokeWidth="3" fill="none" opacity="0.65" />
          <rect x="188" y="122" width="22" height="16" rx="8" fill="#FFFFFF" stroke="#D8CEBE" strokeWidth="3" />
          {/* Botanical coffee leaves */}
          <path d="M46 72 C32 48 56 32 76 52 C68 68 58 76 46 72 Z" fill="#4C8C3B" opacity="0.88" />
          <path d="M196 196 C214 176 232 192 214 214 C202 212 194 206 196 196 Z" fill="#4C8C3B" opacity="0.88" />
          <ellipse cx="64" cy="194" rx="9" ry="6" transform="rotate(-28 64 194)" fill="#3C251B" />
          <ellipse cx="192" cy="58" rx="8" ry="5" transform="rotate(24 192 58)" fill="#3C251B" />
        </svg>
      </div>
    );
  }

  if (variant === 'beans' || variant === 'harvest') {
    return (
      <div
        className={`relative flex flex-col items-center justify-center bg-gradient-to-br from-[#231B16] via-[#1B1410] to-[#120D0A] text-[#F7F4EE] overflow-hidden ${className}`}
        aria-label={alt}
      >
        <svg viewBox="0 0 240 180" className="w-3/4 h-3/4 opacity-90" aria-hidden="true">
          <g transform="translate(88, 90) rotate(-18)">
            <ellipse cx="0" cy="0" rx="36" ry="24" fill="#5B3824" stroke="#8C5D3F" strokeWidth="1.5" />
            <path d="M-28 0 C-10 -8 10 8 28 0" stroke="#22140D" strokeWidth="3.5" fill="none" />
          </g>
          <g transform="translate(152, 86) rotate(22)">
            <ellipse cx="0" cy="0" rx="34" ry="22" fill="#472A1A" stroke="#7A4F35" strokeWidth="1.5" />
            <path d="M-26 0 C-8 7 8 -7 26 0" stroke="#1E110B" strokeWidth="3.5" fill="none" />
          </g>
          <path d="M120 44 C138 22 162 28 152 50 C142 54 128 52 120 44 Z" fill="#4C8C3B" />
          <path d="M114 48 C92 32 76 46 92 60 C102 58 110 54 114 48 Z" fill="#3D732E" />
        </svg>
        {label && (
          <span className="mt-1 text-xs font-medium tracking-wide text-[#D7CEBF] px-3 text-center">
            {label}
          </span>
        )}
      </div>
    );
  }

  // Default studio coffee pouch composition ('pouch' or 'hero')
  const isHero = variant === 'hero';
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden ${
        isHero
          ? 'bg-gradient-to-br from-[#231B16] via-[#1A1512] to-[#12100E] text-[#F7F4EE]'
          : 'bg-gradient-to-b from-[#F4EFE6] to-[#EAE2D3] text-[#1B1714]'
      } ${className}`}
      aria-label={alt}
    >
      {/* Subtle botanical leaf halo */}
      <div
        className={`absolute -right-8 -top-8 w-36 h-36 rounded-full blur-2xl ${
          isHero ? 'bg-[#4C8C3B]/20' : 'bg-[#4C8C3B]/10'
        }`}
      />
      <div className="relative flex flex-col items-center justify-center px-6 py-8">
        <div
          className={`relative w-32 h-44 rounded-xl border flex flex-col items-center justify-between py-4 px-3 shadow-sm ${
            isHero
              ? 'bg-[#1F1A17] border-white/15 text-[#F7F4EE]'
              : 'bg-[#DFD2BA] border-[#C5B496] text-[#1B1714]'
          }`}
        >
          <div className="w-full flex items-center justify-between text-[9px] tracking-[0.18em] uppercase opacity-70">
            <span>BRASIL</span>
            <span className="w-2 h-2 rounded-full bg-[#4C8C3B]" />
          </div>
          <div className="flex flex-col items-center text-center gap-1.5">
            <Coffee className={`w-6 h-6 ${isHero ? 'text-[#7CC267]' : 'text-[#3D732E]'}`} />
            <span className="font-display text-sm font-bold tracking-tight leading-tight">
              THE KITE
            </span>
            <span className="text-[10px] leading-tight opacity-75 line-clamp-2">
              {label || 'Single Origin'}
            </span>
          </div>
          <div className="w-full border-t border-current/15 pt-1.5 text-center text-[9px] font-mono-tabular opacity-70">
            {sublabel || '250g · 100% Arabica'}
          </div>
        </div>
      </div>
    </div>
  );
}
