/**
 * Continent / stage gates (release-1).
 * Default ON. Only `?c2=0` / `?c3=0` turns a gate off (test hook).
 */

export function c2Enabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('c2') !== '0'
  } catch {
    return true
  }
}

/** Stage 8–10. Default on; `?c3=0` keeps the old stage-7 end for tests. */
export function c3Enabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('c3') !== '0'
  } catch {
    return true
  }
}
