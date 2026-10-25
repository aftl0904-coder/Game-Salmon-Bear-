/** Snap a display scale to {1,2,3} — never fractional for pixel sprites. */
export function intScale(n: number): number {
  if (!Number.isFinite(n)) return 1
  const r = Math.round(Math.abs(n))
  return Math.max(1, Math.min(3, r || 1))
}
