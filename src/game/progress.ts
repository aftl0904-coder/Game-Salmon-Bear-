/** Battery-save style progress: the furthest stage reached (stored in this browser). */
const KEY = 'sake-kuma-progress-v1'

export function maxStage(): number {
  try {
    const n = Number(JSON.parse(localStorage.getItem(KEY) ?? '{}').maxStage)
    return n >= 1 ? n : 1
  } catch {
    return 1
  }
}

export function unlockStage(n: number) {
  try {
    if (n > maxStage()) localStorage.setItem(KEY, JSON.stringify({ maxStage: n }))
  } catch {
    /* private mode — progress just isn't kept */
  }
}
