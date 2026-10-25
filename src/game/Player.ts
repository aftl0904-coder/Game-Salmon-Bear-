import Phaser from 'phaser'
import { bindFootBody } from './footBody'
import {
  AIR_ACCEL_MUL,
  BOY_SPEED,
  COYOTE_MS,
  GIRL_SPEED,
  HURT_IFRAME_MS,
  HURT_LOCK_MS,
  JUMP_BUF_MS,
  JUMP_V,
  LANE_DEFAULT,
  LANE_SNAP_SPEED,
  LANE_SWITCH_MS,
  MAX_HP,
  RUN_ACCEL,
  RUN_FRICTION,
  clampLane,
  inLaneBand,
  isGrounded,
  isLaneGrounded,
  actorDepth,
  laneY,
  resolveStick,
  type LaneId,
} from './engine'
import { EventBus, GameEvents } from './EventBus'
import {
  enablePixelSprite,
  setDiePoseVisual,
  setHurtPoseVisual,
  setIdlePose,
  setJumpPose,
  setPixelPose,
  setRunPose,
} from './pixelSnap'

export type HeroPose = 'idle' | 'run' | 'jump' | 'hurt' | 'die'
export type PlayerRole = 'boy' | 'girl'

export type PlayerConfig = {
  role: PlayerRole
  texture: string
  /** Move speed; girl defaults to 1.5× boy. */
  speed?: number
  scale?: number
  bodyW?: number
  bodyH?: number
  graceUntil?: number
}

/** Hurtbox (player body) debug — blue. Attack hitbox — green. */
export const HURTBOX_DEBUG = 0x4488ff
export const HITBOX_DEBUG = 0x44ff66

const MELEE_MS = 150
const MELEE_W = 36
const MELEE_H = 40
const MELEE_OFFSET_X = 34
const MELEE_OFFSET_Y = -28

