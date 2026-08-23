import * as admin from "firebase-admin";
import { assignComplaintToCluster } from "./clusterAssignment";
import { buildBucketKey } from "./bucketing";
import { ComplaintForClustering } from "./types";

/**
 * Same Spark-plan workaround as geoVerification/watcher.ts: this runs as a
 * standalone Node script using onSnapshot, rather than a deployed Cloud
 * Function trigger, since Firestore-triggered Functions require Blaze.
 *
 * This listens for complaints that are ready to cluster: category,
 * location, and issue_summary all populated (meaning your teammate's
 * Gemini pipeline has finished processing them), but cluster_id is still
 * null. Once this watcher assigns a cluster_id, the complaint naturally
 * drops out of the query — no manual dedupe guard needed here, unlike the
 * geo-verification watcher (which has to track processed counts manually
 * since its query criteria don't change after processing).
 */

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

// Serializes processing per bucket (category+location) so two complaints
// landing in the same bucket at nearly the same moment don't both create
// a brand-new cluster instead of one joining the other. Firestore
// transactions handle the join-side race safely already; this queue
// covers the "both decide to create a new cluster" race on the create side.
const bucketQueues = new Map<string, Promise<void>>();

function runSerialized(bucketKey: string, task: () => Promise<void>): Promise<void> {
  const previous = bucketQueues.get(bucketKey) ?? Promise.resolve();
  const next = previous.then(task, task); // run task regardless of previous outcome
  bucketQueues.set(bucketKey, next);
  return next;
}

async function processComplaint(complaint: ComplaintForClustering): Promise<void> {
  const bucketKey = buildBucketKey(complaint.category, complaint.location);

  await runSerialized(bucketKey, async () => {
    try {
      const result = await assignComplaintToCluster(db, complaint);
      console.log(
        `[clustering] Complaint ${complaint.id} -> ${result.action} cluster ${result.clusterId} (bucket: ${bucketKey})`
      );
    } catch (err) {
      // Never assign a fallback/guessed cluster_id on failure — leaving it
      // null means this complaint stays in the watcher's query and will be
      // retried automatically the next time anything about it changes, or
      // you can force a retry by touching the doc (e.g. re-saving a field).
      console.error(`[clustering] Failed to cluster complaint ${complaint.id}`, err);
    }
  });
}

function isReadyToCluster(data: FirebaseFirestore.DocumentData): boolean {
  return (
    typeof data.category === "string" &&
    data.category.trim().length > 0 &&
    typeof data.location === "string" &&
    data.location.trim().length > 0 &&
    typeof data.issue_summary === "string" &&
    data.issue_summary.trim().length > 0
  );
}

function startWatcher(): void {
  console.log("[clustering] Watching complaints collection for unclustered, ready complaints...");

  db.collection("complaints")
    .where("cluster_id", "==", null)
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "removed") return;

          const data = change.doc.data();
          if (!isReadyToCluster(data)) {
            // Teammate's Gemini pipeline hasn't filled in category/location/
            // issue_summary yet — nothing to cluster on. Will be picked up
            // automatically once those fields are written.
            return;
          }

          const complaint: ComplaintForClustering = {
            id: change.doc.id,
            category: data.category,
            location: data.location,
            location_detail: data.location_detail,
            issue_summary: data.issue_summary,
            country: data.country,
            cluster_id: null,
          };

          void processComplaint(complaint);
        });
      },
      (err) => {
        console.error("[clustering] Snapshot listener error:", err);
      }
    );
}

startWatcher();

process.on("SIGINT", () => {
  console.log("\n[clustering] Shutting down.");
  process.exit(0);
});
