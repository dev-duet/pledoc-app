import * as admin from "firebase-admin";
import { assignComplaintToCluster } from "./clusterAssignment";
import { buildBucketKey, extractCountry } from "./bucketing";
import { ComplaintForClustering } from "./types";

/**
 * Same Spark-plan workaround as geoVerification/watcher.ts: this runs as a
 * standalone Node script using onSnapshot, rather than a deployed Cloud
 * Function trigger, since Firestore-triggered Functions require Blaze.
 *
 * This listens for complaints that are ready to cluster: category,
 * location, and issue_summary all populated, but cluster_id still empty.
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

if (!admin.apps.length) {
  const possiblePaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(process.cwd(), "service-account.json"),
    path.resolve(__dirname, "../../service-account.json"),
    path.resolve(__dirname, "../service-account.json"),
  ].filter(Boolean) as string[];

  const keyPath = possiblePaths.find((p) => fs.existsSync(p));

  if (keyPath) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || "pledoc-app",
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || "pledoc-app",
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.GCLOUD_PROJECT || "pledoc-app",
    });
  }
}

const db = admin.firestore();

// Serializes processing per bucket (category+location) so two complaints
// landing in the same bucket at nearly the same moment don't both create
// a brand-new cluster instead of one joining the other.
const bucketQueues = new Map<string, Promise<void>>();

function runSerialized(bucketKey: string, task: () => Promise<void>): Promise<void> {
  const previous = bucketQueues.get(bucketKey) ?? Promise.resolve();
  const next = previous.then(task, task); // run task regardless of previous outcome
  bucketQueues.set(bucketKey, next);
  return next;
}

// Complaint ids currently waiting or being processed. Firestore fires
// several snapshot events for one complaint (e.g. every time the Gemini
// pipeline updates it), and without this the same complaint could be
// clustered twice and counted twice.
const queued = new Set<string>();

async function processComplaint(complaint: ComplaintForClustering): Promise<void> {
  if (queued.has(complaint.id)) return;
  queued.add(complaint.id);

  const bucketKey = buildBucketKey(complaint.category, complaint.location);

  try {
    await runSerialized(bucketKey, async () => {
      try {
        // Re-read the complaint right before assigning: it may already have
        // been clustered while this task was waiting in the queue.
        const fresh = await db.collection("complaints").doc(complaint.id).get();
        if (!fresh.exists || fresh.data()?.cluster_id) {
          return;
        }

        const result = await assignComplaintToCluster(db, complaint);
        console.log(
          `[clustering] Complaint ${complaint.id} -> ${result.action} cluster ${result.clusterId} (bucket: ${bucketKey})`
        );
      } catch (err) {
        // Never assign a fallback/guessed cluster_id on failure — leaving it
        // empty means this complaint stays in the watcher's query and will
        // be retried the next time anything about it changes.
        console.error(`[clustering] Failed to cluster complaint ${complaint.id}`, err);
      }
    });
  } finally {
    queued.delete(complaint.id);
  }
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
  if (!process.env.GEMINI_API_KEY) {
    console.warn(
      "[clustering] ⚠️ Warning: GEMINI_API_KEY is not set. Please set it via $env:GEMINI_API_KEY=\"...\" or in functions/.env before processing complaints."
    );
  }
  console.log("[clustering] Watching complaints collection for unclustered, ready complaints...");

  db.collection("complaints").onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "removed") return;

        const data = change.doc.data();
        if (data.cluster_id) {
          return;
        }
        if (!isReadyToCluster(data)) {
          // The Gemini pipeline hasn't filled in category/location/
          // issue_summary yet. Will be picked up once those are written.
          return;
        }

        const complaint: ComplaintForClustering = {
          id: change.doc.id,
          category: data.category,
          location: data.location,
          location_detail: data.location_detail,
          issue_summary: data.issue_summary,
          country: data.country ?? extractCountry(data.location),
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
