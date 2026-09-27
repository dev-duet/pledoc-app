import * as admin from "firebase-admin";
import { VERIFICATION_MULTIPLIER } from "./config";
import { getWeights } from "./weightsStore";
import { computeDemographicWeight } from "./demographicWeight";
import { PriorityInputs } from "./types";
import { cascadePriorityOnly } from "../geoVerification/cascade";

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
 * Recalculates priority_score for every cluster currently in Firestore —
 * call this after a policymaker changes w1/w2/w3, so existing clusters
 * (and their member complaints) reflect the new weights immediately rather
 * than only affecting scores computed after the change.
 *
 * Cascades each updated score down to member complaints via
 * cascadePriorityOnly (verification_status is left untouched — only the
 * score/severity change here). This trades the old grouped-batch approach
 * for one cascade call per cluster, which is fine for an admin-triggered
 * recalc rather than a hot path.
 */
export async function recalculateAllClusterPriorities(
  db: admin.firestore.Firestore
): Promise<{ updated: number; skipped: number }> {
  const weights = await getWeights(db);
  const clustersSnap = await db.collection("clusters").get();

  let updated = 0;
  let skipped = 0;

  for (const doc of clustersSnap.docs) {
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

    // infra_gap_severity is stored on the cluster doc by cascade.ts at
    // resolution time; fall back to a neutral 0.5 only if it's somehow
    // missing (e.g. a cluster that never got auto-resolved yet).
    const severity = typeof infraGapSeverity === "number" ? infraGapSeverity : 0.5;

    const newScore =
      weights.w1 * (data.count * multiplier) +
      weights.w2 * severity +
      weights.w3 * demographicWeight;

    await cascadePriorityOnly(db, doc.id, newScore, severity);
    updated++;
  }

  return { updated, skipped };
}