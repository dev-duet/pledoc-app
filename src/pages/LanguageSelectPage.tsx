import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { LANGUAGES } from '@/lib/types';
import type { LanguageCode } from '@/lib/types';
import { getTranslation } from '@/lib/translations';

export function LanguageSelectPage() {
  const navigate = useNavigate();
  const t = getTranslation('en');

  const primary = LANGUAGES.filter((l) => l.primary);
  const secondary = LANGUAGES.filter((l) => !l.primary);

  const selectLanguage = (code: LanguageCode) => {
    localStorage.setItem('pledoc_language', code);
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-citizen-600 flex items-center justify-center shadow-soft-lg mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-ink-900">{t.appName}</h1>
          <p className="text-ink-400 mt-1.5 text-sm">{t.tagline}</p>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-ink-800">{t.chooseLanguage}</h2>
          <p className="text-ink-400 text-sm mt-1">{t.chooseLanguageSub}</p>
        </div>

        {/* Primary languages grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {primary.map((lang) => (
            <button
              key={lang.code}
              onClick={() => selectLanguage(lang.code)}
              className="group card card-hover p-5 flex flex-col items-center text-center hover:border-citizen-400 hover:shadow-soft-md transition-all"
            >
              <span className="text-4xl mb-2.5 group-hover:scale-110 transition-transform">{lang.flag}</span>
              <span className="font-semibold text-ink-900 text-base">{lang.nativeName}</span>
              <span className="text-xs text-ink-400 mt-0.5">{lang.englishName}</span>
              <ArrowRight className="w-4 h-4 text-citizen-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>

        {/* Secondary languages */}
        <div className="pt-6 border-t border-cream-300/60">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-3 text-center">
            {t.otherLanguages}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {secondary.map((lang) => (
              <button
                key={lang.code}
                onClick={() => selectLanguage(lang.code)}
                className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-100 border border-cream-300/60 hover:border-citizen-300 hover:bg-cream-200 transition-all"
              >
                <span className="text-xl">{lang.flag}</span>
                <span className="font-medium text-ink-700 text-sm">{lang.nativeName}</span>
                <span className="text-xs text-ink-400 hidden sm:inline">{lang.englishName}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
