/**
 * Left-to-right layout: place items by measured width with a fixed gap.
 * Returns the x just past the last item (not including trailing gap).
 */
export type RowItem = {
  /** Occupied width in px (including padding inside the item). */
  width: number
  /** Place the item with its left edge at `x`. */
  place: (x: number) => void
}

export function layoutRow(items: RowItem[], startX: number, gap = 6): number {
  let x = startX
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!
    it.place(x)
    x += it.width
    if (i < items.length - 1) x += gap
  }
  return x
}

/** Right-to-left mirror of layoutRow (for P2 HUD). */
export function layoutRowMirror(items: RowItem[], endX: number, gap = 6): number {
  let x = endX
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!
    x -= it.width
    it.place(x)
    if (i < items.length - 1) x -= gap
  }
  return x
}

export type HudBound = {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

export function boundsOverlap(a: HudBound, b: HudBound): boolean {
  return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
}

export function findOverlaps(bounds: HudBound[]): { a: string; b: string }[] {
  const hits: { a: string; b: string }[] = []
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const A = bounds[i]!
      const B = bounds[j]!
      if (boundsOverlap(A, B)) hits.push({ a: A.id, b: B.id })
    }
  }
  return hits
}
