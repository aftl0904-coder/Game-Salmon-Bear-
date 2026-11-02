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

/** 噗噗's picnic friends rescued by hand (for the perfect ending). */
const FKEY = 'sake-kuma-friends-v1'

export function savedFriends(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(FKEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function markFriendSaved(id: string) {
  try {
    const s = new Set(savedFriends())
    s.add(id)
    localStorage.setItem(FKEY, JSON.stringify([...s]))
  } catch {
    /* private mode */
  }
}

/** Set once 第二大陸 is cleared (the same flag the main menu's 「重溫快樂結局」 reads): the 大陸2 world map turns green. */
const C2KEY = 'sake-kuma-c2-cleared-v1'

export function c2Cleared(): boolean {
  try {
    return localStorage.getItem(C2KEY) === '1'
  } catch {
    return false
  }
}

export function markC2Cleared() {
  try {
    localStorage.setItem(C2KEY, '1')
  } catch {
    /* private mode */
  }
}
