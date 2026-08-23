import { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { LANGUAGES } from '@/lib/types';
import type { LanguageCode } from '@/lib/types';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = LANGUAGES.find((l) => l.code === language);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100 border border-cream-300/60 hover:bg-cream-200 transition-colors text-sm font-medium text-ink-700"
      >
        <Globe className="w-4 h-4 text-citizen-600" />
        <span className="hidden sm:inline">{current?.nativeName}</span>
        <span className="sm:hidden">{current?.flag}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-surface-50 rounded-xl shadow-soft-lg border border-cream-300/80 py-1.5 z-50 animate-slide-down">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code as LanguageCode);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-cream-200 ${
                language === lang.code ? 'bg-cream-200/50' : ''
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <div className="flex-1 text-left">
                <div className="font-medium text-ink-800">{lang.nativeName}</div>
                <div className="text-xs text-ink-400">{lang.englishName}</div>
              </div>
              {language === lang.code && (
                <Check className="w-4 h-4 text-citizen-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
