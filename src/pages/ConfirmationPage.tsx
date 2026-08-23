import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, Check, Search, Home, Users } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { countSimilarComplaints } from '@/lib/data';

interface LastComplaint {
  id: string;
  category: string;
  location: string;
}

export function ConfirmationPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [similarCount, setSimilarCount] = useState<number | null>(null);
  const [complaint, setComplaint] = useState<LastComplaint | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('pledoc_last_complaint');
    if (!raw) {
      navigate('/home');
      return;
    }
    const data = JSON.parse(raw) as LastComplaint;
    setComplaint(data);

    // Query similar complaints for immediate feedback
    // NOTE: This is a rough, approximate signal. The authoritative cluster count
    // comes from the backend's embedding-based clustering — not this client-side query.
    countSimilarComplaints(data.category, data.location, data.id).then((count) => {
      setSimilarCount(count);
    });
  }, [navigate]);

  const copyId = () => {
    if (!complaint) return;
    navigator.clipboard.writeText(complaint.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!complaint) return null;

  return (
    <div className="max-w-lg mx-auto animate-fade-in-up text-center">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-full bg-data-100 flex items-center justify-center mx-auto mb-6 animate-scale-in">
        <CheckCircle2 className="w-11 h-11 text-data-700" />
      </div>

      <h1 className="text-2xl font-bold text-ink-900 mb-2">{t.confirmationTitle}</h1>

      {/* Similar reports signal */}
      {similarCount !== null && similarCount > 0 && (
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-citizen-100 text-citizen-700 text-sm font-medium mb-6 animate-fade-in">
          <Users className="w-4 h-4" />
          <span>
            {similarCount} {similarCount === 1 ? t.similarReportsSingular : t.similarReports}
          </span>
        </div>
      )}

      {/* Complaint ID card */}
      <div className="card p-6 mb-6">
        <p className="text-sm text-ink-400 mb-3">{t.yourComplaintId}</p>
        <div className="flex items-center gap-2 justify-center">
          <code className="text-xl sm:text-2xl font-bold text-ink-900 bg-cream-200 px-4 py-2.5 rounded-xl break-all">
            {complaint.id}
          </code>
          <button
            onClick={copyId}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-citizen-600 text-white flex items-center justify-center hover:bg-citizen-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        {copied && (
          <p className="text-xs text-data-700 mt-2 animate-fade-in">{t.copied}</p>
        )}
        <p className="text-sm text-ink-500 mt-4 leading-relaxed">{t.saveIdMessage}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate('/status')}
          className="btn btn-decision flex-1"
        >
          <Search className="w-4 h-4" />
          {t.checkStatusBtn}
        </button>
        <button
          onClick={() => navigate('/home')}
          className="btn btn-outline flex-1"
        >
          <Home className="w-4 h-4" />
          {t.backHome}
        </button>
      </div>
    </div>
  );
}
