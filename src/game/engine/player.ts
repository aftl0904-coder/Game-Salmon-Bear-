import Phaser from 'phaser'
import {
  JUMP_V,
  JUMP_BUF_MS,
  JUMP_CUT,
  COYOTE_MS,
  RUN_ACCEL,
  RUN_FRICTION,
  AIR_ACCEL_MUL,
  FALL_GRAVITY_MUL,
  GRAVITY_Y,
  MAX_FALL,
} from './constants'
import { resolveStick } from './collision'

export type ControllableHero = Phaser.Physics.Arcade.Sprite & {
  facing: 1 | -1
  coyote: number
  jumpBuf: number
  jumpConsumed: boolean
  wasGrounded: boolean
  hurtLock: number
  hp: number
  alive: boolean
  atkCd: number
  walkPhase: number
  pose: string
  baseScale: number
  jumpCutApplied?: boolean
}

export type SteerOpts = {
  dt: number
  left: boolean
  right: boolean
  jumpJust: boolean
  jumpHeld: boolean
  speed: number
  attackJust: boolean
  doAttack: () => void
  onJump?: () => void
  onLand?: () => void
  applyPose: (h: ControllableHero, grounded: boolean, vx: number) => void
}

export function canStartJump(body: Phaser.Physics.Arcade.Body): boolean {
  if (!(body.blocked.down || body.touching.down)) return false
  return body.velocity.y >= 0
}

/** Shared SNES-weight steer for non-lane arcade heroes (keep in sync with Player). */
export function steerArcadeHero(h: ControllableHero, opts: SteerOpts) {
  const body = h.body as Phaser.Physics.Arcade.Body
  resolveStick(body)
  body.setMaxVelocity(opts.speed + 60, MAX_FALL)

  const grounded = canStartJump(body)
  if (grounded) {
    h.jumpConsumed = false
    h.coyote = COYOTE_MS
    h.jumpCutApplied = false
    body.setGravity(0, 0)
  } else {
    h.coyote = Math.max(0, h.coyote - opts.dt)
    if (body.velocity.y > 0) {
      body.setGravity(0, GRAVITY_Y * (FALL_GRAVITY_MUL - 1))
    } else {
      body.setGravity(0, 0)
    }
  }

  if (opts.jumpJust) h.jumpBuf = JUMP_BUF_MS
  else h.jumpBuf = Math.max(0, h.jumpBuf - opts.dt)

  if (h.hurtLock > 0 || h.hp <= 0 || !h.alive) {
    if (h.hurtLock > 0 && grounded) h.setVelocityX(body.velocity.x * 0.82)
    opts.applyPose(h, grounded, 0)
    return
  }

  const dtSec = opts.dt / 1000
  let target = 0
  if (opts.left) target -= opts.speed
  if (opts.right) target += opts.speed

  const accel = grounded ? RUN_ACCEL : RUN_ACCEL * AIR_ACCEL_MUL
  let vx = body.velocity.x
  if (target !== 0) {
    const step = accel * dtSec
    if (vx < target) vx = Math.min(target, vx + step)
    else if (vx > target) vx = Math.max(target, vx - step)
    h.facing = target > 0 ? 1 : -1
    h.setFlipX(h.facing < 0)
  } else if (grounded) {
    const damp = RUN_FRICTION * dtSec
    if (Math.abs(vx) <= damp) vx = 0
    else vx -= Math.sign(vx) * damp
  }
  vx = Phaser.Math.Clamp(vx, -opts.speed, opts.speed)
  h.setVelocityX(vx)

  if (h.jumpBuf > 0 && !h.jumpConsumed && (canStartJump(body) || h.coyote > 0)) {
    h.setVelocityY(JUMP_V)
    h.jumpBuf = 0
    h.coyote = 0
    h.jumpConsumed = true
    h.jumpCutApplied = false
    opts.onJump?.()
  }

  if (!opts.jumpHeld && !h.jumpCutApplied && body.velocity.y < -80) {
    h.setVelocityY(body.velocity.y * JUMP_CUT)
    h.jumpCutApplied = true
  }

  if (!h.wasGrounded && grounded) opts.onLand?.()
  h.wasGrounded = grounded

  if (h.atkCd <= 0 && opts.attackJust) opts.doAttack()
  opts.applyPose(h, grounded, vx)
}
