import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '@/context/LanguageContext';

export function Header() {
  const { t } = useLanguage();
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';

  return (
    <header className="sticky top-0 z-40 bg-cream-100/80 backdrop-blur-md border-b border-cream-300/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link to="/home" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-citizen-600 flex items-center justify-center shadow-soft group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-ink-900 text-lg leading-none">{t.appName}</span>
            <span className="hidden sm:block text-xs text-ink-400 leading-tight mt-0.5">{t.tagline}</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {/* Dashboard stays in English — no language switcher needed there */}
          {!isDashboard && <LanguageSwitcher />}
        </div>
      </div>
    </header>
  );
}
