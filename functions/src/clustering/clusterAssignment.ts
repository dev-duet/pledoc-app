import * as admin from "firebase-admin";
import { CLUSTER_CONFIG } from "./config";
import { embedText } from "./geminiEmbeddings";
import { fetchCandidateClusters, createClusterAndAssign, joinClusterAndAssign } from "./firestoreClusterOps";
import { cosineSimilarity } from "./similarity";
import { ComplaintForClustering } from "./types";

/**
 * Assigns one complaint to a cluster — either joining an existing one that's
 * similar enough, or creating a new one. This is the two-step process from
 * the brief:
 *   1. Cheap bucket pass: only clusters sharing category + geo bucket are
 *      even considered (fetchCandidateClusters).
 *   2. Finer pass: embedding similarity on issue_summary decides which of
 *      those candidates (if any) this complaint actually belongs to.
 */
export async function assignComplaintToCluster(
  db: admin.firestore.Firestore,
  complaint: ComplaintForClustering
): Promise<{ action: "joined" | "created"; clusterId: string }> {
  const embedding = await embedText(complaint.issue_summary);

  const candidates = await fetchCandidateClusters(db, complaint.category, complaint.location);

  let bestMatch: { id: string; similarity: number } | null = null;
  for (const candidate of candidates) {
    const similarity = cosineSimilarity(embedding, candidate.embedding);
    if (similarity >= CLUSTER_CONFIG.SIMILARITY_THRESHOLD) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { id: candidate.id, similarity };
      }
    }
  }

  if (bestMatch) {
    await joinClusterAndAssign(db, complaint.id, bestMatch.id, embedding);
    return { action: "joined", clusterId: bestMatch.id };
  }

  const newClusterId = await createClusterAndAssign(
    db,
    complaint.id,
    complaint.category,
    complaint.location,
    complaint.country ?? "Unknown",
    embedding
  );
  return { action: "created", clusterId: newClusterId };
}
