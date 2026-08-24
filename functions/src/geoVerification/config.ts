/**
 * Tunable thresholds for auto-resolution.
 * Pulled into one file so they're easy to find and adjust without digging
 * through logic — useful when you're tuning against real demo data.
 */

export const GEO_CONFIG = {
  /** Cluster reaches this many independent reporters -> eligible for auto-verify (if geo-consistent). */
  CLUSTER_SIZE_AUTO_VERIFY_THRESHOLD: 15,

  /** Below this cluster size, "small cluster" rules apply (auto-invalid path). */
  SMALL_CLUSTER_THRESHOLD: 5,

  /** Max spread (in meters) between geocoded complaint locations in a cluster to count as "consistent geo-tagging". */
  GEO_CONSISTENCY_RADIUS_METERS: 800,

  /** Radius for a "local" Overpass facility check around a cluster's location. */
  LOCAL_FACILITY_RADIUS_METERS: 1500,

  /** Radius for the "district-wide" Overpass facility check (rule: zero facilities district-wide -> auto-verify). */
  DISTRICT_FACILITY_RADIUS_METERS: 6000,

  /** Nominatim requires >=1s between requests per their usage policy. */
  NOMINATIM_MIN_DELAY_MS: 1100,

  /** Required by Nominatim usage policy — replace with your actual contact/app info before the live demo. */
  NOMINATIM_USER_AGENT: "Pledoc-Hackathon-Prototype/0.1 (contact: rachanan574@gmail,com)",
} as const;

/**
 * Maps a complaint category to the OSM tags relevant for checking whether
 * infrastructure of that type exists nearby. Extend this as new categories
 * come in from the frontend's report form.
 */
export const CATEGORY_OSM_TAGS: Record<string, string[]> = {
  water: [
    "amenity=drinking_water",
    "man_made=water_well",
    "man_made=water_tower",
    "man_made=water_works",
    "amenity=water_point",
  ],
  electricity: [
    "power=line",
    "power=substation",
    "power=transformer",
    "power=pole",
    "power=generator",
  ],
  sanitation: [
    "amenity=toilets",
    "man_made=wastewater_plant",
    "man_made=sewer_vent",
  ],
  roads: [
    "highway=residential",
    "highway=tertiary",
    "highway=secondary",
    "highway=primary",
    "highway=unclassified",
    "highway=track",
  ],
};
