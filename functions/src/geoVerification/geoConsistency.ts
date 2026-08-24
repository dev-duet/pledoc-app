import { GEO_CONFIG } from "./config";
import { geocodeLocation } from "./osmClient";
import { GeoPoint } from "./types";

/** Haversine distance in meters between two points. */
function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface ComplaintLocationInput {
  location: string;
  /** Optional extra detail from Gemini extraction (e.g. a landmark/street) — sharpens the geocode when present. */
  location_detail?: string | null;
}

/**
 * Geocodes a list of complaint locations and checks whether they cluster
 * tightly together (within GEO_CONSISTENCY_RADIUS_METERS of each other).
 * Used for the "cluster size + consistent geo-tagging -> auto-verify" rule.
 *
 * When a complaint has `location_detail` (extra detail Gemini pulled from
 * the transcript, e.g. a specific street or landmark not captured by the
 * dropdowns), it's appended to the geocode query for a more precise point —
 * falls back to `location` alone when detail is null/absent, which is the
 * common case.
 *
 * NOTE: this calls Nominatim once per unique location string, throttled to
 * 1 req/sec. For a 15+ report cluster that's real latency (~15+ seconds).
 * Two ways to speed this up later:
 *   1. Cache geocode results on the complaint doc itself when it's first
 *      written, so this function reads cached coords instead of re-geocoding.
 *   2. Swap Nominatim for a paid geocoder with higher rate limits once you're
 *      past the free-tier hackathon stage.
 */
export async function checkGeoConsistency(
  complaintLocations: ComplaintLocationInput[],
  countryHint?: string
): Promise<{ consistent: boolean; geocodedCount: number; spreadMeters: number | null }> {
  // Dedupe on the combined query string so identical location+detail pairs
  // aren't geocoded twice.
  const uniqueQueries = Array.from(
    new Set(
      complaintLocations.map((c) =>
        c.location_detail ? `${c.location}, ${c.location_detail}` : c.location
      )
    )
  );
  const points: GeoPoint[] = [];

  for (const query of uniqueQueries) {
    const point = await geocodeLocation(query, countryHint);
    if (point) points.push(point);
  }

  if (points.length < 2) {
    // Not enough geocoded points to judge spread — don't claim consistency
    // we can't actually verify.
    return { consistent: false, geocodedCount: points.length, spreadMeters: null };
  }

  let maxSpread = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      maxSpread = Math.max(maxSpread, distanceMeters(points[i], points[j]));
    }
  }

  return {
    consistent: maxSpread <= GEO_CONFIG.GEO_CONSISTENCY_RADIUS_METERS,
    geocodedCount: points.length,
    spreadMeters: maxSpread,
  };
}
