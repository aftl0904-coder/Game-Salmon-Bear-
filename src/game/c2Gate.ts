/** Alan confirmed continent 2 is public in the first release.
 * Old ?c2=0/1 browser-test flags no longer hide or unlock content. */
export function c2Enabled(): boolean {
  return true
}

/**
 * Stage 8+ / continent-3 gate. Default off so Christmas release still ends at
 * stage 7 → 待續 → 聖誕番外 → credits. Opt in with `?c3=1`.
 */
export function c3Enabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('c3') === '1'
  } catch {
    return false
  }
}
