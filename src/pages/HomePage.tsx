import { Link } from 'react-router-dom';
import { FileText, Search, ArrowRight, ShieldCheck, Globe2, Zap, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-citizen-100 text-citizen-700 text-xs font-semibold mb-5">
          <Globe2 className="w-3.5 h-3.5" />
          BRICS Nations
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-ink-900 mb-3 leading-tight">
          {t.welcomeTitle}
        </h1>
        <p className="text-ink-500 text-base sm:text-lg leading-relaxed">
          {t.welcomeSub}
        </p>
      </div>

      {/* CTAs */}
      <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-12">
        <Link
          to="/report"
          className="group card card-hover p-8 flex flex-col items-start hover:border-citizen-400 transition-all"
        >
          <div className="w-14 h-14 rounded-2xl bg-citizen-600 flex items-center justify-center shadow-soft mb-4 group-hover:scale-105 transition-transform">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 mb-1.5">{t.reportIssue}</h2>
          <p className="text-sm text-ink-500 leading-relaxed mb-4">
            {t.homeDesc}
          </p>
          <span className="inline-flex items-center gap-1.5 text-citizen-600 font-semibold text-sm group-hover:gap-2.5 transition-all">
            {t.reportIssue}
            <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link
          to="/status"
          className="group card card-hover p-8 flex flex-col items-start hover:border-decision-400 transition-all"
        >
          <div className="w-14 h-14 rounded-2xl bg-decision-700 flex items-center justify-center shadow-soft mb-4 group-hover:scale-105 transition-transform">
            <Search className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-ink-900 mb-1.5">{t.checkStatus}</h2>
          <p className="text-sm text-ink-500 leading-relaxed mb-4">
            {t.saveIdMessage}
          </p>
          <span className="inline-flex items-center gap-1.5 text-decision-700 font-semibold text-sm group-hover:gap-2.5 transition-all">
            {t.checkStatus}
            <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
        <div className="card p-5 text-center">
          <div className="w-10 h-10 rounded-xl bg-citizen-100 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-5 h-5 text-citizen-600" />
          </div>
          <h3 className="font-semibold text-ink-800 text-sm mb-1">Pseudonymous</h3>
          <p className="text-xs text-ink-400 leading-relaxed">Report issues without revealing your identity</p>
        </div>
        <div className="card p-5 text-center">
          <div className="w-10 h-10 rounded-xl bg-data-100 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-5 h-5 text-data-700" />
          </div>
          <h3 className="font-semibold text-ink-800 text-sm mb-1">Voice & Text</h3>
          <p className="text-xs text-ink-400 leading-relaxed">Submit reports by typing or speaking in your language</p>
        </div>
        <div className="card p-5 text-center">
          <div className="w-10 h-10 rounded-xl bg-decision-100 flex items-center justify-center mx-auto mb-3">
            <TrendingUp className="w-5 h-5 text-decision-700" />
          </div>
          <h3 className="font-semibold text-ink-800 text-sm mb-1">Tracked</h3>
          <p className="text-xs text-ink-400 leading-relaxed">Follow your report from submission to resolution</p>
        </div>
      </div>
    </div>
  );
}
