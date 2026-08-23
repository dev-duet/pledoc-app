/**
 * Minimal version of the priority scoring formula, just enough to feed
 * cascade.ts a real number when a cluster is auto-resolved. The full
 * scoring system (tunable w1/w2/w3 exposed to policymakers, demographic_weight
 * from public data) is item 3 in the brief — build that out as its own
 * module and swap the WEIGHTS constant below for whatever storage/UI you
 * land on (e.g. a `config/priorityWeights` Firestore doc the dashboard can edit).
 */

export const WEIGHTS = {
  w1: 0.5, // volume × verification_multiplier
  w2: 0.35, // infra_gap_severity
  w3: 0.15, // demographic_weight
} as const;

const VERIFICATION_MULTIPLIER: Record<string, number> = {
  verified: 1.0,
  needs_review: 0.5,
  invalid: 0,
};

export function computePriorityScore(params: {
  volume: number;
  verificationStatus: "verified" | "needs_review" | "invalid";
  infraGapSeverity: number;
  /** Placeholder until the demographic data source is wired up — defaults to neutral. */
  demographicWeight?: number;
}): number {
  const { volume, verificationStatus, infraGapSeverity, demographicWeight = 0.5 } = params;
  const multiplier = VERIFICATION_MULTIPLIER[verificationStatus] ?? 0;

  return (
    WEIGHTS.w1 * (volume * multiplier) +
    WEIGHTS.w2 * infraGapSeverity +
    WEIGHTS.w3 * demographicWeight
  );
}
