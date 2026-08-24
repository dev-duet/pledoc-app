/**
 * Tunable settings for deduplication/clustering, kept in one place for
 * easy adjustment during testing.
 */
export const CLUSTER_CONFIG = {
  /** Cosine similarity threshold for joining an existing cluster (per brief: ~0.85). */
  SIMILARITY_THRESHOLD: 0.85,

  /** Gemini embedding model. gemini-embedding-001 is the current general-purpose text embedding model (superseded text-embedding-004). */
  EMBEDDING_MODEL: "gemini-embedding-001",

  /** How many existing clusters in a bucket to compare a new complaint against before giving up and creating a new one. */
  MAX_CANDIDATE_CLUSTERS_PER_BUCKET: 25,
} as const;

export const GEMINI_EMBED_URL = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${CLUSTER_CONFIG.EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
