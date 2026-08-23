/**
 * Standard cosine similarity between two equal-length vectors. Returns a
 * value from -1 to 1; in practice, embedding similarities for related text
 * cluster close to 1, so the CLUSTER_CONFIG.SIMILARITY_THRESHOLD (~0.85)
 * from the brief is calibrated against that range.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Cannot compare embeddings of different lengths (${a.length} vs ${b.length}).`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Updates a cluster's centroid embedding to incorporate a new member,
 * using a simple running average weighted by prior member count. This
 * keeps the centroid representative of the whole cluster over time rather
 * than staying pinned to just the first complaint that created it.
 */
export function updateCentroid(
  currentCentroid: number[],
  currentCount: number,
  newEmbedding: number[]
): number[] {
  if (currentCentroid.length !== newEmbedding.length) {
    throw new Error("Cannot update centroid with an embedding of a different length.");
  }

  return currentCentroid.map(
    (value, i) => (value * currentCount + newEmbedding[i]) / (currentCount + 1)
  );
}
