# Geo-Verification (Track B, part 1)

Auto-resolves cluster verification status using OSM data, cascading the
result down to every complaint in the cluster. Self-contained — no
dependency on the Gemini pipeline your teammate is building.

## ⚠️ Spark plan note (read this first)

This project is on Firebase's **Spark (free) plan**. Deployed Cloud
Functions with a Firestore trigger require **Blaze**. So instead of a
deployed `onDocumentWritten` export, this runs as a **standalone Node
script** (`watcher.ts`) using the Admin SDK's `onSnapshot` listener — same
logic, same result, just running as a normal long-lived process instead of
inside Firebase's Functions infra. No card needed.

If the project upgrades to Blaze later, this can be converted back into a
real deployed trigger with no changes to any file except swapping
`watcher.ts`'s listener for an `onDocumentWritten` export — all the actual
logic (`autoResolve.ts`, `cascade.ts`, `osmClient.ts`, etc.) is framework-
agnostic and doesn't care which one is running it.

## How it fits together

```
watcher.ts (standalone script, run manually — see below)
        │  onSnapshot listener on clusters/ where verification_status == needs_review
        ▼
  resolveGeoVerification (autoResolve.ts)
        │
        ├─ checkSecondarySource     (secondarySource.ts)  — stub, see below
        ├─ checkGeoConsistency      (geoConsistency.ts)    — rule 1
        ├─ queryNearbyFacilities    (osmClient.ts)         — rules 2 & 3
        │
        ▼
  applyClusterDecision (cascade.ts) — writes cluster + all its complaints
```

## Setup

**1. Get a service account key** (needed because this runs outside Firebase's
own infra, so it can't use the automatic in-Functions credentials):

- Firebase Console → Project Settings (gear icon) → **Service accounts** tab
- Click **Generate new private key** → downloads a `.json` file
- Save it somewhere OUTSIDE the repo, or inside it but **make sure it's
  gitignored** — this file grants full admin access to your Firestore, never
  commit it. Check `functions/.gitignore` and add a line for it if it's not
  already covered (e.g. `*.serviceAccountKey.json`).

**2. Point the script at it** via an environment variable, in your terminal
session before running the script:

```powershell
# PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\your-key.json"
```
```bash
# Mac/Linux
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your-key.json"
```

**3. Install `ts-node`** (to run the `.ts` file directly without a separate
compile step) inside `functions/`:

```bash
cd functions
npm install --save-dev ts-node
```

## Running it

From inside `functions/`:

```bash
npx ts-node src/geoVerification/watcher.ts
```

You'll see:
```
[geo-verify] Watching clusters collection for needs_review changes...
```

**This needs to stay running** to do anything — it's a live listener, not a
one-shot script. Keep this terminal open during testing/demo, or run it in
the background with something like `pm2` if you want it more persistent:

```bash
npm install -g pm2
pm2 start "npx ts-node src/geoVerification/watcher.ts" --name geo-verify
pm2 logs geo-verify
```

Stop it with `Ctrl+C` (or `pm2 stop geo-verify`).

## Integration

Nothing to export from the shared `functions/index.ts` right now — this
module isn't a deployed Cloud Function, so there's no merge-time line to
add for it (unlike your teammate's Gemini trigger, which presumably IS a
deployed `onDocumentCreated` and does need its export). If you upgrade to
Blaze and convert this to a real trigger later, that's when you'd add:
```ts
export { geoVerifyCluster } from "./geoVerification";
```

## Known caveats / what's stubbed

- **`secondarySource.ts` is a stub.** No real data.gov.in-style registry is
  wired up — it always returns "unavailable" so that rule cleanly falls
  through to the OSM-only rules. Wire up real per-country registries here
  when you have API access.
- **Geocoding uses Nominatim**, which is free but rate-limited to ~1 req/sec
  and asks for a real User-Agent — update `NOMINATIM_USER_AGENT` in
  `config.ts` before the live demo. For a 15+ report cluster, geo-consistency
  checking can take 15+ seconds due to this throttle. Two ways to speed it up
  if it's a bottleneck at demo time:
  1. Cache each complaint's geocoded lat/lon on the complaint doc when it's
     first written, so this module reads cached coordinates instead of
     re-geocoding every time a cluster updates.
  2. Swap in a paid geocoder with higher limits.
- **`priorityScore.ts` is intentionally minimal** — just enough to pass a
  number into the cascade. The full tunable w1/w2/w3 system with
  policymaker-facing weight controls and real `demographic_weight` data is
  item 3 in the brief and deserves its own module/UI.
- **Never silently rejects.** Network failures leave a cluster at
  `needs_review` rather than guessing — logged to the console.
- **The dedupe guard is in-memory** (`lastProcessedCount` Map in
  `watcher.ts`). If you restart the script, it'll briefly re-check every
  currently-needs_review cluster once on startup (harmless — worst case is a
  handful of redundant Overpass calls), then settle back into only
  reacting to real changes.

## Testing without running the listener

`resolveGeoVerification` itself is pure enough to unit test directly,
without Firestore or the listener running at all:

```ts
import { resolveGeoVerification } from "./autoResolve";

const decision = await resolveGeoVerification({
  category: "water",
  clusterLocation: "Ward 4, Pune",
  complaintLocations: ["Ward 4, Pune", "Ward 4, Pune"],
  count: 20,
  country: "India",
});
console.log(decision);
```

This hits the real OSM APIs (free/no-auth) but not Firestore — useful for
sanity-checking the Overpass tag mappings in `config.ts` against your actual
demo locations before running the full watcher.
