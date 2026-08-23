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

/**
 * Geocodes a list of location strings and checks whether they cluster tightly
 * together (within GEO_CONSISTENCY_RADIUS_METERS of each other). Used for the
 * "cluster size + consistent geo-tagging -> auto-verify" rule.
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
  locations: string[],
  countryHint?: string
): Promise<{ consistent: boolean; geocodedCount: number; spreadMeters: number | null }> {
  const uniqueLocations = Array.from(new Set(locations));
  const points: GeoPoint[] = [];

  for (const loc of uniqueLocations) {
    const point = await geocodeLocation(loc, countryHint);
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
