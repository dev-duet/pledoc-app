import { useState, useEffect, useCallback } from 'react';
import {
  Layers, Globe, Filter, ChevronDown, ChevronUp, Check, X,
  Loader2, Database, TrendingUp, MapPin, AlertCircle, ArrowLeft, FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getClusters, getComplaintsByClusterId, updateClusterVerification, updateComplaintsByCluster, seedDemoData } from '@/lib/data';
import { getTranslation } from '@/lib/translations';
import { CATEGORIES } from '@/lib/types';
import type { Cluster, Complaint, VerificationStatus } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';

// Dashboard stays in English per architecture doc
const t = getTranslation('en');

type SortBy = 'priority' | 'category' | 'status';

export function DashboardPage() {
  const navigate = useNavigate();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewAll, setViewAll] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortBy>('priority');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [linkedComplaints, setLinkedComplaints] = useState<Record<string, Complaint[]>>({});
  const [loadingComplaints, setLoadingComplaints] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState(false);

  const loadClusters = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClusters();
      setClusters(data);
    } catch {
      setClusters([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadClusters();
  }, [loadClusters]);

  const countries = Array.from(new Set(clusters.map((c) => c.country))).sort();

  let filtered = clusters;
  if (!viewAll && selectedCountry) {
    filtered = filtered.filter((c) => c.country === selectedCountry);
  }
  if (filterCategory) {
    filtered = filtered.filter((c) => c.category === filterCategory);
  }
  if (filterStatus) {
    filtered = filtered.filter((c) => c.verification_status === filterStatus);
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'priority') return b.priority_score - a.priority_score;
    if (sortBy === 'category') return a.category.localeCompare(b.category);
    if (sortBy === 'status') {
      const order: Record<string, number> = { needs_review: 0, verified: 1, invalid: 2 };
      return order[a.verification_status] - order[b.verification_status];
    }
    return 0;
  });

  const expandCluster = async (clusterId: string) => {
    if (expandedCluster === clusterId) {
      setExpandedCluster(null);
      return;
    }
    setExpandedCluster(clusterId);
    if (!linkedComplaints[clusterId]) {
      setLoadingComplaints(clusterId);
      try {
        const complaints = await getComplaintsByClusterId(clusterId);
        setLinkedComplaints((prev) => ({ ...prev, [clusterId]: complaints }));
      } catch {
        setLinkedComplaints((prev) => ({ ...prev, [clusterId]: [] }));
      }
      setLoadingComplaints(null);
    }
  };

  const handleVerify = async (cluster: Cluster, status: VerificationStatus) => {
    // Optimistic UI update
    setClusters((prev) =>
      prev.map((c) =>
        c.id === cluster.id
          ? { ...c, verification_status: status }
          : c
      )
    );

    // Update cluster in Firestore
    await updateClusterVerification(cluster.id, status, cluster.priority_score);

    // CASCADE: update all linked complaints with the cluster's verification_status
    // and priority_score — this is what lets citizens see their complaint resolved
    await updateComplaintsByCluster(cluster.id, status, cluster.priority_score);

    // Update cached linked complaints too
    if (linkedComplaints[cluster.id]) {
      setLinkedComplaints((prev) => ({
        ...prev,
        [cluster.id]: prev[cluster.id].map((c) => ({
          ...c,
          verification_status: status,
          priority_score: cluster.priority_score,
        })),
      }));
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDemoData();
      await loadClusters();
      setSeedMessage(true);
      setTimeout(() => setSeedMessage(false), 3000);
    } catch {
      // ignore
    }
    setSeeding(false);
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Back link */}
      <button
        onClick={() => navigate('/home')}
        className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-700 transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        {t.backHome}
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-decision-700" />
            {t.dashboardTitle}
          </h1>
          <p className="text-ink-400 text-sm mt-1">{t.dashboardSub}</p>
        </div>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="btn btn-outline flex-shrink-0"
        >
          {seeding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Database className="w-4 h-4" />
          )}
          {t.loadDemoData}
        </button>
      </div>

      {seedMessage && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-data-100 text-data-800 text-sm font-medium mb-4 animate-fade-in">
          <Check className="w-4 h-4" />
          {t.demoLoaded}
        </div>
      )}

      {/* Controls */}
      <div className="card p-4 mb-6 space-y-4">
        {/* View toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2 p-1 bg-cream-200 rounded-xl">
            <button
              onClick={() => setViewAll(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                viewAll ? 'bg-surface-50 text-ink-800 shadow-soft' : 'text-ink-500'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              {t.viewAllCountries}
            </button>
            <button
              onClick={() => setViewAll(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                !viewAll ? 'bg-surface-50 text-ink-800 shadow-soft' : 'text-ink-500'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {t.viewByCountry}
            </button>
          </div>

          {!viewAll && (
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="input max-w-[200px]"
            >
              <option value="">Select country</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Sort & Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-ink-400" />
            <span className="text-sm text-ink-500 font-medium">{t.sortBy}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="input max-w-[180px] py-2 text-sm"
            >
              <option value="priority">{t.sortPriority}</option>
              <option value="category">{t.sortCategory}</option>
              <option value="status">{t.sortStatus}</option>
            </select>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input max-w-[150px] py-2 text-sm"
          >
            <option value="">{t.allCategories}</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input max-w-[150px] py-2 text-sm"
          >
            <option value="">{t.allStatuses}</option>
            <option value="needs_review">{t.statusNeedsReview}</option>
            <option value="verified">{t.statusVerified}</option>
            <option value="invalid">{t.statusInvalid}</option>
          </select>
        </div>
      </div>

      {/* Clusters */}
      {loading ? (
        <div className="card p-12 text-center">
          <Loader2 className="w-8 h-8 text-decision-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-ink-400">{t.loading}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <AlertCircle className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <p className="text-sm text-ink-400">{t.noClusters}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cluster) => (
            <div key={cluster.id} className="card overflow-hidden animate-fade-in-up">
              {/* Cluster header */}
              <button
                onClick={() => expandCluster(cluster.id)}
                className="w-full p-5 flex items-center gap-4 text-left hover:bg-cream-200/50 transition-colors"
              >
                {/* Category icon */}
                <div className="w-11 h-11 rounded-xl bg-decision-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xl font-bold text-decision-700">
                    {cluster.category.charAt(0)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-ink-900">{cluster.category}</h3>
                    <StatusBadge status={cluster.verification_status} size="sm" />
                  </div>
                  <p className="text-sm text-ink-400 mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {cluster.location_bucket}
                    <span className="text-ink-300">·</span>
                    {cluster.country}
                  </p>
                </div>

                {/* Count + Priority */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <div className="text-lg font-bold text-ink-900">{cluster.count}</div>
                    <div className="text-xs text-ink-400">{t.count}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-decision-700">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="text-lg font-bold">{cluster.priority_score}</span>
                    </div>
                    <div className="text-xs text-ink-400">{t.priorityScore}</div>
                  </div>
                  {expandedCluster === cluster.id ? (
                    <ChevronUp className="w-5 h-5 text-ink-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-ink-400" />
                  )}
                </div>
              </button>

              {/* Expanded view */}
              {expandedCluster === cluster.id && (
                <div className="border-t border-cream-300/60 p-5 bg-cream-200/30 animate-slide-down">
                  {/* Action buttons for needs_review clusters */}
                  {cluster.verification_status === 'needs_review' && (
                    <div className="flex gap-3 mb-4">
                      <button
                        onClick={() => handleVerify(cluster, 'verified')}
                        className="btn btn-citizen flex-1"
                      >
                        <Check className="w-4 h-4" />
                        {t.verify}
                      </button>
                      <button
                        onClick={() => handleVerify(cluster, 'invalid')}
                        className="btn btn-outline flex-1"
                      >
                        <X className="w-4 h-4" />
                        {t.markInvalid}
                      </button>
                    </div>
                  )}

                  {/* Linked complaints */}
                  <div>
                    <p className="text-sm font-semibold text-ink-700 mb-3 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-ink-400" />
                      {t.linkedComplaints}
                    </p>
                    {loadingComplaints === cluster.id ? (
                      <div className="flex items-center gap-2 text-sm text-ink-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t.loading}
                      </div>
                    ) : linkedComplaints[cluster.id] && linkedComplaints[cluster.id].length > 0 ? (
                      <div className="space-y-2">
                        {linkedComplaints[cluster.id].map((c) => (
                          <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-50 border border-cream-300/60">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink-800 truncate">{c.issue_summary}</p>
                              <p className="text-xs text-ink-400 mt-0.5">
                                {c.location} · {c.language} · {c.pseudonymous_id}
                              </p>
                            </div>
                            <StatusBadge status={c.verification_status} size="sm" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-400">No linked complaints found.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
