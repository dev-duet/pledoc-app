import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, AlertCircle, FileText, MapPin, Tag } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { getComplaintById } from '@/lib/data';
import { getCategoryLabel } from '@/lib/translations';
import { StatusBadge } from '@/components/StatusBadge';
import type { Complaint } from '@/lib/types';

export function StatusPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [loading, setLoading] = useState(false);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);

  const lookup = async () => {
    if (!id.trim()) return;
    setLoading(true);
    setSearched(true);
    setError(false);
    setComplaint(null);
    try {
      const result = await getComplaintById(id.trim());
      if (result) {
        setComplaint(result);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'needs_review': return t.statusNeedsReview;
      case 'verified': return t.statusVerified;
      case 'invalid': return t.statusInvalid;
      default: return status;
    }
  };

  const isReviewed = complaint && (complaint.verification_status === 'verified' || complaint.verification_status === 'invalid');

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <button
        onClick={() => navigate('/home')}
        className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        {t.backHome}
      </button>

      <h1 className="text-2xl font-bold text-ink-900 mb-1">{t.statusTitle}</h1>
      <p className="text-ink-400 text-sm mb-6">{t.statusSub}</p>

      {/* Search */}
      <div className="card p-5 mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
            placeholder={t.enterComplaintId}
            className="input"
          />
          <button
            onClick={lookup}
            disabled={!id.trim() || loading}
            className="btn btn-citizen flex-shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t.lookup}</span>
          </button>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="card p-8 text-center">
          <Loader2 className="w-8 h-8 text-citizen-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-ink-400">{t.loading}</p>
        </div>
      )}

      {!loading && searched && error && (
        <div className="card p-8 text-center animate-fade-in">
          <AlertCircle className="w-10 h-10 text-ink-400 mx-auto mb-3" />
          <p className="text-sm text-ink-500">{t.notFound}</p>
        </div>
      )}

      {!loading && !searched && (
        <div className="card p-8 text-center">
          <Search className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <p className="text-sm text-ink-400">{t.enterIdPrompt}</p>
        </div>
      )}

      {!loading && complaint && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Reviewed banner */}
          {isReviewed && (
            <div className={`flex items-center gap-2.5 p-4 rounded-xl font-medium text-sm ${
              complaint.verification_status === 'verified'
                ? 'bg-citizen-100 text-citizen-700'
                : 'bg-ink-100 text-ink-600'
            }`}>
              {complaint.verification_status === 'verified' ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 flex-shrink-0" />
              )}
              {t.reviewedBanner}
            </div>
          )}

          {/* Status card */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm text-ink-400">{t.yourComplaintId}</span>
              <StatusBadge status={complaint.verification_status} />
            </div>

            <code className="block text-lg font-bold text-ink-900 bg-cream-200 px-3 py-2 rounded-lg mb-5 break-all">
              {complaint.id}
            </code>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Tag className="w-4 h-4 text-ink-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-ink-400">{t.category}: </span>
                  <span className="font-medium text-ink-800">{getCategoryLabel(complaint.category, language)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-ink-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-ink-400">{t.locationBucket}: </span>
                  <span className="font-medium text-ink-800">{complaint.location}</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-ink-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-ink-400">{t.description}: </span>
                  <span className="font-medium text-ink-800">{complaint.issue_summary}</span>
                </div>
              </div>
            </div>

            {/* Priority score */}
            <div className="mt-5 pt-5 border-t border-cream-300/60">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-700">{t.priorityScore}</span>
                <span className="text-2xl font-bold text-decision-700">
                  {complaint.priority_score}
                </span>
              </div>
            </div>

            {/* Status text */}
            <div className="mt-4 p-3 rounded-xl bg-cream-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-data-700" />
              <span className="text-sm font-medium text-ink-700">
                {statusLabel(complaint.verification_status)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
