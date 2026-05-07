/**
 * Formats DN (diâmetro nominal) for display.
 * If stored value < 25, treats it as meters and converts to mm (×1000).
 * Otherwise, assumes it's already in mm.
 * Returns string with " mm" suffix, or "—" when null/invalid.
 */
export function formatDN(value: unknown): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (isNaN(n)) return '—';
  const mm = n < 25 ? n * 1000 : n;
  // Round to nearest int for clean display
  return `${Math.round(mm)} mm`;
}
