import { galleryMarkFriend, galleryMarkStageClear, galleryMarkStageEnter, galleryMarkC2Ending } from './galleryUnlock'
import { c3Enabled } from './c2Gate'

/** Battery-save style progress: the furthest stage reached (stored in this browser). */
const KEY = 'sake-kuma-progress-v1'
const RUN_KEY = 'sake-kuma-run-v1'
const C3_MIGRATE_KEY = 'sake-kuma-c3-migrate-v1'

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
    const prev = maxStage()
    if (n > prev) localStorage.setItem(KEY, JSON.stringify({ maxStage: n }))
    // Gallery: entering `n` + clearing `n-1` (durable; survives 重新開始).
    galleryMarkStageEnter(n)
    if (n > 1) galleryMarkStageClear(n - 1)
  } catch {
    /* private mode — progress just isn't kept */
  }
}

/**
 * release-1: old saves that stopped at stage-7「待續」can continue into stage 8
 * once c3 is on. Safe to call every boot; runs once per browser when eligible.
 */
export function migrateC3Progress() {
  if (!c3Enabled()) return
  try {
    if (localStorage.getItem(C3_MIGRATE_KEY) === '1') {
      // Still ensure unlock if they somehow regressed.
      if (maxStage() >= 7) unlockStage(8)
      return
    }
    let eligible = maxStage() >= 7
    try {
      const raw = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null')
      if (raw && typeof raw === 'object') {
        const next = Number((raw as { nextStage?: number }).nextStage)
        const last = Number((raw as { lastCleared?: number }).lastCleared)
        if (next >= 8 || last >= 7) eligible = true
        // Bump run pointer so menu lands on stage 8 when they were parked at 待續.
        if (last >= 7 && (!Number.isFinite(next) || next < 8)) {
          ;(raw as { nextStage: number }).nextStage = 8
          localStorage.setItem(RUN_KEY, JSON.stringify(raw))
        }
      }
    } catch {
      /* ignore run parse */
    }
    if (eligible) {
      unlockStage(8)
      localStorage.setItem(C3_MIGRATE_KEY, '1')
    }
  } catch {
    /* private mode */
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
    galleryMarkFriend(id)
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
    galleryMarkC2Ending()
    galleryMarkStageClear(10)
  } catch {
    /* private mode */
  }
}
