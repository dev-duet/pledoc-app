import * as admin from "firebase-admin";
import { CLUSTER_CONFIG } from "./config";
import { ClusterCandidate } from "./types";
import { normalizeLocation } from "./bucketing";
import { updateCentroid } from "./similarity";
import { VerificationStatus } from "../geoVerification/types";

/**
 * Fetches existing clusters that share this complaint's category + geo
 * bucket — the "cheap first pass" from the brief. Only these candidates
 * get compared via embedding similarity; clusters in other buckets are
 * never touched, which is what keeps this affordable at scale.
 */
export async function fetchCandidateClusters(
  db: admin.firestore.Firestore,
  category: string,
  location: string
): Promise<ClusterCandidate[]> {
  const snap = await db
    .collection("clusters")
    .where("category", "==", category)
    .where("location_bucket", "==", normalizeLocation(location))
    .limit(CLUSTER_CONFIG.MAX_CANDIDATE_CLUSTERS_PER_BUCKET)
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as ClusterCandidate))
    .filter((c) => Array.isArray(c.embedding) && c.embedding.length > 0);
}

/**
 * Creates a brand-new cluster for a complaint that didn't match any
 * existing one closely enough, and links the complaint to it — done in a
 * transaction so the cluster creation and the complaint's cluster_id
 * update either both happen or neither does.
 */
export async function createClusterAndAssign(
  db: admin.firestore.Firestore,
  complaintId: string,
  category: string,
  location: string,
  country: string,
  embedding: number[]
): Promise<string> {
  const clusterRef = db.collection("clusters").doc();

  await db.runTransaction(async (tx) => {
    tx.set(clusterRef, {
      category,
      location_bucket: normalizeLocation(location),
      count: 1,
      verification_status: "needs_review",
      priority_score: 0,
      country,
      embedding,
    });
    tx.update(db.collection("complaints").doc(complaintId), {
      cluster_id: clusterRef.id,
    });
  });

  return clusterRef.id;
}

/**
 * Joins a complaint to an existing cluster: increments count, updates the
 * running centroid embedding, and links the complaint. Also in a
 * transaction, re-reading the cluster's current count/embedding fresh at
 * write time to avoid clobbering a concurrent update from another complaint
 * landing in the same bucket at nearly the same moment.
 *
 * IMPORTANT: if the cluster has already been resolved (verified/invalid)
 * before this complaint joins, geoVerification's watcher will NOT notice —
 * its query only watches clusters still at needs_review. So this function
 * stamps the joining complaint with the cluster's current status/score
 * directly, right here, rather than relying on the watcher to catch it.
 */
export async function joinClusterAndAssign(
  db: admin.firestore.Firestore,
  complaintId: string,
  clusterId: string,
  newEmbedding: number[]
): Promise<void> {
  const clusterRef = db.collection("clusters").doc(clusterId);

  await db.runTransaction(async (tx) => {
    const clusterDoc = await tx.get(clusterRef);
    if (!clusterDoc.exists) {
      throw new Error(`Cluster ${clusterId} disappeared before join could complete.`);
    }

    const data = clusterDoc.data()!;
    const currentCount = data.count ?? 0;
    const currentEmbedding: number[] = data.embedding ?? newEmbedding;
    const currentStatus: VerificationStatus = data.verification_status ?? "needs_review";
    const currentPriorityScore: number = data.priority_score ?? 0;

    const updatedEmbedding = updateCentroid(currentEmbedding, currentCount, newEmbedding);

    tx.update(clusterRef, {
      count: currentCount + 1,
      embedding: updatedEmbedding,
    });

    const complaintUpdate: Record<string, unknown> = { cluster_id: clusterId };
    if (currentStatus !== "needs_review") {
      complaintUpdate.verification_status = currentStatus;
      complaintUpdate.priority_score = currentPriorityScore;
    }

    tx.update(db.collection("complaints").doc(complaintId), complaintUpdate);
  });
}