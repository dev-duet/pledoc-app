import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-cream-300/60 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-ink-400">
          {t.appName} — {t.tagline}
        </p>
        <Link
          to="/dashboard"
          className="text-sm text-ink-500 hover:text-citizen-600 transition-colors font-medium"
        >
          {t.policymakerLogin}
        </Link>
      </div>
    </footer>
  );
}
