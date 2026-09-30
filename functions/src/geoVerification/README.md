# Geo-Verification

Resolves a cluster's `verification_status` from OpenStreetMap data and cascades the result to every complaint in the cluster.

## How it fits together

```
watcher.ts  ── onSnapshot on clusters where verification_status == needs_review
    ▼
resolveGeoVerification (autoResolve.ts)
    ├─ geocodeLocation / checkGeoConsistency   (osmClient.ts, geoConsistency.ts)
    ├─ checkSecondarySource                    (secondarySource.ts)  stub
    └─ queryNearbyFacilities                   (osmClient.ts)  Overpass API
    ▼
computePriorityScore (../prioritization)
    ▼
applyClusterDecision (cascade.ts)  writes the cluster and all its complaints
```

## Rules (`config.ts`, `autoResolve.ts`)

| Situation | Outcome |
| :--- | :--- |
| 15 or more reports, all within 800 m of each other | Verified |
| No relevant facility within 6 km | Verified |
| 5 or fewer reports and a relevant facility within 1.5 km, no corroboration | Invalid |
| Anything else, or the location can't be geocoded | Stays `needs_review` for a policymaker |

Which OpenStreetMap tags count as a "relevant facility" per category is defined in `CATEGORY_OSM_TAGS` in `config.ts`.

## Running

Normally this runs together with the other watchers via `npm run listen:all` (see the root README). To run it alone, from `functions/`:

```bash
# needs Firebase Admin credentials
# (FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS, or a gitignored service-account.json)
npx ts-node src/geoVerification/watcher.ts
```

Expected output: `[geo-verify] Watching clusters collection for needs_review changes...`

> Never commit a service-account key. `functions/.gitignore` excludes `service-account*.json` and `.env`.

## Caveats

- **`secondarySource.ts` is a stub.** No official registry is wired in, so it always reports "unavailable" and the OpenStreetMap rules decide.
- **Geocoding uses Nominatim**, which is rate-limited to about one request per second, so large clusters take longer to check.
- **The dedupe guard is in memory** (`lastProcessedCount` in `watcher.ts`). After a restart, each `needs_review` cluster is re-checked once, which is harmless.
- **Never silently rejects:** network failures leave a cluster at `needs_review` and are logged.

## Testing without the listener

```ts
import { resolveGeoVerification } from "./autoResolve";

const decision = await resolveGeoVerification({
  category: "water",
  clusterLocation: "Ward 4, Pune",
  complaintLocations: [{ location: "Ward 4, Pune" }],
  count: 20,
  country: "India",
});
console.log(decision);
```
