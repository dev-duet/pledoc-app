# Deduplication / Clustering (Track B, part 2)

Groups complaints into clusters: a cheap category+location bucket pass,
then finer embedding-similarity clustering on `issue_summary` within each
bucket. Feeds directly into your existing `geoVerification` watcher — once
this assigns a `cluster_id` and updates a cluster's `count`, that watcher
picks it up automatically.

## ⚠️ Same Spark-plan approach as geo-verification

This runs as a standalone script (`watcher.ts`) using `onSnapshot`, not a
deployed Cloud Function — same reasoning as the geo-verification module.
See that module's README if you want the full explanation.

## ⚠️ Needs your teammate's Gemini API key

The embedding step calls Gemini's `text-embedding-004` model, which needs
an API key. Per your plan, ask your teammate for the key she's using for
the Track A pipeline (sharing it directly is fine within your own team).

Set it as an environment variable in the terminal session before running
this watcher:

```powershell
# PowerShell
$env:GEMINI_API_KEY="her-key-here"
```
```bash
# Mac/Linux
export GEMINI_API_KEY="her-key-here"
```

You'll also still need `GOOGLE_APPLICATION_CREDENTIALS` set (same service
account key as the geo-verification watcher) since this also writes to
Firestore.

## How it fits together

```
watcher.ts (standalone script)
    │ onSnapshot listener on complaints/ where cluster_id == null
    ▼
processComplaint — checks category/location/issue_summary are filled in
(i.e. your teammate's Gemini pipeline already ran on this complaint)
    │
    ▼
assignComplaintToCluster (clusterAssignment.ts)
    │
    ├─ embedText (geminiEmbeddings.ts)          — embeds issue_summary
    ├─ fetchCandidateClusters (firestoreClusterOps.ts)
    │     — cheap first pass: only clusters sharing category + location_bucket
    ├─ cosineSimilarity (similarity.ts) against each candidate's centroid
    │
    ▼
joinClusterAndAssign  OR  createClusterAndAssign (firestoreClusterOps.ts)
    │ writes cluster_id back onto the complaint, updates cluster count + centroid
    ▼
(your existing geoVerification watcher reacts to the cluster's count change)
```

## Running it

Same session, both watchers can run at once — open two terminals inside
`functions/`:

**Terminal 1** (if not already running):
```bash
$env:GOOGLE_APPLICATION_CREDENTIALS="path\to\your-key.json"
npx ts-node src/geoVerification/watcher.ts
```

**Terminal 2**:
```bash
$env:GOOGLE_APPLICATION_CREDENTIALS="path\to\your-key.json"
$env:GEMINI_API_KEY="her-key-here"
npx ts-node src/clustering/watcher.ts
```

Expected output:
```
[clustering] Watching complaints collection for unclustered, ready complaints...
```

## Design notes / caveats

- **Bucketing assumes the frontend's structured location dropdowns produce
  identical strings for the same real-world place.** Since location is
  selected via Country → State → District/Ward dropdowns (not free text),
  this should hold — but if that assumption turns out wrong in testing
  (e.g. inconsistent formatting), `bucketing.ts` is the one place to adjust,
  by matching on a sub-part of the string instead of the whole thing.
- **Cluster centroid is a running average**, updated each time a complaint
  joins — not recomputed from scratch — so it drifts to represent the
  whole cluster over time rather than staying anchored to whichever
  complaint happened to create it first.
- **Race handling**: joining an existing cluster is done in a Firestore
  transaction (safe against concurrent joins). Creating a brand-new cluster
  isn't transactionally exclusive across the whole bucket, so an in-process
  queue (`bucketQueues` in watcher.ts) serializes processing per bucket to
  avoid two near-simultaneous complaints each creating their own new
  cluster for what should be one. This only protects against races within
  a single running watcher process — if you ever run multiple watcher
  instances at once, that protection doesn't apply across instances.
- **Failures never guess.** If embedding or Firestore writes fail, the
  complaint's `cluster_id` stays `null` and it remains in the watcher's
  query — it'll be retried automatically next time anything touches it, or
  you can force a retry by re-saving any field on the complaint doc.
- **No manual dedupe-guard map needed here** (unlike geoVerification's
  `lastProcessedCount`), since a successfully clustered complaint naturally
  drops out of the `cluster_id == null` query — the query itself is the
  guard.

## Testing without running the listener

```ts
import { assignComplaintToCluster } from "./clusterAssignment";

const result = await assignComplaintToCluster(db, {
  id: "test-id",
  category: "water",
  location: "ward 4, pune",
  issue_summary: "no water supply for three days",
  country: "India",
  cluster_id: null,
});
console.log(result);
```

Needs `GEMINI_API_KEY` set and a real Firestore `db` instance, but doesn't
need the listener running.
