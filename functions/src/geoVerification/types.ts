export type VerificationStatus = "needs_review" | "verified" | "invalid";

export interface Complaint {
  id: string;
  category: string;
  location: string;
  /**
   * Optional extra location detail Gemini extracted from the citizen's
   * transcript that wasn't already captured by the structured Country/
   * State/District dropdowns (e.g. a specific street or landmark). Null on
   * many docs — when present, it sharpens geocoding precision.
   */
  location_detail?: string | null;
  issue_summary: string;
  transcript?: string;
  language?: string;
  pseudonymous_id?: string;
  verification_status: VerificationStatus;
  priority_score?: number;
  cluster_id: string | null;
  created_at: FirebaseFirestore.Timestamp;
}

export interface Cluster {
  id: string;
  category: string;
  location_bucket: string;
  count: number;
  verification_status: VerificationStatus;
  priority_score?: number;
  country: string;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface OverpassFacilityResult {
  /** Number of matching facilities found within the queried radius. */
  facilityCount: number;
  /** Raw element ids, kept for debugging/audit trail. */
  elementIds: number[];
}

export interface SecondarySourceResult {
  /** Whether the secondary source was available/queryable for this location+category. */
  available: boolean;
  /** true = corroborates the complaint (gap confirmed), false = contradicts it, null = inconclusive. */
  corroborates: boolean | null;
  source: string;
}

export interface GeoVerificationDecision {
  status: VerificationStatus;
  /** 0 (no gap evidence) to 1 (strong gap evidence) — feeds directly into priority_score. */
  infra_gap_severity: number;
  /** Human-readable trail of which rule fired, for the policymaker dashboard / debugging. */
  reasoning: string;
}