/**
 * Arcade player (倫寶 / 琪寶寶):
 * side-view 上／中／下 lanes + accel run, coyote/jump buffer,
 * melee hitbox 150ms, i-frames 1.5s with alpha flash.
 *
 * W/S or ↑/↓ = lane switch when grounded; jump (Ｋ／２) stays in-lane vertical.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  hp = MAX_HP
  facing: 1 | -1 = 1
  atkCd = 0
  hurtCd = 0
  hurtLock = 0
  grace = 0
  role: PlayerRole = 'boy'
  baseScale = 1.8
  coyote = 0
  jumpBuf = 0
  /** Latched after jump until true landing (prevents sticky mid-air re-arm). */
  jumpConsumed = false
  walkPhase = 0
  wasGrounded = true
  pose: HeroPose = 'idle'
  alive = true
  awaitingContinue = false
  moveSpeed = BOY_SPEED
  /** 上=0／中=1／下=2 — hits only connect on shared lane. */
  lane: LaneId = LANE_DEFAULT
  laneCd = 0
  laneJumping = false

  /** Active melee probe (disabled when idle). */
  attackHitbox!: Phaser.Physics.Arcade.Image
  private attackUntil = 0
  private flashTween?: Phaser.Tweens.Tween
  private justLanded = false
  /**
   * Buffered lane intent (−1 上 / +1 下). Survives laneCd so a tap during
   * cooldown is not eaten; cleared on apply.
   */
  private laneBuf = 0
  /**
   * After a step, ignore held input until release — one lane per press
   * (held S cannot skip 中 → 下).
   */
  private laneHeldLock = false

  static preloadHitboxTexture(scene: Phaser.Scene) {
    if (scene.textures.exists('__atk-hitbox')) return
    const g = scene.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff, 1)
    g.fillRect(0, 0, MELEE_W, MELEE_H)
    g.generateTexture('__atk-hitbox', MELEE_W, MELEE_H)
    g.destroy()
  }

  static spawn(scene: Phaser.Scene, x: number, y: number, cfg: PlayerConfig): Player {
    Player.preloadHitboxTexture(scene)
    const p = new Player(scene, x, y, cfg.texture)
    scene.add.existing(p)
    scene.physics.add.existing(p)
    p.initFromConfig(cfg)
    return p
  }

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture)
  }

  private initFromConfig(cfg: PlayerConfig) {
    this.role = cfg.role
    this.hp = MAX_HP
    this.facing = 1
    this.atkCd = 0
    this.hurtCd = 0
    this.hurtLock = 0
    this.grace = cfg.graceUntil ?? 0
    // Integer scale keeps NEAREST sampling stable (Phaser 4 safeAuto only
    // rounds when scale===1; non-integer scale shreds columns during motion).
    this.baseScale = cfg.scale ?? (cfg.role === 'girl' ? 2 : 2)
    this.moveSpeed = cfg.speed ?? (cfg.role === 'girl' ? GIRL_SPEED : BOY_SPEED)
    this.coyote = 0
    this.jumpBuf = 0
    this.jumpConsumed = false
    this.walkPhase = 0
    this.wasGrounded = true
    this.pose = 'idle'
    this.alive = true
    this.awaitingContinue = false
    this.justLanded = false
    this.lane = LANE_DEFAULT
    this.laneCd = 0
    this.laneJumping = false
    this.laneBuf = 0
    this.laneHeldLock = false

    this.setCollideWorldBounds(true)
    this.setDragX(0)
    this.setMaxVelocity(this.moveSpeed + 60, 1200)
    this.setDepth(actorDepth('hero', this.lane))
    this.setScale(this.baseScale)
    enablePixelSprite(this)
    bindFootBody(this, {
      bodyW: cfg.bodyW ?? 22,
      bodyH: cfg.bodyH ?? 36,
    })

    const body = this.body as Phaser.Physics.Arcade.Body
    body.debugBodyColor = HURTBOX_DEBUG
    if (inLaneBand(this.y)) {
      body.allowGravity = false
      this.setY(laneY(this.lane))
    }

    this.attackHitbox = this.scene.physics.add.image(this.x, this.y, '__atk-hitbox')
    this.attackHitbox.setVisible(false)
    this.attackHitbox.setActive(false)
    this.attackHitbox.setDepth(actorDepth('hitbox', this.lane))
    enablePixelSprite(this.attackHitbox)
    const hb = this.attackHitbox.body as Phaser.Physics.Arcade.Body
    hb.allowGravity = false
    hb.setAllowGravity(false)
    hb.debugBodyColor = HITBOX_DEBUG
    this.attackHitbox.disableBody(true, true)
  }

  get justLandedFlag() {
    return this.justLanded
  }

  clearJustLanded() {
    this.justLanded = false
  }

  isMeleeActive() {
    return this.attackUntil > 0 && this.attackHitbox.active
  }

  /**
   * Per-frame steer: lane switch (up/down), accel/decel, coyote/jump buffer, in-lane jump.
   */
  updatePlayer(
    dt: number,
    opts: {
      left: boolean
      right: boolean
      jumpJust: boolean
      jumpHeld: boolean
      attackJust: boolean
      laneUpJust?: boolean
      laneDownJust?: boolean
      onAttack?: () => void
      onJump?: () => void
      onLane?: (lane: LaneId) => void
      now?: number
    },
  ) {
    this.justLanded = false
    const body = this.body as Phaser.Physics.Arcade.Body
    resolveStick(body)
    this.laneCd = Math.max(0, this.laneCd - dt)
    this.resolveLaneJumpLanding(body)
    const grounded = isLaneGrounded(body, this.y, this.laneJumping) || this.canStartLaneJump(body)
    if (grounded && !this.laneJumping) { this.coyote = COYOTE_MS; this.jumpConsumed = false }
    else this.coyote = Math.max(0, this.coyote - dt)
    if (opts.jumpJust) this.jumpBuf = JUMP_BUF_MS
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt)
    this.atkCd = Math.max(0, this.atkCd - dt)
    this.hurtCd = Math.max(0, this.hurtCd - dt)
    this.hurtLock = Math.max(0, this.hurtLock - dt)
    this.tickIFrameFlash(opts.now ?? this.scene.time.now)
    this.syncAttackHitbox(opts.now ?? this.scene.time.now)
    if (this.hurtLock > 0 || this.hp <= 0 || !this.alive) {
      if (this.hurtLock > 0 && grounded) this.setVelocityX(body.velocity.x * 0.82)
      this.holdLaneFloor(body, dt)
      this.applyPose(grounded, 0)
      return
    }
    const laneUp = !!opts.laneUpJust
    const laneDown = !!opts.laneDownJust
    if (!laneUp && !laneDown) this.laneHeldLock = false
    else if (!this.laneHeldLock) {
      if (laneUp && this.lane > 0) this.laneBuf = -1
      else if (laneDown && this.lane < 2) this.laneBuf = 1
    }
    if (
      this.laneBuf !== 0 &&
      grounded &&
      !this.laneJumping &&
      this.laneCd <= 0 &&
      inLaneBand(this.y)
    ) {
      if (this.laneBuf < 0 && this.lane > 0) {
        this.lane = clampLane(this.lane - 1)
        this.laneCd = LANE_SWITCH_MS
        opts.onLane?.(this.lane)
      } else if (this.laneBuf > 0 && this.lane < 2) {
        this.lane = clampLane(this.lane + 1)
        this.laneCd = LANE_SWITCH_MS
        opts.onLane?.(this.lane)
      }
      this.laneBuf = 0
      this.laneHeldLock = true
    }
    const dtSec = dt / 1000
    let target = 0
    if (opts.left) target -= this.moveSpeed
    if (opts.right) target += this.moveSpeed
    const accel = grounded ? RUN_ACCEL : RUN_ACCEL * AIR_ACCEL_MUL
    let vx = body.velocity.x
    if (target !== 0) {
      const step = accel * dtSec
      if (vx < target) vx = Math.min(target, vx + step)
      else if (vx > target) vx = Math.max(target, vx - step)
      this.facing = target > 0 ? 1 : -1
      this.setFlipX(this.facing < 0)
    } else if (grounded) {
      const damp = RUN_FRICTION * dtSec
      if (Math.abs(vx) <= damp) vx = 0
      else vx -= Math.sign(vx) * damp
    }
    vx = Phaser.Math.Clamp(vx, -this.moveSpeed, this.moveSpeed)
    this.setVelocityX(vx)
    const canJump = !this.jumpConsumed && !this.laneJumping && (this.canStartLaneJump(body) || this.coyote > 0)
    if (this.jumpBuf > 0 && canJump) {
      body.allowGravity = true
      this.laneJumping = true
      this.setVelocityY(JUMP_V)
      this.jumpBuf = 0; this.coyote = 0; this.jumpConsumed = true
      opts.onJump?.()
    }
    if (!opts.jumpHeld && body.velocity.y < -120) this.setVelocityY(body.velocity.y * 0.55)
    this.holdLaneFloor(body, dt)
    if (!this.wasGrounded && grounded) this.justLanded = true
    this.wasGrounded = grounded
    this.setDepth(actorDepth('hero', this.lane))
    this.attackHitbox.setDepth(actorDepth('hitbox', this.lane))
    if (this.atkCd <= 0 && opts.attackJust) { this.startMelee(opts.now ?? this.scene.time.now); opts.onAttack?.() }
    this.applyPose(grounded, vx)
  }
  private canStartLaneJump(body: Phaser.Physics.Arcade.Body): boolean {
    if (this.laneJumping) return false
    if (isLaneGrounded(body, this.y, false)) return body.velocity.y >= -20
    return isGrounded(body) && body.velocity.y >= 0
  }
  private resolveLaneJumpLanding(body: Phaser.Physics.Arcade.Body) {
    if (!this.laneJumping) return
    const target = laneY(this.lane)
    if (isGrounded(body) && this.y < laneY(0) - 20) { this.laneJumping = false; body.velocity.y = 0; return }
    if (body.velocity.y >= 0 && this.y >= target) {
      this.setY(target); body.velocity.y = 0; body.allowGravity = false
      this.laneJumping = false; this.justLanded = true
    }
  }
  private holdLaneFloor(body: Phaser.Physics.Arcade.Body, dt: number) {
    if (this.laneJumping) return
    if (!inLaneBand(this.y) && isGrounded(body)) { body.allowGravity = true; return }
    if (!inLaneBand(this.y)) return
    const target = laneY(this.lane)
    body.allowGravity = false; body.velocity.y = 0
    const dy = target - this.y
    if (Math.abs(dy) < 1.5) { this.setY(target); return }
    this.setY(this.y + Math.sign(dy) * Math.min(Math.abs(dy), (LANE_SNAP_SPEED * dt) / 1000))
  }
  snapToLane(lane: LaneId = this.lane, x?: number) {
    this.lane = clampLane(lane); this.laneJumping = false; this.jumpConsumed = false
    this.laneBuf = 0; this.laneHeldLock = false; this.laneCd = 0
    if (x !== undefined) this.setX(x)
    this.setY(laneY(this.lane)); this.setVelocity(0, 0)
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (body) { body.allowGravity = false; body.blocked.down = true }
    this.setDepth(actorDepth('hero', this.lane))
    this.attackHitbox.setDepth(actorDepth('hitbox', this.lane))
  }
  startMelee(now = this.scene.time.now) {
    this.atkCd = Math.max(this.atkCd, MELEE_MS + 40)
    this.attackUntil = now + MELEE_MS
    const x = this.x + this.facing * MELEE_OFFSET_X
    const y = this.y + MELEE_OFFSET_Y
    this.attackHitbox.enableBody(true, x, y, true, true)
    this.attackHitbox.setActive(true)
    this.attackHitbox.setVisible(false)
    this.attackHitbox.setAlpha(0.001)
    const hb = this.attackHitbox.body as Phaser.Physics.Arcade.Body
    hb.setSize(MELEE_W, MELEE_H)
    hb.debugBodyColor = HITBOX_DEBUG
    hb.velocity.set(0, 0)
  }

  private syncAttackHitbox(now: number) {
    if (this.attackUntil <= 0) return
    if (now >= this.attackUntil) {
      this.attackUntil = 0
      this.attackHitbox.disableBody(true, true)
      this.attackHitbox.setActive(false)
      return
    }
    const x = this.x + this.facing * MELEE_OFFSET_X
    const y = this.y + MELEE_OFFSET_Y
    this.attackHitbox.setPosition(x, y)
  }

  /** Apply damage + 1.5s i-frames with alpha flash. Returns remaining HP. */
  takeDamage(opts: {
    amount?: number
    knockbackX?: number
    knockbackY?: number
    iframeMs?: number
    lockMs?: number
    now?: number
  }): number {
    const now = opts.now ?? this.scene.time.now
    if (!this.canTakeDamage(now)) return this.hp
    const prev = this.hp
    const amount = opts.amount ?? 1
    this.hp = Math.max(0, this.hp - amount)
    this.hurtCd = opts.iframeMs ?? HURT_IFRAME_MS
    this.hurtLock = opts.lockMs ?? HURT_LOCK_MS
    this.pose = 'hurt'
    if (opts.knockbackX !== undefined) this.setVelocityX(opts.knockbackX)
    if (opts.knockbackY !== undefined) this.setVelocityY(opts.knockbackY)
    this.setTint(0xff4444)
    this.beginIFrameFlash()
    EventBus.emit(GameEvents.PLAYER_HEALTH_CHANGED, {
      role: this.role,
      hp: this.hp,
      maxHp: MAX_HP,
      prevHp: prev,
    })
    return this.hp
  }

  canTakeDamage(now = this.scene.time.now): boolean {
    if (!this.alive || this.hp <= 0 || this.pose === 'die') return false
    if (now < this.grace) return false
    if (this.hurtCd > 0) return false
    return true
  }

  applyHurtPose(dir: number = -1) {
    this.pose = 'hurt'
    this.hurtLock = Math.max(this.hurtLock, HURT_LOCK_MS)
    this.facing = dir < 0 ? -1 : 1
    this.setFlipX(this.facing < 0)
    this.setTint(0xff4444)
    setHurtPoseVisual(this, this.baseScale, this.facing)
  }

  beginDeath() {
    const prev = this.hp
    this.alive = false
    this.pose = 'die'
    this.hp = 0
    this.hurtLock = 99999
    this.stopIFrameFlash()
    this.setAlpha(1)
    this.setVelocity(this.facing * -60, -140)
    this.setTint(0x884444)
    setDiePoseVisual(this, this.baseScale, this.facing)
    this.attackHitbox.disableBody(true, true)
    EventBus.emit(GameEvents.PLAYER_HEALTH_CHANGED, {
      role: this.role,
      hp: 0,
      maxHp: MAX_HP,
      prevHp: prev,
    })
  }

  revive(x: number, y: number, now = this.scene.time.now, graceMs = 2000) {
    this.hp = MAX_HP
    this.pose = 'idle'
    this.alive = true
    this.awaitingContinue = false
    this.hurtCd = 0
    this.hurtLock = 0
    this.jumpConsumed = false
    this.grace = now + graceMs
    this.stopIFrameFlash()
    this.clearTint()
    this.setAlpha(1)
    setPixelPose(this, this.baseScale)
    this.setActive(true)
    this.setVisible(true)
    if (inLaneBand(y)) this.snapToLane(this.lane, x)
    else {
      this.setPosition(Math.round(x), Math.round(y))
      this.setVelocity(0, 0)
    }
    EventBus.emit(GameEvents.PLAYER_HEALTH_CHANGED, {
      role: this.role,
      hp: this.hp,
      maxHp: MAX_HP,
    })
  }

  private beginIFrameFlash() {
    this.stopIFrameFlash()
    this.flashTween = this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.35 },
      duration: 90,
      yoyo: true,
      repeat: -1,
    })
  }

  private tickIFrameFlash(now: number) {
    if (this.hurtCd <= 0 && now >= this.grace) {
      if (this.flashTween) this.stopIFrameFlash()
      if (this.alpha < 1 && this.alive && this.pose !== 'die') this.setAlpha(1)
    }
  }

  private stopIFrameFlash() {
    this.flashTween?.stop()
    this.flashTween = undefined
    if (this.alive) this.setAlpha(1)
  }

  private applyPose(grounded: boolean, vx: number) {
    if (this.hp <= 0 || this.pose === 'die') {
      setDiePoseVisual(this, this.baseScale, this.facing)
      return
    }
    if (this.pose === 'hurt' || this.hurtLock > 0) {
      if (this.hurtLock <= 0) {
        this.pose = grounded ? 'idle' : 'jump'
        this.clearTint()
      } else {
        this.pose = 'hurt'
        setHurtPoseVisual(this, this.baseScale, this.facing)
        return
      }
    }
    // Attack pose — squash only (no continuous lean shear under NEAREST).
    if (this.atkCd > 80 || this.isMeleeActive()) {
      if (this.role === 'boy') {
        setPixelPose(this, this.baseScale, { squashX: 1, squashY: 1, angle: 0 })
      } else {
        setPixelPose(this, this.baseScale, { squashX: 1, squashY: 1, angle: 0 })
      }
      if (!grounded) this.pose = 'jump'
      else if (Math.abs(vx) > 12) this.pose = 'run'
      else this.pose = 'idle'
      return
    }
    if (!grounded) {
      this.pose = 'jump'
      setJumpPose(this, this.baseScale, this.facing)
      return
    }
    if (Math.abs(vx) > 12) {
      this.pose = 'run'
      this.walkPhase += Math.abs(vx) * 0.0005
      setRunPose(this, this.baseScale, this.walkPhase)
      return
    }
    this.pose = 'idle'
    setIdlePose(this, this.baseScale, this.scene.time.now)
  }

  /** Draw hurtbox (blue) + attack hitbox (green) when arcade / overlay debug is on. */
  drawDebug(gfx: Phaser.GameObjects.Graphics) {
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (body) {
      gfx.lineStyle(2, HURTBOX_DEBUG, 0.9)
      gfx.strokeRect(body.x, body.y, body.width, body.height)
    }
    if (this.isMeleeActive()) {
      const hb = this.attackHitbox.body as Phaser.Physics.Arcade.Body
      gfx.lineStyle(2, HITBOX_DEBUG, 0.95)
      gfx.strokeRect(hb.x, hb.y, hb.width, hb.height)
    }
  }

  destroy(fromScene?: boolean) {
    this.stopIFrameFlash()
    this.attackHitbox?.destroy()
    super.destroy(fromScene)
  }
}
