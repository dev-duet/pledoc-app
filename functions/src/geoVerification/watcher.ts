import * as admin from "firebase-admin";
import { resolveGeoVerification } from "./autoResolve";
import { applyClusterDecision, cascadePriorityOnly } from "./cascade";
import { computePriorityScore } from "../prioritization/priorityCalculator";
import { Cluster, Complaint } from "./types";

/**
 * SPARK-PLAN WORKAROUND (see README): Cloud Functions with a Firestore
 * trigger require Blaze to deploy. This script does the same job as a
 * deployed `onDocumentWritten` trigger would, but runs as a normal
 * long-lived Node process using the Admin SDK's onSnapshot listener
 * instead. Functionally equivalent for the demo — just needs to stay
 * running (see "Running this" in the README) rather than being deployed.
 *
 * Swap-back note: if you upgrade to Blaze later, index.ts (the original
 * onDocumentWritten version) can be restored as-is — none of the shared
 * logic files (autoResolve, cascade, osmClient, etc.) need to change either
 * way, since they never depended on the Functions runtime.
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// --- Auth: needs a service account key since this isn't running inside
// Firebase's own infra. See README for how to get one from the console.
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

// Tracks the last `count` we actually processed per cluster, so we don't
// re-run on every snapshot event (onSnapshot fires on ANY field change,
// not just the ones we care about — Cloud Functions' before/after diffing
// doesn't exist here, so we replicate it manually).
const lastProcessedCount = new Map<string, number>();

// Prevents overlapping runs for the same cluster if two snapshot events
// land close together (e.g. rapid writes while a demo is being seeded).
const inFlight = new Set<string>();

async function processCluster(clusterId: string, cluster: Cluster): Promise<void> {
  if (inFlight.has(clusterId)) return;
  inFlight.add(clusterId);

  try {
    if (cluster.verification_status !== "needs_review") {
      // Already resolved (by us or a human) — stop tracking it so a manual
      // reset back to needs_review later will be picked up fresh.
      lastProcessedCount.delete(clusterId);
      return;
    }

    if (lastProcessedCount.get(clusterId) === cluster.count) {
      return; // nothing relevant changed since we last processed this one
    }

    const complaintsSnap = await db
      .collection("complaints")
      .where("cluster_id", "==", clusterId)
      .get();
    const complaintLocations = complaintsSnap.docs.map((d) => {
      const data = d.data() as Complaint;
      return { location: data.location, location_detail: data.location_detail };
    });

    if (complaintLocations.length === 0) {
      console.log(`[geo-verify] Cluster ${clusterId} has no linked complaints yet — skipping.`);
      return;
    }

    const decision = await resolveGeoVerification({
      category: cluster.category,
      clusterLocation: cluster.location_bucket,
      complaintLocations,
      count: cluster.count,
      country: cluster.country,
    });

    console.log(`[geo-verify] Cluster ${clusterId} -> ${decision.status} — ${decision.reasoning}`);
    lastProcessedCount.set(clusterId, cluster.count);

    if (decision.status === "needs_review") {
      const priorityScore = await computePriorityScore(db, {
        volume: cluster.count,
        verificationStatus: "needs_review",
        infraGapSeverity: decision.infra_gap_severity,
        category: cluster.category,
        country: cluster.country,
      });
      // Status isn't changing, but the score is — cascade the score alone
      // so complaints in a still-needs_review cluster don't sit on stale
      // priority_score values.
      await cascadePriorityOnly(db, clusterId, priorityScore, decision.infra_gap_severity);
      return;
    }

    const priorityScore = await computePriorityScore(db, {
      volume: cluster.count,
      verificationStatus: decision.status,
      infraGapSeverity: decision.infra_gap_severity,
      category: cluster.category,
      country: cluster.country,
    });

    await applyClusterDecision(db, clusterId, decision.status, priorityScore, decision.infra_gap_severity);
  } catch (err) {
    // Same rule as the deployed version: never silently resolve on failure.
    console.error(`[geo-verify] Failed to process cluster ${clusterId}`, err);
  } finally {
    inFlight.delete(clusterId);
  }
}

function startWatcher(): void {
  console.log("[geo-verify] Watching clusters collection for needs_review changes...");

  db.collection("clusters")
    .where("verification_status", "==", "needs_review")
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "removed") return;
          const cluster = { id: change.doc.id, ...change.doc.data() } as Cluster;
          void processCluster(cluster.id, cluster);
        });
      },
      (err) => {
        // Listener-level errors (e.g. dropped connection) — log and let the
        // process keep running; Firestore's SDK auto-reconnects listeners.
        console.error("[geo-verify] Snapshot listener error:", err);
      }
    );
}

startWatcher();

// Keep the process alive and exit cleanly on Ctrl+C.
process.on("SIGINT", () => {
  console.log("\n[geo-verify] Shutting down.");
  process.exit(0);
});