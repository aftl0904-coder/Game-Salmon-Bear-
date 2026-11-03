/** Ground-only spans for visual overlays; does not change terrain or collision. */
export function groundVisualSpans(
  x0: number,
  x1: number,
  pits: ReadonlyArray<{ x0: number; x1: number }>,
): Array<{ x0: number; x1: number }> {
  let spans = x1 > x0 ? [{ x0, x1 }] : []
  for (const pit of pits) {
    spans = spans.flatMap((s) => {
      if (pit.x1 <= s.x0 || pit.x0 >= s.x1) return [s]
      const result: Array<{ x0: number; x1: number }> = []
      if (pit.x0 > s.x0) result.push({ x0: s.x0, x1: Math.min(pit.x0, s.x1) })
      if (pit.x1 < s.x1) result.push({ x0: Math.max(pit.x1, s.x0), x1: s.x1 })
      return result
    })
  }
  return spans
}
