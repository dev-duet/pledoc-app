// Runs Track A + both Track B watchers inside ONE Node process,
// so the whole backend fits in a single Railway service.
// listener must be imported first: it sets up the shared Firebase app.
import "./listener";
import "./clustering/watcher";
import "./geoVerification/watcher";

// Log unexpected errors instead of letting one watcher crash the rest.
process.on("unhandledRejection", (err) => {
  console.error("[runAll] Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("[runAll] Uncaught exception:", err);
});
