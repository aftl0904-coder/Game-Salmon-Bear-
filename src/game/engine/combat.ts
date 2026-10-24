import type Phaser from 'phaser'
import { HURT_IFRAME_MS, HURT_LOCK_MS, MAX_HP } from './constants'

export type CombatActor = Phaser.Physics.Arcade.Sprite & {
  hp: number
  facing: 1 | -1
  hurtCd: number
  hurtLock: number
  grace: number
  pose: string
  alive: boolean
  baseScale: number
  role?: string
}

export type DamageOpts = {
  amount?: number
  knockbackX?: number
  knockbackY?: number
  iframeMs?: number
  lockMs?: number
  now: number
}

/** Invulnerable while grace / hurt iframe / dead / already dying. */
export function canTakeDamage(h: CombatActor, now: number): boolean {
  if (!h.alive || h.hp <= 0 || h.pose === 'die') return false
  if (now < h.grace) return false
  if (h.hurtCd > 0) return false
  return true
}

/** Apply HP loss + knockback + hurt lock. Returns remaining HP (may be 0). */
export function applyDamage(h: CombatActor, opts: DamageOpts): number {
  const amount = opts.amount ?? 1
  h.hp = Math.max(0, h.hp - amount)
  h.hurtCd = opts.iframeMs ?? HURT_IFRAME_MS
  h.hurtLock = opts.lockMs ?? HURT_LOCK_MS
  h.pose = 'hurt'
  if (opts.knockbackX !== undefined) h.setVelocityX(opts.knockbackX)
  if (opts.knockbackY !== undefined) h.setVelocityY(opts.knockbackY)
  h.setTint(0xff4444)
  return h.hp
}

/** Visual hurt squash — SNES hit reaction. */
export function applyHurtPose(h: CombatActor, dir: number = -1) {
  h.pose = 'hurt'
  h.hurtLock = Math.max(h.hurtLock, HURT_LOCK_MS)
  h.facing = dir < 0 ? -1 : 1
  h.setFlipX(h.facing < 0)
  h.setTint(0xff4444)
  h.setAngle(h.facing * -22)
  h.setScale(h.baseScale * 1.1, h.baseScale * 0.86)
}

/** Clear hurt visuals once lock expires (caller drives lock via dt). */
export function clearHurtPoseIfReady(h: CombatActor, grounded: boolean) {
  if (h.pose !== 'hurt' || h.hurtLock > 0 || h.hp <= 0) return
  h.pose = grounded ? 'idle' : 'jump'
  h.clearTint()
  h.setAngle(0)
  h.setScale(h.baseScale)
}

/** Begin death presentation (caller triggers lose / continue UI). */
export function beginDeathPose(h: CombatActor) {
  h.alive = false
  h.pose = 'die'
  h.hp = 0
  h.hurtLock = 99999
  h.setVelocity(h.facing * -60, -140)
  h.setTint(0x884444)
  h.setAngle(h.facing * 90)
  h.setScale(h.baseScale * 1.05, h.baseScale * 0.7)
}

/** Full restore after coin continue. */
export function reviveActor(h: CombatActor, x: number, y: number, now: number, graceMs = 2000) {
  h.hp = MAX_HP
  h.pose = 'idle'
  h.alive = true
  h.hurtCd = 0
  h.hurtLock = 0
  h.grace = now + graceMs
  h.clearTint()
  h.setAngle(0)
  h.setScale(h.baseScale)
  h.setPosition(x, y)
  h.setVelocity(0, 0)
  h.setActive(true)
  h.setVisible(true)
}

export function tickCombatTimers(h: CombatActor, dt: number) {
  h.hurtCd = Math.max(0, h.hurtCd - dt)
  h.hurtLock = Math.max(0, h.hurtLock - dt)
}
