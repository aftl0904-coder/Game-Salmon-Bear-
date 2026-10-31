import type Phaser from 'phaser'
import { TouchInput, type TouchBtn } from './touchInput'

/**
 * Gamepad support for every screen (title, menus, cutscenes, pause, continue, play).
 * Polls the browser Gamepad API once per game step — works for USB/Bluetooth pads on
 * Windows and for controllers paired to a phone — and drives the shared virtual pad
 * (TouchInput) for player 1. The second connected pad is player 2 (read by GameScene).
 *
 * Standard layout (Xbox names / SNES position):
 *   A (bottom)  = 跳          B (right) = 攻
 *   X (left)    = 攻          Y (top)   = 絕招
 *   LB / RB     = 絕招         Start / Back = 開始・暫停・投幣
 *   LT (index 6) = 武器切換（倫寶連射/重擊、琪寶寶快劍/重劍）
 *   D-pad or left stick = move (down = 蹲)
 */

const DEAD = 0.5

export function connectedPads(): Gamepad[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return []
  return Array.from(navigator.getGamepads()).filter((p): p is Gamepad => !!p && p.connected)
}

/** Player 2's controller (the second one connected), fresh each call. */
export function p2Pad(): Gamepad | null {
  return connectedPads()[1] ?? null
}

export function btn(p: Gamepad | null, i: number) {
  const b = p?.buttons[i]
  return !!b && (b.pressed || b.value > 0.5)
}

/** Horizontal / vertical direction from D-pad or left stick: -1, 0, 1 (or stick value). */
export function padDir(p: Gamepad | null, horiz: boolean): number {
  if (!p) return 0
  if (horiz) {
    if (btn(p, 14)) return -1
    if (btn(p, 15)) return 1
    return p.axes[0] ?? 0
  }
  if (btn(p, 12)) return -1
  if (btn(p, 13)) return 1
  return p.axes[1] ?? 0
}

export function installGamepadBridge(game: Phaser.Game) {
  let hadPad = false
  const poll = () => {
    const p = connectedPads()[0] ?? null
    if (!p) {
      if (hadPad) for (const b of ['left', 'right', 'up', 'down', 'crouch', 'attack', 'jump', 'special', 'weaponSwitch', 'start'] as TouchBtn[]) TouchInput.setPad(b, false)
      hadPad = false
      return
    }
    hadPad = true
    const x = padDir(p, true)
    const y = padDir(p, false)
    TouchInput.setPad('left', x < -DEAD)
    TouchInput.setPad('right', x > DEAD)
    TouchInput.setPad('up', y < -DEAD)
    TouchInput.setPad('down', y > DEAD)
    TouchInput.setPad('crouch', y > DEAD)
    TouchInput.setPad('jump', btn(p, 0))
    TouchInput.setPad('attack', btn(p, 1) || btn(p, 2))
    TouchInput.setPad('special', btn(p, 3) || btn(p, 4) || btn(p, 5))
    // Weapon-switch: index 6 — LT/L2 on the standard gamepad layout (NOT "R1"; that's
    // index 5, already claimed by special below, per Cursor's device-testing pass).
    // 0/1/2/3/4/5 are jump/attack/special and 8/9 are start, so 6 is the first free one.
    TouchInput.setPad('weaponSwitch', btn(p, 6))
    TouchInput.setPad('start', btn(p, 9) || btn(p, 8))
  }
  game.events.on('prestep', poll)
}
