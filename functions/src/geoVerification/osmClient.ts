import { GEO_CONFIG, CATEGORY_OSM_TAGS } from "./config";
import { GeoPoint, OverpassFacilityResult } from "./types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Public Overpass servers can be flaky under load. Try each mirror, with a
// short retry-with-backoff per mirror, before giving up — there's no
// guaranteed uptime SLA on these free instances, and repeated testing in a
// short window can trip temporary throttling.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simple in-memory rate-limit guard for Nominatim (1 req/sec per their usage policy).
// In a Cloud Functions environment each instance gets its own clock, which is fine
// for hackathon volume; for production, move this to a shared queue.
let lastNominatimCallAt = 0;

async function throttleNominatim(): Promise<void> {
  const elapsed = Date.now() - lastNominatimCallAt;
  const wait = GEO_CONFIG.NOMINATIM_MIN_DELAY_MS - elapsed;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastNominatimCallAt = Date.now();
}

/**
 * Geocodes a free-text location string (e.g. "Sector 12, Ward 4, Pune") into
 * coordinates. Returns null if no confident match — callers should treat that
 * as "cannot verify geographically" and fall back to needs_review rather than
 * guessing.
 */
export async function geocodeLocation(
  location: string,
  countryHint?: string
): Promise<GeoPoint | null> {
  await throttleNominatim();

  const params = new URLSearchParams({
    q: countryHint ? `${location}, ${countryHint}` : location,
    format: "json",
    limit: "1",
  });

  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { "User-Agent": GEO_CONFIG.NOMINATIM_USER_AGENT },
  });

  if (!res.ok) {
    console.warn(`Nominatim geocode failed (${res.status}) for "${location}"`);
    return null;
  }

  const results = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!results.length) return null;

  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

/**
 * Queries Overpass for facilities relevant to `category` within `radiusMeters`
 * of `point`. Returns a count + element ids so callers can decide what to do.
 * Unrecognized categories query nothing and return facilityCount: 0 — callers
 * should treat that as "no signal", not "confirmed gap".
 */
export async function queryNearbyFacilities(
  point: GeoPoint,
  category: string,
  radiusMeters: number
): Promise<OverpassFacilityResult> {
  const tags = CATEGORY_OSM_TAGS[category.toLowerCase()];
  if (!tags || tags.length === 0) {
    console.warn(`No OSM tag mapping for category "${category}" — skipping facility check.`);
    return { facilityCount: 0, elementIds: [] };
  }

  const tagClauses = tags
    .map((tag) => {
      const [key, value] = tag.split("=");
      return `
        node["${key}"="${value}"](around:${radiusMeters},${point.lat},${point.lon});
        way["${key}"="${value}"](around:${radiusMeters},${point.lat},${point.lon});
      `;
    })
    .join("\n");

  const query = `
    [out:json][timeout:25];
    (
      ${tagClauses}
    );
    out ids;
  `;

  // Try each mirror in order, with one short retry per mirror on a 5xx/
  // network failure — a single transient blip shouldn't fail the whole
  // check when a 3-second wait would clear it.
  let lastError: unknown = null;
  for (const url of OVERPASS_URLS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "User-Agent": GEO_CONFIG.NOMINATIM_USER_AGENT,
          },
          body: query,
        });

        if (!res.ok) {
          lastError = new Error(`Overpass query failed with status ${res.status} (${url})`);
          if (attempt === 0) {
            await sleep(3000);
            continue; // retry same mirror once
          }
          break; // give up on this mirror, try the next one
        }

        const data = (await res.json()) as { elements: Array<{ id: number }> };
        return {
          facilityCount: data.elements.length,
          elementIds: data.elements.map((e) => e.id),
        };
      } catch (err) {
        lastError = err;
        if (attempt === 0) {
          await sleep(3000);
          continue;
        }
        break;
      }
    }
  }

  // Every mirror failed — surface this as an error so autoResolve treats it
  // as inconclusive (needs_review) rather than silently reading as "zero
  // facilities found" (which would incorrectly look like strong gap evidence).
  throw lastError instanceof Error
    ? lastError
    : new Error("All Overpass mirrors failed for an unknown reason.");
}
