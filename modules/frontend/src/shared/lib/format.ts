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
//
// Separators follow the regional format of the system, like Explorer does,
// never the interface language: see resolveNumberLocale.
const units = ["KB", "MB", "GB", "TB", "PB"];

/** Shown for a value that cannot be measured. Language-neutral on purpose. */
export const UNAVAILABLE = "—";

export interface Formatters {
  locale: string;
  formatNumber(value: number): string;
  formatBytes(bytes: number): string;
  /** `value` is a percentage from 0 to 100. */
  formatPercent(value: number): string;
  /** A clock-style duration such as 0:07, 12:34 or 1:02:03. */
  formatDuration(milliseconds: number): string;
}

export function createFormatters(locale: string): Formatters {
  // Windows groups four-digit numbers in every locale ("1.023" in Spanish),
  // while Intl skips them by default in some of them.
  const grouping = {
    useGrouping: "always",
  } as unknown as Intl.NumberFormatOptions;
  const integer = new Intl.NumberFormat(locale, grouping);
  const sized = [0, 1, 2].map(
    (digits) =>
      new Intl.NumberFormat(locale, {
        ...grouping,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
  );
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const twoDigits = new Intl.NumberFormat(locale, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  const plain = new Intl.NumberFormat(locale, { useGrouping: false });

  const formatNumber = (value: number) =>
    Number.isFinite(value) ? integer.format(value) : UNAVAILABLE;

  function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return UNAVAILABLE;
    if (bytes < 1024) return `${integer.format(Math.floor(bytes))} B`;

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
    return `${sized[decimals].format(truncated)} ${units[index]}`;
  }

  const formatPercent = (value: number) =>
    Number.isFinite(value) ? percent.format(value / 100) : UNAVAILABLE;

  function formatDuration(milliseconds: number): string {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return UNAVAILABLE;
    const total = Math.floor(milliseconds / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total / 60) % 60;
    const seconds = total % 60;
    return hours > 0
      ? `${plain.format(hours)}:${twoDigits.format(minutes)}:${twoDigits.format(seconds)}`
      : `${plain.format(minutes)}:${twoDigits.format(seconds)}`;
  }

  return { locale, formatNumber, formatBytes, formatPercent, formatDuration };
}

function isSupported(locale: unknown): locale is string {
  if (typeof locale !== "string" || !locale) return false;
  try {
    return Intl.NumberFormat.supportedLocalesOf(locale).length > 0;
  } catch {
    return false;
  }
}

/**
 * The desktop app passes the system's regional format; a browser preview uses
 * the browser's own language. The interface language plays no part.
 */
export function resolveNumberLocale(
  candidates: unknown[] = [
    globalThis.window?.storageAnalyzer?.numberLocale,
    globalThis.navigator?.language,
  ],
): string {
  return candidates.find(isSupported) ?? "en-US";
}

const formatters = createFormatters(resolveNumberLocale());
export const numberLocale = formatters.locale;
export const formatNumber = formatters.formatNumber;
export const formatBytes = formatters.formatBytes;
export const formatPercent = formatters.formatPercent;
export const formatDuration = formatters.formatDuration;

export const percentOf = (part: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, (part / total) * 100)) : 0;
