/**
 * NOTE: This project is on the Firebase Spark (free) plan, and deployed
 * Cloud Functions with a Firestore trigger require Blaze. Rather than a
 * deployed `onDocumentWritten` export, geo-verification runs as a standalone
 * script — see watcher.ts and the README for how to run it.
 *
 * This file is intentionally NOT the trigger entry point right now. If the
 * project ever upgrades to Blaze, watcher.ts's logic can be moved back into
 * an onDocumentWritten export here with no changes to autoResolve.ts,
 * cascade.ts, osmClient.ts, etc. — they never depended on the Functions
 * runtime either way.
 *
 * Nothing to export from here yet, so nothing to add to the shared
 * functions/index.ts at merge time either — until/unless Blaze happens.
 */
export {};
