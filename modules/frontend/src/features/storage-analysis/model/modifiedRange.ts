/** Ranges of modification dates, counted back from when the analysis ended. */
export const MODIFIED_RANGES = [
  "any",
  "last30",
  "lastYear",
  "over1",
  "over3",
] as const;
export type ModifiedRange = (typeof MODIFIED_RANGES)[number];

const DAY = 86_400_000;

/**
 * The instants a range stands for, from the moment the analysis ended: the
 * same analysis always asks the same question, whenever it is looked at.
 * Recent ranges stop at that moment, so a date after it never counts as
 * recent; older ones have no lower bound.
 */
export function modifiedBounds(
  range: ModifiedRange,
  reference: string,
): { from?: string; before?: string } {
  const end = Date.parse(reference);
  if (range === "any" || Number.isNaN(end)) return {};
  const yearsBack = (years: number) => {
    const date = new Date(end);
    date.setUTCFullYear(date.getUTCFullYear() - years);
    return date.toISOString();
  };
  // Inclusive of the last millisecond the analysis could have read.
  const until = new Date(end + 1).toISOString();
  switch (range) {
    case "last30":
      return { from: new Date(end - 30 * DAY).toISOString(), before: until };
    case "lastYear":
      return { from: yearsBack(1), before: until };
    case "over1":
      return { before: yearsBack(1) };
    case "over3":
      return { before: yearsBack(3) };
  }
}
