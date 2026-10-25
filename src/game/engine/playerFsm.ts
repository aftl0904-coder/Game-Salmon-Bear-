/**
 * Explicit player FSM — Entry / Update / Exit (structural rewrite).
 *
 *   IDLE ←→ MOVE
 *     ↓       ↓
 *   JUMP / LANE_SWAP / ATTACK / HURT
 *     ↓
 *   (timeout ~800ms) → force IDLE + grounded recover
 *
 * JUMP / LANE_SWAP must never freeze mid-air.
 */

import type Phaser from 'phaser'
import { laneY, type LaneId } from './lanes'

export type PlayerFsm =
  | 'IDLE'
  | 'MOVE'
  | 'JUMP'
  | 'LANE_SWAP'
  | 'HURT'
  | 'ATTACK'
  | 'DIE'

export const FSM_TIMEOUT_MS = 800

export type PlayerFsmHost = {
  fsm: PlayerFsm
  fsmEnterAt: number
  lane: LaneId
  laneJumping: boolean
  laneCd: number
  laneBuf: number
  jumpConsumed: boolean
  justLanded: boolean
  hurtLock: number
  hp: number
  alive: boolean
  y: number
  setY: (y: number) => unknown
}

export type FsmUpdateCtx = {
  now: number
  grounded: boolean
  vx: number
  body: Phaser.Physics.Arcade.Body
  meleeActive: boolean
  atkCd: number
}

type StateHooks = {
  enter?: (h: PlayerFsmHost, now: number, prev: PlayerFsm) => void
  update?: (h: PlayerFsmHost, ctx: FsmUpdateCtx) => PlayerFsm | void
  exit?: (h: PlayerFsmHost, next: PlayerFsm) => void
}

function forceLand(h: PlayerFsmHost, body: Phaser.Physics.Arcade.Body) {
  const target = laneY(h.lane)
  h.setY(target)
  body.velocity.y = 0
  body.allowGravity = false
  h.laneJumping = false
  h.jumpConsumed = false
  h.justLanded = true
  h.laneCd = 0
  h.laneBuf = 0
}

function timedOut(h: PlayerFsmHost, now: number) {
  return h.fsmEnterAt > 0 && now - h.fsmEnterAt >= FSM_TIMEOUT_MS
}

function loco(vx: number): PlayerFsm {
  return Math.abs(vx) > 12 ? 'MOVE' : 'IDLE'
}

const STATES: Record<PlayerFsm, StateHooks> = {
  IDLE: {
    update(h, ctx) {
      if (h.hp <= 0 || !h.alive) return 'DIE'
      if (h.hurtLock > 0) return 'HURT'
      if (!ctx.grounded || h.laneJumping) return 'JUMP'
      return loco(ctx.vx)
    },
  },
  MOVE: {
    update(h, ctx) {
      if (h.hp <= 0 || !h.alive) return 'DIE'
      if (h.hurtLock > 0) return 'HURT'
      if (!ctx.grounded || h.laneJumping) return 'JUMP'
      return loco(ctx.vx)
    },
  },
  JUMP: {
    enter(h) {
      if (!h.laneJumping) h.laneJumping = true
    },
    update(h, ctx) {
      if (h.hp <= 0 || !h.alive) return 'DIE'
      if (h.hurtLock > 0) return 'HURT'
      if (ctx.grounded && !h.laneJumping) return loco(ctx.vx)
      if (timedOut(h, ctx.now)) {
        forceLand(h, ctx.body)
        return 'IDLE'
      }
    },
    exit(h, next) {
      if (next === 'IDLE' || next === 'MOVE') h.laneJumping = false
    },
  },
  LANE_SWAP: {
    update(h, ctx) {
      if (h.hp <= 0 || !h.alive) return 'DIE'
      if (h.hurtLock > 0) return 'HURT'
      const target = laneY(h.lane)
      if (Math.abs(h.y - target) < 2 || timedOut(h, ctx.now)) {
        h.setY(target)
        ctx.body.velocity.y = 0
        ctx.body.allowGravity = false
        h.laneJumping = false
        h.laneBuf = 0
        return loco(ctx.vx)
      }
    },
  },
  HURT: {
    update(h, ctx) {
      if (h.hp <= 0 || !h.alive) return 'DIE'
      if (h.hurtLock > 0) return
      if (!ctx.grounded || h.laneJumping) return 'JUMP'
      return loco(ctx.vx)
    },
  },
  ATTACK: {
    update(h, ctx) {
      if (h.hp <= 0 || !h.alive) return 'DIE'
      if (h.hurtLock > 0) return 'HURT'
      if (!ctx.meleeActive && ctx.atkCd <= 80) {
        if (!ctx.grounded || h.laneJumping) return 'JUMP'
        return loco(ctx.vx)
      }
      if (timedOut(h, ctx.now)) {
        if (!ctx.grounded || h.laneJumping) return 'JUMP'
        return loco(ctx.vx)
      }
    },
  },
  DIE: {
    update(h) {
      if (h.alive && h.hp > 0) return 'IDLE'
    },
  },
}

export function fsmEnter(h: PlayerFsmHost, next: PlayerFsm, now: number) {
  if (h.fsm === next) return
  const prev = h.fsm
  STATES[prev]?.exit?.(h, next)
  h.fsm = next
  h.fsmEnterAt = now
  STATES[next]?.enter?.(h, now, prev)
}

export function fsmUpdate(h: PlayerFsmHost, ctx: FsmUpdateCtx) {
  const next = STATES[h.fsm]?.update?.(h, ctx)
  if (next && next !== h.fsm) fsmEnter(h, next, ctx.now)
}
