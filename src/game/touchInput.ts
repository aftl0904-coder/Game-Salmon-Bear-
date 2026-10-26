/**
 * Shared virtual-pad state, fed by two sources:
 *  - the on-screen touch buttons (phone landscape play)
 *  - the first connected gamepad (see gamepadBridge.ts) — phone or PC controller
 * Menus, cutscenes, pause and the continue screen read only this, so one code path
 * covers keyboard-less play. GameScene also reads it for player 1.
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
  /** Back to the menu (game-over screen button). */
  | 'menu'

const BTNS: TouchBtn[] = ['left', 'right', 'up', 'down', 'crouch', 'attack', 'jump', 'special', 'start', 'menu']
const mk = <T>(v: T) => Object.fromEntries(BTNS.map((b) => [b, v])) as Record<TouchBtn, T>

const touchHeld = mk(false)
const padHeld = mk(false)
/** Time of the last rising edge (0 = consumed). A press older than JUST_MS goes stale, so a
 * button pressed during play can't fire a menu that opens seconds later. */
const justAt = mk(0)
const JUST_MS = 250

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function apply(btn: TouchBtn, src: Record<TouchBtn, boolean>, down: boolean) {
  const before = touchHeld[btn] || padHeld[btn]
  src[btn] = down
  const after = touchHeld[btn] || padHeld[btn]
  if (after && !before) justAt[btn] = now()
}

export const TouchInput = {
  /** On-screen button state. */
  set(btn: TouchBtn, down: boolean) {
    apply(btn, touchHeld, down)
  },
  /** Gamepad state (gamepadBridge). */
  setPad(btn: TouchBtn, down: boolean) {
    apply(btn, padHeld, down)
  },
  /** One-shot press (tap on a text button). */
  pulse(btn: TouchBtn) {
    justAt[btn] = now()
  },
  isDown(btn: TouchBtn) {
    return touchHeld[btn] || padHeld[btn]
  },
  justPressed(btn: TouchBtn) {
    const t = justAt[btn]
    if (!t) return false
    justAt[btn] = 0
    return now() - t <= JUST_MS
  },
  peekJust(btn: TouchBtn) {
    return !!justAt[btn] && now() - justAt[btn] <= JUST_MS
  },
  clearAll() {
    for (const k of BTNS) {
      touchHeld[k] = false
      justAt[k] = 0
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
