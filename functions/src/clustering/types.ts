export interface ComplaintForClustering {
  id: string;
  category: string;
  location: string;
  /**
   * Optional extra location detail from Gemini extraction (e.g. a specific
   * street/landmark not captured by the structured dropdowns). Not currently
   * used in the clustering similarity calculation (per the brief, clustering
   * is based on issue_summary) — carried through here so it's available if
   * you later want to factor it in, and so callers reading complaint docs
   * don't need two slightly different shapes for the same document.
   */
  location_detail?: string | null;
  issue_summary: string;
  country?: string;
  cluster_id: string | null;
}

export interface ClusterCandidate {
  id: string;
  category: string;
  location_bucket: string;
  count: number;
  country: string;
  /** Running centroid embedding for this cluster, used for similarity comparison against new complaints. */
  embedding: number[];
}
