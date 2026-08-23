import * as admin from "firebase-admin";
import { VERIFICATION_MULTIPLIER } from "./config";
import { getWeights } from "./weightsStore";
import { computeDemographicWeight } from "./demographicWeight";
import { PriorityInputs } from "./types";

/**
 * Computes priority_score per the brief's formula:
 *
 *   priority_score = w1 × (volume × verification_multiplier)
 *                  + w2 × infra_gap_severity
 *                  + w3 × demographic_weight
 *
 * Reads w1/w2/w3 live from Firestore each time (via getWeights) rather than
 * using a hardcoded constant, so a policymaker adjusting weights on the
 * dashboard takes effect on the next score computation without a code
 * change or redeploy. Recompute this whenever a cluster's verification
 * status changes — see geoVerification/watcher.ts, which calls this exact
 * function after every auto-resolution decision.
 */
export async function computePriorityScore(
  db: admin.firestore.Firestore,
  inputs: PriorityInputs
): Promise<number> {
  const weights = await getWeights(db);
  const multiplier = VERIFICATION_MULTIPLIER[inputs.verificationStatus] ?? 0;
  const demographicWeight = await computeDemographicWeight(inputs.country, inputs.category);

  return (
    weights.w1 * (inputs.volume * multiplier) +
    weights.w2 * inputs.infraGapSeverity +
    weights.w3 * demographicWeight
  );
}

/**
 * Recalculates and writes priority_score for every cluster currently in
 * Firestore — call this after a policymaker changes w1/w2/w3, so existing
 * clusters reflect the new weights immediately rather than only affecting
 * scores computed after the change (per the brief: "Score should
 * recalculate whenever a cluster's status changes (live or on next
 * refresh)" — a weight change is exactly this kind of "next refresh").
 *
 * NOTE: this does NOT re-run geo-verification or re-cascade to complaints —
 * it only updates each cluster's priority_score in place using its current
 * count/status/infra_gap_severity. If you also want complaints to reflect
 * the new score, cascade it the same way geoVerification/cascade.ts does.
 */
export async function recalculateAllClusterPriorities(
  db: admin.firestore.Firestore
): Promise<{ updated: number; skipped: number }> {
  const weights = await getWeights(db);
  const clustersSnap = await db.collection("clusters").get();

  let updated = 0;
  let skipped = 0;

  const BATCH_LIMIT = 450;
  const docs = clustersSnap.docs;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_LIMIT);

    for (const doc of chunk) {
      const data = doc.data();
      const verificationStatus = data.verification_status;
      const infraGapSeverity = data.infra_gap_severity;

      if (
        (verificationStatus !== "verified" &&
          verificationStatus !== "needs_review" &&
          verificationStatus !== "invalid") ||
        typeof data.count !== "number"
      ) {
        skipped++;
        continue;
      }

      const multiplier = VERIFICATION_MULTIPLIER[verificationStatus] ?? 0;
      const demographicWeight = await computeDemographicWeight(
        data.country ?? "Unknown",
        data.category ?? "unknown"
      );

      // infra_gap_severity isn't currently stored on the cluster doc itself
      // (geoVerification computes it in-memory and doesn't persist it) — if
      // you want recalculation to use the real historical severity rather
      // than a neutral fallback, store infra_gap_severity on the cluster doc
      // in geoVerification/watcher.ts alongside priority_score.
      const severity = typeof infraGapSeverity === "number" ? infraGapSeverity : 0.5;

      const newScore =
        weights.w1 * (data.count * multiplier) +
        weights.w2 * severity +
        weights.w3 * demographicWeight;

      batch.update(doc.ref, { priority_score: newScore });
      updated++;
    }

    await batch.commit();
  }

  return { updated, skipped };
}
