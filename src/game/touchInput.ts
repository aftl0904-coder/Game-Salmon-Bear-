/**
 * Shared virtual-pad state for phone landscape play.
 * UIScene writes; GameScene / menus read.
 */
export type TouchBtn =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'crouch'
  | 'attack'
  | 'jump'
  | 'special'
  | 'start'

const held: Record<TouchBtn, boolean> = {
  left: false,
  right: false,
  up: false,
  down: false,
  crouch: false,
  attack: false,
  jump: false,
  special: false,
  start: false,
}

const just: Record<TouchBtn, boolean> = {
  left: false,
  right: false,
  up: false,
  down: false,
  crouch: false,
  attack: false,
  jump: false,
  special: false,
  start: false,
}

export const TouchInput = {
  set(btn: TouchBtn, down: boolean) {
    if (down && !held[btn]) just[btn] = true
    held[btn] = down
  },
  isDown(btn: TouchBtn) {
    return held[btn]
  },
  justPressed(btn: TouchBtn) {
    if (!just[btn]) return false
    just[btn] = false
    return true
  },
  peekJust(btn: TouchBtn) {
    return just[btn]
  },
  clearAll() {
    for (const k of Object.keys(held) as TouchBtn[]) {
      held[k] = false
      just[k] = false
    }
  },
}

/** True when we should show on-screen controls + fit-to-phone scaling. */
export function isPhonePlay(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const touch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0
  const shortLandscape =
    window.matchMedia('(orientation: landscape)').matches &&
    Math.min(window.innerWidth, window.innerHeight) <= 520
  return coarse || (touch && shortLandscape) || (touch && window.innerWidth <= 1100)
}
