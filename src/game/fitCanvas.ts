/**
 * Prefer integer CSS scale; when that wastes too much viewport, fall back to
 * smooth scale (slightly soft, never mixed pixel sizes).
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  GW: number,
  GH: number,
): { scale: number; useInt: boolean; w: number; h: number } {
  const vw = window.visualViewport?.width ?? window.innerWidth
  const vh = window.visualViewport?.height ?? window.innerHeight
  const s = Math.min(vw / GW, vh / GH)
  const i = Math.floor(s)
  const useInt = i >= 1 && i / s >= 0.8
  const scale = useInt ? i : s
  const w = Math.round(GW * scale)
  const h = Math.round(GH * scale)
  Object.assign(canvas.style, {
    position: 'absolute',
    width: `${w}px`,
    height: `${h}px`,
    left: `${Math.round((vw - w) / 2)}px`,
    top: `${Math.round((vh - h) / 2)}px`,
    imageRendering: useInt ? 'pixelated' : 'auto',
  })
  document.body.dataset.scaleZoom = String(scale)
  document.body.dataset.scaleFractional = useInt ? '0' : '1'
  ;(
    window as unknown as {
      __SAKE_SCALE__: { zoom: number; fractional: boolean; cssW: number; cssH: number }
    }
  ).__SAKE_SCALE__ = { zoom: scale, fractional: !useInt, cssW: w, cssH: h }
  return { scale, useInt, w, h }
}

export function installFit(
  game: { canvas: HTMLCanvasElement },
  GW: number,
  GH: number,
): () => void {
  const run = () => fitCanvas(game.canvas, GW, GH)
  run()
  window.addEventListener('resize', run)
  window.addEventListener('orientationchange', () => setTimeout(run, 200))
  window.visualViewport?.addEventListener('resize', run)
  return run
}
