const numberFormatter = new Intl.NumberFormat("en-US");
export const formatNumber = (value: number) => numberFormatter.format(value);
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${numberFormatter.format(Number((bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)))} ${units[index]}`;
}
export const percentOf = (part: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, (part / total) * 100)) : 0;
