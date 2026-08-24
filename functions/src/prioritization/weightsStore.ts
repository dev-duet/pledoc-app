import * as admin from "firebase-admin";
import { DEFAULT_WEIGHTS, WEIGHTS_DOC_PATH } from "./config";
import { PriorityWeights } from "./types";

/**
 * Reads the current w1/w2/w3 weights from Firestore. Falls back to
 * DEFAULT_WEIGHTS if the config doc doesn't exist yet (e.g. first run,
 * before any policymaker has touched the settings) or if it's malformed —
 * a broken weights doc should never crash scoring, just fall back safely.
 */
export async function getWeights(db: admin.firestore.Firestore): Promise<PriorityWeights> {
  try {
    const snap = await db.collection(WEIGHTS_DOC_PATH.collection).doc(WEIGHTS_DOC_PATH.doc).get();
    if (!snap.exists) return { ...DEFAULT_WEIGHTS };

    const data = snap.data()!;
    const { w1, w2, w3 } = data;

    if (typeof w1 !== "number" || typeof w2 !== "number" || typeof w3 !== "number") {
      console.warn("[prioritization] priorityWeights doc has invalid/missing fields — using defaults.");
      return { ...DEFAULT_WEIGHTS };
    }

    return { w1, w2, w3 };
  } catch (err) {
    console.error("[prioritization] Failed to read priorityWeights — using defaults.", err);
    return { ...DEFAULT_WEIGHTS };
  }
}

/**
 * Sets new weights — this is what a policymaker dashboard's "adjust
 * weights" control would call. Validates inputs are non-negative finite
 * numbers before writing; does NOT force w1+w2+w3 to sum to 1, since the
 * brief doesn't require that and forcing it would surprise a policymaker
 * who just wants to nudge one weight up.
 */
export async function setWeights(
  db: admin.firestore.Firestore,
  weights: PriorityWeights
): Promise<void> {
  for (const [key, value] of Object.entries(weights)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid weight "${key}": ${value}. Weights must be non-negative finite numbers.`);
    }
  }

  await db
    .collection(WEIGHTS_DOC_PATH.collection)
    .doc(WEIGHTS_DOC_PATH.doc)
    .set(weights, { merge: true });
}
