# Clustering

Groups complaints into clusters in two passes: a cheap **category + location bucket** pass, then **embedding similarity** on `issue_summary` within each bucket. Once a complaint gets a `cluster_id` and the cluster's `count` changes, the geo-verification watcher picks the cluster up automatically.

## How it fits together

```
watcher.ts  ── onSnapshot on complaints where cluster_id is empty
    │           and category, location and issue_summary are filled in
    ▼
assignComplaintToCluster (clusterAssignment.ts)
    ├─ embedText (geminiEmbeddings.ts)            embeds issue_summary
    ├─ fetchCandidateClusters (firestoreClusterOps.ts)
    │                                             clusters sharing category + location_bucket
    └─ cosineSimilarity (similarity.ts)           against each candidate's centroid
    ▼
joinClusterAndAssign  or  createClusterAndAssign
    writes cluster_id onto the complaint, updates the cluster's count and centroid
```

## Configuration (`config.ts`)

| Setting | Value |
| :--- | :--- |
| `SIMILARITY_THRESHOLD` | 0.85 cosine similarity to join an existing cluster |
| `EMBEDDING_MODEL` | `gemini-embedding-001` |
| `MAX_CANDIDATE_CLUSTERS_PER_BUCKET` | 25 |

## Running

Normally this runs together with the other watchers via `npm run listen:all` (see the root README). To run it alone, from `functions/`:

```bash
# needs GEMINI_API_KEY and Firebase Admin credentials
# (FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS, or a gitignored service-account.json)
npx ts-node src/clustering/watcher.ts
```

Expected output: `[clustering] Watching complaints collection for unclustered, ready complaints...`

## Design notes

- **Bucketing** (`bucketing.ts`) keeps only the coarse part of a location (locality, city, state, country) and drops door numbers, pin codes and landmark phrases, so two reports from the same neighbourhood share a bucket even when their exact addresses differ.
- **The cluster centroid is a running average**, updated each time a complaint joins, so it represents the whole cluster rather than only the first complaint.
- **Race handling:** joining a cluster uses a Firestore transaction. Creating a new cluster is serialized per bucket by an in-process queue, so two near-simultaneous complaints don't each create their own cluster. This protects a single watcher process only, so don't run multiple instances at once.
- **Failures never guess:** if embedding or a Firestore write fails, `cluster_id` stays empty and the complaint is retried the next time it changes.
