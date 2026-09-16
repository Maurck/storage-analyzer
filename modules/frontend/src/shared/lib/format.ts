const numberFormatter = new Intl.NumberFormat("en-US");
export const formatNumber = (value: number) => numberFormatter.format(value);

// Sizes follow Windows Explorer's own formatter (StrFormatByteSize in
// shlwapi.dll) so a folder reads the same here as in the file manager. Its
// rules, derived by probing the API:
//   - Divide by 1024, but label the results KB, MB and GB.
//   - Move up a unit once a value reaches 1000 of the current one, so
//     1,023,999 B is "999 KB" while 1,024,000 B is "0.97 MB".
//   - Show three significant digits and truncate the rest rather than round.
//   - Count whole units one step below the displayed one and only then divide.
//     This is what makes 33,316,061,315,072 B the first "30.3 TB": it is the
//     first value reaching a whole 31,028 GB. Dividing the byte count directly
//     would turn the 30.2 TB just below it into 30.3 TB.
const units = ["KB", "MB", "GB", "TB", "PB"];
const sizeFormatters = [0, 1, 2].map(
  (digits) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }),
);

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
  if (bytes < 1024) return `${numberFormatter.format(Math.floor(bytes))} B`;

  // `lower` holds whole units of the step below the displayed one, starting at
  // bytes for KB. Dividing an integer by 1024 is exact in binary floating
  // point, so no digit Explorer keeps is lost on the way.
  let index = 0;
  let lower = Math.floor(bytes);
  let value = lower / 1024;
  while (value >= 1000 && index < units.length - 1) {
    index += 1;
    lower = Math.floor(lower / 1024);
    value = lower / 1024;
  }

  const decimals = value < 10 ? 2 : value < 100 ? 1 : 0;
  const scale = 10 ** decimals;
  const truncated = Math.floor(value * scale) / scale;
  return `${sizeFormatters[decimals].format(truncated)} ${units[index]}`;
}

export const percentOf = (part: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, (part / total) * 100)) : 0;
