/**
 * Normalizes a location string for bucketing: keeps only the coarse part
 * (locality, city, state, country) and drops door numbers, street names,
 * landmark phrases and pin codes, so two complaints from the same
 * neighbourhood land in the same bucket even if their exact addresses
 * differ. The full address stays in the complaint's own fields.
 */
const LANDMARK_PREFIX =
  /^(near|nr|opposite|opp|behind|beside|next to|in front of|adjacent to|close to|across from|above|below)\b/;

export function normalizeLocation(location: string): string {
  const parts = location
    .split(",")
    .map((p) =>
      p
        .toLowerCase()
        .replace(/[-–]\s*\d{5,6}\b/g, "") // "- 560011" style pin codes
        .replace(/\b\d{5,6}\b/g, "") // standalone pin codes
        .replace(/[.;#]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((p) => p.length > 0)
    // drop pure door-number segments like "604", "12/3", "no 5"
    .filter((p) => !/^(no\s*)?\d+[a-z]?([/-]\d+[a-z]?)*$/.test(p))
    // drop landmark phrases like "near metro station"
    .filter((p) => !LANDMARK_PREFIX.test(p));

  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  // keep only the last 4 parts: locality, city, state, country
  return unique.slice(-4).join(" ");
}

/**
 * Builds the bucket key used for the cheap first-pass grouping step
 * (category + geographic bucket).
 */
export function buildBucketKey(category: string, location: string): string {
  return `${category.trim().toLowerCase()}::${normalizeLocation(location)}`;
}

const COUNTRY_NAMES = [
  "India",
  "China",
  "Brazil",
  "Russia",
  "South Africa",
  "Egypt",
  "Ethiopia",
  "Iran",
  "United Arab Emirates",
];

/**
 * The frontend doesn't send a `country` field (the Firestore rules don't
 * allow it), so derive it from the location text instead.
 */
export function extractCountry(location: string): string {
  const lower = location.toLowerCase();
  return COUNTRY_NAMES.find((c) => lower.includes(c.toLowerCase())) ?? "Unknown";
}
