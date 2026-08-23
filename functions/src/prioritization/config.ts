/**
 * Default weights, used only until a policymaker sets their own via the
 * dashboard (or until the config doc is created). These are NOT meant to be
 * the final word — per the brief, w1/w2/w3 must be adjustable by
 * policymakers, not hardcoded constants baked into the scoring logic.
 */
export const DEFAULT_WEIGHTS = {
  w1: 0.5, // volume × verification_multiplier
  w2: 0.35, // infra_gap_severity
  w3: 0.15, // demographic_weight
} as const;

/**
 * Single Firestore doc a policymaker dashboard reads/writes to adjust
 * weights live. Using a fixed, well-known path (rather than per-country or
 * per-category weight sets) keeps this simple for the hackathon prototype;
 * if you need per-country tuning later, this is the one place to change —
 * everything else here reads weights through weightsStore.ts, not this
 * constant directly.
 */
export const WEIGHTS_DOC_PATH = { collection: "config", doc: "priorityWeights" } as const;

export const VERIFICATION_MULTIPLIER: Record<string, number> = {
  verified: 1.0,
  needs_review: 0.5,
  invalid: 0,
};
