/** A viewport slice of a stage-7 world segment, using logical integer pixels. */
export function stage7ViewportSlice(x0: number, x1: number, scrollX: number, viewWidth: number) {
  // The camera may be on a half-logical-pixel at 2x render scale. Use the same
  // rounded viewport for every segment: adjacent slices cannot overlap or gap.
  const cameraLeft = Math.round(scrollX)
  const leftWorld = Math.max(x0, cameraLeft)
  const rightWorld = Math.min(x1, cameraLeft + viewWidth)
  if (rightWorld <= leftWorld) return null
  return {
    x: leftWorld - cameraLeft,
    width: rightWorld - leftWorld,
    // Tiling is anchored to the segment's world start, not to the viewport.
    tileX: leftWorld - x0,
  }
}
