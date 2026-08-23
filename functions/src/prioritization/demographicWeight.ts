/**
 * Computes the `demographic_weight` component of the priority score — a
 * population/vulnerability proxy, per the brief.
 *
 * THIS IS A STUB, same pattern as geoVerification/secondarySource.ts: real
 * demographic/vulnerability data (e.g. World Bank population density,
 * national census vulnerability indices) needs a real data source wired in
 * per BRICS country, which varies a lot in availability and format. Rather
 * than block the whole scoring pipeline on that, this returns a neutral
 * placeholder value so priority_score always computes something sane.
 *
 * Contract for whoever implements this for real:
 * - Return a value in [0, 1], where higher = more vulnerable/higher-need
 *   population, so it's comparable across countries once real data backs it.
 * - Category matters too: e.g. a water-supply gap in a high-density informal
 *   settlement is a very different severity than the same gap in a
 *   low-density area — a real implementation should account for both
 *   `country` and `category`, not just look up one national average number.
 *
 * TODO (real implementation ideas, one per BRICS country as datasets vary):
 *   - India: Census of India district-level data, or SECC (Socio-Economic
 *     Caste Census) vulnerability indicators
 *   - Brazil: IBGE (Instituto Brasileiro de Geografia e Estatística) data
 *   - South Africa: Stats SA General Household Survey
 *   - Russia, China: national statistics bureaus (availability/format varies)
 */
export async function computeDemographicWeight(
  country: string,
  category: string
): Promise<number> {
  // Neutral placeholder — every complaint gets the same weight regardless
  // of country/category until real data is wired in. This is intentionally
  // conservative (doesn't fake a confident answer) rather than guessing.
  return 0.5;
}
