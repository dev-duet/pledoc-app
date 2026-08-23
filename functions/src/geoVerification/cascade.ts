import * as admin from "firebase-admin";
import { VerificationStatus } from "./types";

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
  priorityScore: number
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
      batch.update(clusterRef, {
        verification_status: status,
        priority_score: priorityScore,
      });
    }

    for (const doc of chunk) {
      batch.update(doc.ref, {
        verification_status: status,
        priority_score: priorityScore,
      });
    }

    await batch.commit();
  }

  // If the cluster had zero complaints somehow linked yet, still write the
  // cluster doc itself.
  if (docs.length === 0) {
    await clusterRef.update({
      verification_status: status,
      priority_score: priorityScore,
    });
  }
}
