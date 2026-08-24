/**
 * SUPERSEDED — this file's logic moved to functions/src/prioritization/,
 * which implements the full brief item 3 (policymaker-tunable w1/w2/w3
 * weights read live from Firestore, plus a pluggable demographic_weight
 * source) instead of this module's hardcoded constants.
 *
 * geoVerification/watcher.ts now imports computePriorityScore from
 * "../prioritization/priorityCalculator" directly. This file is kept only
 * so nothing breaks if something still references it — nothing in the
 * current codebase does.
 */
export {};
