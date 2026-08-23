import { GEO_CONFIG } from "./config";
import { checkGeoConsistency, ComplaintLocationInput } from "./geoConsistency";
import { queryNearbyFacilities } from "./osmClient";
import { checkSecondarySource } from "./secondarySource";
import { geocodeLocation } from "./osmClient";
import { GeoVerificationDecision } from "./types";

interface ResolveInput {
  category: string;
  /** Cluster's representative location (e.g. location_bucket), used for the primary Overpass check. */
  clusterLocation: string;
  /** Individual complaints within this cluster (location + optional Gemini-extracted detail), used for geo-consistency. */
  complaintLocations: ComplaintLocationInput[];
  count: number;
  country: string;
}

/**
 * Applies the auto-resolution rules in priority order. Every path returns a
 * definite status — this function should never leave a cluster silently
 * unresolved without a `reasoning` string explaining why it landed there.
 *
 * Rule order matters: rules 1 and 2 (auto-verify paths) are checked before
 * rule 3 (auto-invalid) so that a large, geo-consistent cluster never gets
 * incorrectly invalidated just because it's also near a facility.
 */
export async function resolveGeoVerification(input: ResolveInput): Promise<GeoVerificationDecision> {
  const { category, clusterLocation, complaintLocations, count, country } = input;

  const clusterPoint = await geocodeLocation(clusterLocation, country);

  if (!clusterPoint) {
    return {
      status: "needs_review",
      infra_gap_severity: 0.5,
      reasoning: `Could not geocode cluster location "${clusterLocation}" — flagged for human review rather than guessing.`,
    };
  }

  // --- Secondary source cross-check (rule 4) runs first: if it gives a clear
  // answer, it's the strongest signal we have and should short-circuit the
  // weaker heuristics below. If unavailable/inconclusive, fall through.
  const secondary = await checkSecondarySource(category, clusterLocation, country);
  if (secondary.available && secondary.corroborates !== null) {
    if (secondary.corroborates) {
      return {
        status: "verified",
        infra_gap_severity: 0.9,
        reasoning: `Secondary source (${secondary.source}) corroborates the reported infra gap.`,
      };
    } else {
      return {
        status: "invalid",
        infra_gap_severity: 0.1,
        reasoning: `Secondary source (${secondary.source}) contradicts the reported infra gap.`,
      };
    }
  }
  // secondary.available === true but corroborates === null means real
  // disagreement/ambiguity — that's the "stays a genuine tie" case from the
  // brief, so it deliberately falls through to needs_review at the end
  // rather than being resolved by weaker signals.
  const secondaryWasAmbiguous = secondary.available && secondary.corroborates === null;

  // --- Rule 1: large, geo-consistent cluster -> auto-verify.
  if (count >= GEO_CONFIG.CLUSTER_SIZE_AUTO_VERIFY_THRESHOLD) {
    const consistency = await checkGeoConsistency(complaintLocations, country);
    if (consistency.consistent) {
      return {
        status: "verified",
        infra_gap_severity: 0.8,
        reasoning: `Cluster has ${count} reports (>= threshold ${GEO_CONFIG.CLUSTER_SIZE_AUTO_VERIFY_THRESHOLD}) with consistent geo-tagging (spread ${consistency.spreadMeters?.toFixed(0)}m).`,
      };
    }
  }

  if (secondaryWasAmbiguous) {
    return {
      status: "needs_review",
      infra_gap_severity: 0.5,
      reasoning: `Secondary source (${secondary.source}) had data but was inconclusive for this location — routed to human review.`,
    };
  }

  // --- Rule 2: zero relevant facilities district-wide -> auto-verify.
  const districtCheck = await queryNearbyFacilities(
    clusterPoint,
    category,
    GEO_CONFIG.DISTRICT_FACILITY_RADIUS_METERS
  );
  if (districtCheck.facilityCount === 0) {
    return {
      status: "verified",
      infra_gap_severity: 1.0,
      reasoning: `No ${category} facilities found within ${GEO_CONFIG.DISTRICT_FACILITY_RADIUS_METERS}m (district-wide check) — strong evidence of an actual infra gap.`,
    };
  }

  // --- Rule 3: small cluster + facility exists nearby + no corroboration -> auto-invalid.
  const localCheck = await queryNearbyFacilities(
    clusterPoint,
    category,
    GEO_CONFIG.LOCAL_FACILITY_RADIUS_METERS
  );
  if (count <= GEO_CONFIG.SMALL_CLUSTER_THRESHOLD && localCheck.facilityCount > 0) {
    return {
      status: "invalid",
      infra_gap_severity: 0.1,
      reasoning: `Small cluster (${count} reports) but ${localCheck.facilityCount} ${category} facilities found within ${GEO_CONFIG.LOCAL_FACILITY_RADIUS_METERS}m and no corroborating signal — likely a false report or resolved issue.`,
    };
  }

  // --- Nothing decisive fired: genuine tie for a human.
  const severity = localCheck.facilityCount === 0 ? 0.7 : 0.4;
  return {
    status: "needs_review",
    infra_gap_severity: severity,
    reasoning: `No auto-resolution rule reached a confident conclusion (cluster size ${count}, local facilities found: ${localCheck.facilityCount}). Routed to human review.`,
  };
}
