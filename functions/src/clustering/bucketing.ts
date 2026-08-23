/**
 * Normalizes a location string for bucketing purposes: lowercase, trimmed,
 * punctuation stripped, whitespace collapsed.
 *
 * IMPORTANT CAVEAT: the frontend's location input is only partially
 * structured — Country and State/Province are dropdowns, but District/
 * Ward/Locality is a free-text field citizens type themselves. Track B
 * doesn't see that raw input directly, though: per the pipeline, your
 * teammate's Gemini step extracts/normalizes `location` before Track B
 * reads it. So the real question is how consistent HER extraction's
 * output is for the same real-world place — not how consistent citizens'
 * raw typing is.
 *
 * This function's normalization (case/whitespace/punctuation) is a safety
 * net for minor formatting differences, but it can't fix two genuinely
 * different normalized strings for the same real place (e.g. "Koramangala,
 * Bengaluru" vs "Koramangala 5th Block, Bengaluru"). Recommend testing this
 * once real Gemini-extracted complaints exist: pull a handful of `location`
 * values from real complaints for the same area and check how much they
 * vary before trusting exact-match bucketing at scale. If they vary more
 * than expected, the fix belongs here (e.g. matching on a shared substring
 * or falling back to a coarser country+state-only bucket) — not in the
 * clustering logic downstream.
 */
export function normalizeLocation(location: string): string {
  return location
    .trim()
    .toLowerCase()
    .replace(/[.,;]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Builds the bucket key used for the cheap first-pass grouping step
 * (category + geographic bucket). Complaints in the same bucket are
 * candidates for the finer embedding-similarity clustering step; complaints
 * in different buckets are never compared against each other at all —
 * this is what keeps the pipeline cheap at scale.
 */
export function buildBucketKey(category: string, location: string): string {
  return `${category.trim().toLowerCase()}::${normalizeLocation(location)}`;
}
