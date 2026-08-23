import { GEO_CONFIG, CATEGORY_OSM_TAGS } from "./config";
import { GeoPoint, OverpassFacilityResult } from "./types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

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

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });

  if (!res.ok) {
    // Overpass has generous but not infinite rate limits — treat a failure as
    // "inconclusive", not "zero facilities", so it doesn't get misread as
    // confirming an infra gap.
    throw new Error(`Overpass query failed with status ${res.status}`);
  }

  const data = (await res.json()) as { elements: Array<{ id: number }> };
  return {
    facilityCount: data.elements.length,
    elementIds: data.elements.map((e) => e.id),
  };
}
