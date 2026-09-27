import * as admin from "firebase-admin";
import { VerificationStatus } from "./types";

interface ClusterFields {
  verification_status?: VerificationStatus;
  priority_score: number;
  infra_gap_severity: number;
}

interface ComplaintFields {
  verification_status?: VerificationStatus;
  priority_score: number;
}

/**
 * Shared batch-write logic: writes `clusterFields` to the cluster doc and
 * `complaintFields` to every complaint sharing that cluster_id. Both
 * applyClusterDecision and cascadePriorityOnly are thin wrappers around
 * this, so there's exactly one place that knows how to fan a cluster-level
 * change out to its complaints.
 */
async function cascadeToCluster(
  db: admin.firestore.Firestore,
  clusterId: string,
  clusterFields: ClusterFields,
  complaintFields: ComplaintFields
): Promise<void> {
  const clusterRef = db.collection("clusters").doc(clusterId);

  const complaintsSnap = await db
    .collection("complaints")
    .where("cluster_id", "==", clusterId)
    .get();

  // Firestore batches cap at 500 writes; chunk defensively in case a cluster
  // ever gets unexpectedly large.
  const BATCH_LIMIT = 450;
  const docs = complaintsSnap.docs;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_LIMIT);

    if (i === 0) {
      batch.update(clusterRef, clusterFields);
    }

    for (const doc of chunk) {
      batch.update(doc.ref, complaintFields);
    }

    await batch.commit();
  }

  // If the cluster had zero complaints somehow linked yet, still write the
  // cluster doc itself.
  if (docs.length === 0) {
    await clusterRef.update(clusterFields);
  }
}

/**
 * Writes the cluster's resolved status + priority_score to the cluster doc,
 * then cascades verification_status + priority_score to every complaint
 * sharing that cluster_id — same pattern the dashboard's manual Verify/
 * Invalid buttons already follow, so status-lookup pages stay accurate
 * regardless of whether resolution was manual or automatic.
 */
export async function applyClusterDecision(
  db: admin.firestore.Firestore,
  clusterId: string,
  status: VerificationStatus,
  priorityScore: number,
  infraGapSeverity: number
): Promise<void> {
  await cascadeToCluster(
    db,
    clusterId,
    { verification_status: status, priority_score: priorityScore, infra_gap_severity: infraGapSeverity },
    { verification_status: status, priority_score: priorityScore }
  );
}

/**
 * Cascades priority_score/infra_gap_severity to a cluster and its
 * complaints WITHOUT changing verification_status. Used when a cluster's
 * score changes but its status doesn't — e.g. it stays needs_review after
 * auto-resolution, or a policymaker adjusts w1/w2/w3 weights and every
 * cluster's score needs recomputing.
 */
export async function cascadePriorityOnly(
  db: admin.firestore.Firestore,
  clusterId: string,
  priorityScore: number,
  infraGapSeverity: number
): Promise<void> {
  await cascadeToCluster(
    db,
    clusterId,
    { priority_score: priorityScore, infra_gap_severity: infraGapSeverity },
    { priority_score: priorityScore }
  );
}