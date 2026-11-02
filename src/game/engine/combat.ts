import type Phaser from 'phaser'
import { HURT_IFRAME_MS, HURT_LOCK_MS, MAX_HP } from './constants'
import { setDiePoseVisual, setHurtPoseVisual, setPixelPose } from '../pixelSnap'

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

/** 連擊特殊招 super armor: damage still lands, but no hurt pose / lock / knockback. */
export function hasSuperArmor(h: Phaser.GameObjects.GameObject, now: number): boolean {
  return now < ((h.getData('superArmorUntil') as number | undefined) ?? 0)
}

/** Apply HP loss + knockback + hurt lock. Returns remaining HP (may be 0). */
export function applyDamage(h: CombatActor, opts: DamageOpts): number {
  const amount = opts.amount ?? 1
  h.hp = Math.max(0, h.hp - amount)
  h.hurtCd = opts.iframeMs ?? HURT_IFRAME_MS
  if (hasSuperArmor(h, opts.now) && h.hp > 0) {
    h.setTint(0xffa0a0)
    return h.hp
  }
  h.hurtLock = opts.lockMs ?? HURT_LOCK_MS
  h.pose = 'hurt'
  if (opts.knockbackX !== undefined) h.setVelocityX(opts.knockbackX)
  if (opts.knockbackY !== undefined) h.setVelocityY(opts.knockbackY)
  h.setTint(0xff4444)
  return h.hp
}

/** Visual hurt squash — SNES hit reaction (pixel-safe, no micro-shear). */
export function applyHurtPose(h: CombatActor, dir: number = -1) {
  if (hasSuperArmor(h, h.scene.time.now) && h.hp > 0) return
  h.pose = 'hurt'
  h.hurtLock = Math.max(h.hurtLock, HURT_LOCK_MS)
  h.facing = dir < 0 ? -1 : 1
  h.setFlipX(h.facing < 0)
  h.setTint(0xff4444)
  setHurtPoseVisual(h, h.baseScale, h.facing)
}

/** Clear hurt visuals once lock expires (caller drives lock via dt). */
export function clearHurtPoseIfReady(h: CombatActor, grounded: boolean) {
  if (h.pose !== 'hurt' || h.hurtLock > 0 || h.hp <= 0) return
  h.pose = grounded ? 'idle' : 'jump'
  h.clearTint()
  setPixelPose(h, h.baseScale)
}

/** Begin death presentation (caller triggers lose / continue UI). */
export function beginDeathPose(h: CombatActor) {
  h.alive = false
  h.pose = 'die'
  h.hp = 0
  h.hurtLock = 99999
  h.setVelocity(h.facing * -60, -140)
  h.setTint(0x884444)
  setDiePoseVisual(h, h.baseScale, h.facing)
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
  setPixelPose(h, h.baseScale)
  h.setPosition(Math.round(x), Math.round(y))
  h.setVelocity(0, 0)
  h.setActive(true)
  h.setVisible(true)
}

export function tickCombatTimers(h: CombatActor, dt: number) {
  h.hurtCd = Math.max(0, h.hurtCd - dt)
  h.hurtLock = Math.max(0, h.hurtLock - dt)
}
