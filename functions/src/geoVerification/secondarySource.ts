import { SecondarySourceResult } from "./types";

/**
 * Cross-checks a complaint against a second, independent data source
 * (e.g. a government open-data registry). This is a STUB: no real registry
 * is wired up yet since availability varies a lot by country/category and
 * you'll likely want to plug in different sources per BRICS nation.
 *
 * Contract for whoever implements a real source:
 * - Return { available: false, ... } if there's no dataset to check against
 *   for this country/category — the auto-resolve logic treats that as
 *   "no signal" and simply skips this rule, it does NOT invalidate anything.
 * - Return corroborates: true if the second source confirms the infra gap
 *   (e.g. registry shows no facility where the complaint says there should
 *   be one), false if it contradicts the complaint, null if the source has
 *   data but it's ambiguous for this location.
 *
 * Wire this up to a real API by replacing the body below. Until then it's a
 * safe no-op so the rest of the pipeline runs end-to-end.
 */
export async function checkSecondarySource(
  category: string,
  location: string,
  country: string
): Promise<SecondarySourceResult> {
  // TODO: implement per-country registries, e.g.:
  //   - India: data.gov.in datasets (water/sanitation infra by district)
  //   - Brazil: dados.gov.br
  //   - South Africa: municipal open-data portals
  // For the hackathon prototype, this deliberately returns "unavailable" so
  // the disagreement/agreement rule simply never fires yet — cleanly falls
  // back to the OSM-only rules below.
  return {
    available: false,
    corroborates: null,
    source: "none-configured",
  };
}
