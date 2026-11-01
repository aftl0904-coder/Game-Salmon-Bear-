import Phaser from 'phaser'
import { bindFootBody } from './footBody'
import { ANIM_SETS, animTex, hasAnimSet, type AnimSetId } from './heroAnims'
import {
  AIR_ACCEL_MUL,
  FALL_GRAVITY_MUL,
  GIRL_SPEED,
  HURT_IFRAME_MS,
  HURT_LOCK_MS,
  HURT_DAMP,
  HURT_MAX_VX,
  LANE_DEFAULT,
  LANE_SNAP_SPEED,
  MAX_FALL,
  MAX_HP,
  ACTOR_DISPLAY_SCALE,
  HERO_SIZE_MUL,
  RUN_ACCEL,
  RUN_FRICTION,
  actorDepth,
  clampLane,
  fsmEnter,
  fsmUpdate,
  inLaneBand,
  isGrounded,
  isLaneGrounded,
  laneY,
  resolveStick,
  type LaneId,
  type PlayerFsm,
} from './engine'
import {
  PLAYER,
  fullApexVelocity,
  jumpGravity,
  tapApexVelocity,
} from './config/playerData'
import { EventBus, GameEvents } from './EventBus'
import { landingTopAt, stepUpTop, supportTopAt, terrainEnabled, wallClampX } from './engine/terrain'
import {
  enableActorSprite,
  setDiePoseVisual,
  setHurtPoseVisual,
  setIdlePose,
  setJumpPose,
  setPixelPose,
  setRunPose,
} from './pixelSnap'

/** Steps up to this many px high are walked up without jumping. */
const STEP_UP_MAX = 18

export type HeroPose = 'idle' | 'run' | 'jump' | 'hurt' | 'die'
export type PlayerRole = 'boy' | 'girl'

export type PlayerConfig = {
  role: PlayerRole
  texture: string
  speed?: number
  scale?: number
  bodyW?: number
  bodyH?: number
  graceUntil?: number
  /** Frame-by-frame art set (public/art/anim). Falls back to the warped still if missing. */
  animSet?: AnimSetId
}

export const HURTBOX_DEBUG = 0x4488ff
export const HITBOX_DEBUG = 0x44ff66

/** Melee commit window — attack rate 0.8× → longer lock */
const MELEE_MS = Math.round(150 / 0.8)
const MELEE_W = 48
/** Tall enough to overlap ±1 adjacent lane (~36px spacing). */
const MELEE_H = 96
const MELEE_OFFSET_X = 40
/** Torso-centered so ±1 lane bodies still overlap. */
const MELEE_OFFSET_Y = -52

/**
 * Arcade player — single-lane side-scroller (stage 1).
 * Jump / crouch / hitbox / speed from data/player.json.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  hp = PLAYER.hp
  facing: 1 | -1 = 1
  atkCd = 0
  hurtCd = 0
  hurtLock = 0
  hurtDamp = HURT_DAMP
  grace = 0
  role: PlayerRole = 'boy'
  /** Boots from the gear shop scale the jump (gear.ts jumpMul). */
  jumpMul = 1
  /** 耐力 0..1: every swing spends some, standing off it brings it back (GameScene.tickStamina). */
  stam = 1
  /** Time of the last attack, for the stamina recovery delay. */
  lastAtkAt = 0
  baseScale = 1
  coyote = 0
  jumpBuf = 0
  jumpConsumed = false
  walkPhase = 0
  wasGrounded = true
  pose: HeroPose = 'idle'
  alive = true
  awaitingContinue = false
  moveSpeed = PLAYER.moveSpeed
  /** Crouch held (ground only). */
  crouching = false
  lane: LaneId = LANE_DEFAULT
  laneCd = 0
  laneJumping = false
  laneBuf = 0
  justLanded = false

  fsm: PlayerFsm = 'IDLE'
  fsmEnterAt = 0

  attackHitbox!: Phaser.Physics.Arcade.Image
  /** Active frame-animation set, or null for the legacy single-image hero. */
  animSet: AnimSetId | null = null
  /** A one-shot action (shoot / slash) owns the sprite until this time. */
  private actionUntil = 0
  private attackUntil = 0
  private flashTween?: Phaser.Tweens.Tween
  private jumpCutApplied = false
  private jumpHoldMs = 0
  /** Feet Y last frame — landing test crosses from prevFeetY to y. */
  private prevFeetY = 0
  /** Half foot width for terrain support / walls (matches standing hitbox). */
  private get footHalfW() {
    return Math.max(3, Math.round(PLAYER.hitbox.standing.w / 2) - 1)
  }
  /** Floor top under the feet from data/levels terrain (null = over a pit / off an edge). */
  private terrainSupport(): number | null {
    // Allow 10px sink (one fast physics step) so a landing / respawn never misses the floor.
    return supportTopAt(this.x, this.y, this.footHalfW, 10)
  }

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
    this.hp = PLAYER.hp
    this.facing = 1
    this.atkCd = 0
    this.hurtCd = 0
    this.hurtLock = 0
    this.grace = cfg.graceUntil ?? 0
    this.baseScale = (cfg.scale ?? 1) * ACTOR_DISPLAY_SCALE * HERO_SIZE_MUL
    this.moveSpeed = cfg.speed ?? (cfg.role === 'girl' ? GIRL_SPEED : PLAYER.moveSpeed)
    this.coyote = 0
    this.jumpBuf = 0
    this.jumpConsumed = false
    this.jumpCutApplied = false
    this.jumpHoldMs = 0
    this.crouching = false
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
    this.fsm = 'IDLE'
    this.fsmEnterAt = 0

    this.setCollideWorldBounds(true)
    this.setDragX(0)
    this.setMaxVelocity(this.moveSpeed + 60, MAX_FALL)
    this.syncActorDepth()
    this.setScale(this.baseScale)
    this.setData('baseTex', cfg.texture)
    this.animSet = cfg.animSet && hasAnimSet(this.scene, cfg.animSet) ? cfg.animSet : null
    if (this.animSet) {
      this.setTexture(animTex(this.animSet), ANIM_SETS[this.animSet].anims.idle?.start ?? 0)
      this.anims.play(`${this.animSet}-idle`)
    }
    enableActorSprite(this)
    bindFootBody(this, {
      bodyW: cfg.bodyW ?? PLAYER.hitbox.standing.w,
      bodyH: cfg.bodyH ?? PLAYER.hitbox.standing.h,
    })

    const body = this.body as Phaser.Physics.Arcade.Body
    body.debugBodyColor = HURTBOX_DEBUG
    body.setGravity(0, 0)
    if (inLaneBand(this.y)) {
      body.allowGravity = false
      this.setY(laneY(this.lane))
    }

    this.attackHitbox = this.scene.physics.add.image(this.x, this.y, '__atk-hitbox')
    this.attackHitbox.setVisible(false)
    this.attackHitbox.setActive(false)
    this.attackHitbox.setDepth(actorDepth('hitbox', this.lane, this.y))
    enableActorSprite(this.attackHitbox)
    const hb = this.attackHitbox.body as Phaser.Physics.Arcade.Body
    hb.allowGravity = false
    hb.setAllowGravity(false)
    hb.debugBodyColor = HITBOX_DEBUG
    this.attackHitbox.disableBody(true, true)

    fsmEnter(this, 'IDLE', this.scene.time.now)
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

  updatePlayer(
    dt: number,
    opts: {
      left: boolean
      right: boolean
      jumpJust: boolean
      jumpHeld: boolean
      attackJust: boolean
      crouchHeld?: boolean
      /** @deprecated stage 1 — ignored */
      laneUpJust?: boolean
      /** @deprecated stage 1 — ignored */
      laneDownJust?: boolean
      onAttack?: () => void
      onJump?: () => void
      onLane?: (lane: LaneId) => void
      now?: number
    },
  ) {
    this.justLanded = false
    const now = opts.now ?? this.scene.time.now
    const body = this.body as Phaser.Physics.Arcade.Body
    resolveStick(body)
    this.laneCd = 0
    this.resolveLaneJumpLanding(body)
    const grounded = terrainEnabled()
      ? !this.laneJumping && this.terrainSupport() !== null
      : isLaneGrounded(body, this.y, this.laneJumping) || this.canStartLaneJump(body)

    if (grounded && !this.laneJumping) {
      this.coyote = PLAYER.jump.coyoteMs
      this.jumpConsumed = false
    } else {
      this.coyote = Math.max(0, this.coyote - dt)
    }

    if (opts.jumpJust) this.jumpBuf = PLAYER.jump.bufferMs
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt)

    this.atkCd = Math.max(0, this.atkCd - dt)
    this.hurtCd = Math.max(0, this.hurtCd - dt)
    this.hurtLock = Math.max(0, this.hurtLock - dt)
    if (this.hurtLock <= 0) this.hurtDamp = HURT_DAMP
    const vxCap = this.hurtLock > 0 ? HURT_MAX_VX : this.moveSpeed + 60
    if (body.maxVelocity.x !== vxCap) body.setMaxVelocityX(vxCap)
    this.tickIFrameFlash(now)
    this.syncAttackHitbox(now)
    this.applyAirGravity(body)

    // Crouch: ground only; cancels if jumping.
    const wantCrouch = !!opts.crouchHeld && grounded && !this.laneJumping
    if (wantCrouch !== this.crouching) {
      this.crouching = wantCrouch
      this.applyCrouchHitbox()
    } else if (!grounded && this.crouching) {
      this.crouching = false
      this.applyCrouchHitbox()
    }

    if (this.hurtLock > 0 || this.hp <= 0 || !this.alive) {
      if (this.hurtLock > 0 && grounded) this.setVelocityX(body.velocity.x * Math.pow(this.hurtDamp, dt / 16.667))
      this.holdLaneFloor(body, dt)
      fsmUpdate(this, {
        now,
        grounded,
        vx: body.velocity.x,
        body,
        meleeActive: this.isMeleeActive(),
        atkCd: this.atkCd,
      })
      this.syncActorDepth()
      this.applyPose(grounded, 0)
      return
    }

    this.laneBuf = 0
    void opts.laneUpJust
    void opts.laneDownJust
    void opts.onLane

    const baseSpeed = this.moveSpeed
    const speed =
      this.crouching ? baseSpeed * PLAYER.crouch.speedMultiplier : baseSpeed

    const dtSec = dt / 1000
    let target = 0
    if (opts.left) target -= speed
    if (opts.right) target += speed
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
    vx = Phaser.Math.Clamp(vx, -speed, speed)
    if (terrainEnabled() && vx !== 0) {
      // Raised steps are walls: can't walk into them, must jump up.
      const nx = this.x + (vx * dt) / 1000
      const hw = this.footHalfW + 2
      const rise = grounded ? stepUpTop(nx, this.y, Math.sign(vx), hw, STEP_UP_MAX) : null
      if (rise !== null) {
        this.setY(rise)
        this.setX(nx)
        body.reset(this.x, this.y)
      }
      const clampX = rise !== null ? null : wallClampX(nx, this.y, Math.sign(vx), hw)
      if (clampX !== null) {
        this.setX(clampX)
        vx = 0
      }
    }
    this.setVelocityX(vx)

    const canJump =
      !this.jumpConsumed &&
      !this.laneJumping &&
      !this.crouching &&
      (this.canStartLaneJump(body) || this.coyote > 0)
    if (this.jumpBuf > 0 && canJump) {
      body.allowGravity = true
      body.setGravity(0, 0)
      this.laneJumping = true
      this.jumpCutApplied = false
      this.jumpHoldMs = 0
      this.setVelocityY(fullApexVelocity() * this.jumpMul)
      this.jumpBuf = 0
      this.coyote = 0
      this.jumpConsumed = true
      fsmEnter(this, 'JUMP', now)
      opts.onJump?.()
    }

    if (this.laneJumping) {
      this.jumpHoldMs += dt
      // Early release → tap height (~24px). Hold through apex → full (~48px).
      if (!opts.jumpHeld && !this.jumpCutApplied && body.velocity.y < -40) {
        const tapV = tapApexVelocity() * this.jumpMul
        // Mario-style: clamp upward speed so remaining apex ≈ targetHeightPx.tap
        if (body.velocity.y < tapV) this.setVelocityY(tapV)
        this.jumpCutApplied = true
      }
      void PLAYER.jump.releaseCut
      void PLAYER.jump.holdMaxMs
    }

    this.holdLaneFloor(body, dt)
    if (!this.wasGrounded && grounded) this.justLanded = true
    this.wasGrounded = grounded

    const canAtk = !this.crouching || PLAYER.crouch.canAttack
    if (this.atkCd <= 0 && opts.attackJust && canAtk) {
      this.startMelee(now)
      fsmEnter(this, 'ATTACK', now)
      opts.onAttack?.()
    }

    fsmUpdate(this, {
      now,
      grounded,
      vx,
      body,
      meleeActive: this.isMeleeActive(),
      atkCd: this.atkCd,
    })
    this.syncActorDepth()
    this.applyPose(grounded, vx)
  }

  /** Standing / crouch hurtbox from data/player.json. */
  applyCrouchHitbox() {
    const box = this.crouching ? PLAYER.hitbox.crouch : PLAYER.hitbox.standing
    bindFootBody(this, { bodyW: box.w, bodyH: box.h })
  }

  private applyAirGravity(body: Phaser.Physics.Arcade.Body) {
    if (!this.laneJumping || !body.allowGravity) {
      body.setGravity(0, 0)
      this.floating = false
      return
    }
    const g = jumpGravity()
    // 琪寶寶's fan: after an updraft she glides down slowly (cancel most of gravity, cap the fall).
    if (this.floating && body.velocity.y > 0) {
      body.setGravity(0, -g * 0.82)
      if (body.velocity.y > 40) body.velocity.y = 40
      return
    }
    // Rising: world gravity only (via allowGravity + scene gravity). Falling: extra mul.
    if (body.velocity.y > 0) {
      body.setGravity(0, g * (FALL_GRAVITY_MUL - 1))
    } else {
      body.setGravity(0, 0)
    }
  }

  private canStartLaneJump(body: Phaser.Physics.Arcade.Body): boolean {
    if (this.laneJumping) return false
    if (terrainEnabled()) return this.terrainSupport() !== null && body.velocity.y >= -20
    if (isLaneGrounded(body, this.y, false)) return body.velocity.y >= -20
    return isGrounded(body) && body.velocity.y >= 0
  }

  private resolveLaneJumpLanding(body: Phaser.Physics.Arcade.Body) {
    if (!this.laneJumping) return
    if (terrainEnabled()) {
      const prev = this.prevFeetY || this.y
      this.prevFeetY = this.y
      if (this.jumpHoldMs < 50 || body.velocity.y < 0) return
      const top = landingTopAt(this.x, prev, this.y, this.footHalfW)
      if (top === null) return
      this.setY(top)
      body.velocity.y = 0
      body.allowGravity = false
      body.setGravity(0, 0)
      this.laneJumping = false
      this.justLanded = true
      this.jumpCutApplied = false
      this.jumpHoldMs = 0
      return
    }
    const target = laneY(this.lane)
    // Don't cancel takeoff — feet are still on the line for the first frames.
    if (this.jumpHoldMs < 50 || body.velocity.y < -40) return
    if (isGrounded(body) && this.y < laneY(0) - 20) {
      this.laneJumping = false
      body.velocity.y = 0
      body.setGravity(0, 0)
      return
    }
    if (body.velocity.y >= 0 && this.y >= target) {
      this.setY(target)
      body.velocity.y = 0
      body.allowGravity = false
      body.setGravity(0, 0)
      this.laneJumping = false
      this.justLanded = true
      this.jumpCutApplied = false
      this.jumpHoldMs = 0
    }
  }

  private holdLaneFloor(body: Phaser.Physics.Arcade.Body, dt: number) {
    if (this.laneJumping) return
    if (terrainEnabled()) {
      const top = this.terrainSupport()
      this.prevFeetY = this.y
      if (top === null) {
        // Walked off a ledge / onto a pit → fall with gravity (lands via resolveLaneJumpLanding).
        this.laneJumping = true
        this.jumpHoldMs = 999
        this.jumpCutApplied = true
        this.jumpConsumed = true
        body.allowGravity = true
        body.setGravity(0, 0)
        if (body.velocity.y < 0) body.velocity.y = 0
        return
      }
      body.allowGravity = false
      body.setGravity(0, 0)
      body.velocity.y = 0
      this.setY(top)
      return
    }
    if (!inLaneBand(this.y) && isGrounded(body)) {
      body.allowGravity = true
      return
    }
    if (!inLaneBand(this.y)) return
    const target = laneY(this.lane)
    body.allowGravity = false
    body.setGravity(0, 0)
    body.velocity.y = 0
    const dy = target - this.y
    if (Math.abs(dy) < 1.5) {
      this.setY(target)
      return
    }
    this.setY(this.y + Math.sign(dy) * Math.min(Math.abs(dy), (LANE_SNAP_SPEED * dt) / 1000))
  }

  snapToLane(lane: LaneId = this.lane, x?: number) {
    this.lane = clampLane(lane)
    this.laneJumping = false
    this.jumpConsumed = false
    this.jumpCutApplied = false
    this.laneBuf = 0
    this.laneCd = 0
    if (x !== undefined) this.setX(x)
    this.setY(laneY(this.lane))
    this.setVelocity(0, 0)
    const body = this.body as Phaser.Physics.Arcade.Body | null
    // Teleport: reset the Arcade body too, or the next step applies the old fall velocity.
    body?.reset(this.x, this.y)
    this.prevFeetY = this.y
    if (body) {
      body.allowGravity = false
      body.setGravity(0, 0)
      body.blocked.down = true
    }
    fsmEnter(this, 'IDLE', this.scene.time.now)
    this.syncActorDepth()
  }

  private syncActorDepth() {
    this.setDepth(actorDepth('hero', this.lane, this.y))
    this.attackHitbox?.setDepth(actorDepth('hitbox', this.lane, this.y))
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
    // Fresh swing, fresh targets — cleared here (not just on timeout) so a stationary
    // enemy that never leaves the box (e.g. 打卡鐘怪, which cancels its own knockback)
    // can only be hit once per swing instead of once per physics step it stays frozen.
    this.attackHitbox.setData('hitSet', new Set<string>())
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
    fsmEnter(this, 'HURT', now)
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
    fsmEnter(this, 'HURT', this.scene.time.now)
    setHurtPoseVisual(this, this.baseScale, this.facing)
  }

  beginDeath() {
    const prev = this.hp
    this.alive = false
    this.pose = 'die'
    fsmEnter(this, 'DIE', this.scene.time.now)
    this.hp = 0
    this.hurtLock = 99999
    this.stopIFrameFlash()
    this.setAlpha(1)
    this.setVelocity(this.facing * -60, -180)
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
    this.jumpCutApplied = false
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
    fsmEnter(this, 'IDLE', now)
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

  /** Riding an updraft (wind vent): 琪寶寶 holds her fan overhead. Set by GameScene each frame. */
  floating = false

  /** External launch (wind vent / spring): start an airborne arc without the tap-height cut. */
  launch(vy: number) {
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!body || !this.alive) return
    this.laneJumping = true
    this.jumpCutApplied = true
    this.jumpConsumed = true
    body.allowGravity = true
    this.setVelocityY(Math.min(body.velocity.y, vy))
    fsmEnter(this, 'JUMP', this.scene.time.now)
  }

  /** Play a one-shot action (shoot / slash1…3 / shoot-crouch) and let it own the sprite. */
  playAction(name: string) {
    if (!this.animSet) return
    const set = this.animSet
    const key = `${set}-${name}`
    const meta = ANIM_SETS[set].anims[name]
    if (!meta || !this.scene.anims.exists(key)) return
    this.anims.timeScale = 1
    this.anims.play(key)
    this.lastAnim = name
    this.actionUntil = this.scene.time.now + (meta.count / meta.fps) * 1000
  }

  private animTo(name: string, timeScale = 1) {
    const set = this.animSet
    if (!set) return
    const key = `${set}-${name}`
    if (!this.scene.anims.exists(key)) return
    this.anims.timeScale = timeScale
    // Same state: keep looping / hold a finished one-shot on its last frame.
    if (this.lastAnim === name && (this.anims.isPlaying || ANIM_SETS[set].anims[name]?.loop === false)) return
    this.lastAnim = name
    this.anims.play(key)
  }
  private lastAnim = ''

  /** Frame-animation pose picker (replaces the warp/squash poses for animated sets). */
  private applyAnimPose(grounded: boolean, vx: number) {
    const set = this.animSet!
    const now = this.scene.time.now
    this.setScale(this.baseScale)
    this.setAngle(0)
    if (this.hp <= 0 || this.pose === 'die') {
      this.animTo('ko')
      return
    }
    if (this.pose === 'hurt' || this.hurtLock > 0) {
      if (this.hurtLock <= 0) {
        this.pose = grounded ? 'idle' : 'jump'
        this.clearTint()
      } else {
        this.pose = 'hurt'
        this.actionUntil = 0
        this.animTo('hurt')
        return
      }
    }
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!grounded) {
      this.pose = 'jump'
      if (now < this.actionUntil && this.anims.isPlaying) return
      if (this.floating && ANIM_SETS[set].anims['fan-float']) {
        this.animTo('fan-float')
        return
      }
      // rise / apex / fall frames picked from vertical speed
      const vy = body?.velocity.y ?? 0
      const j = ANIM_SETS[set].anims.jump
      if (j) {
        const idx = vy < -70 ? 0 : vy < 70 ? 1 : 2
        this.anims.stop()
        this.lastAnim = 'jump'
        this.setFrame(j.start + Math.min(idx, j.count - 1))
      }
      return
    }
    if (now < this.actionUntil && this.anims.isPlaying) {
      this.pose = Math.abs(vx) > 12 ? 'run' : 'idle'
      return
    }
    if (this.crouching) {
      this.pose = 'idle'
      this.animTo('crouch')
      return
    }
    if (Math.abs(vx) > 12) {
      this.pose = 'run'
      this.animTo(set === 'kibobo' ? 'run' : 'walk', Phaser.Math.Clamp(Math.abs(vx) / this.moveSpeed, 0.6, 1.4))
      return
    }
    this.pose = 'idle'
    this.animTo('idle')
  }

  private applyPose(grounded: boolean, vx: number) {
    if (this.animSet) return this.applyAnimPose(grounded, vx)
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
    if (this.atkCd > 80 || this.isMeleeActive()) {
      setPixelPose(this, this.baseScale, { squashX: 1, squashY: 1, angle: 0 })
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
      // 3 frames per body-step (~40px); feet lead via baked run frames
      this.walkPhase += (Math.abs(vx) / this.moveSpeed) * 0.22
      setRunPose(this, this.baseScale, this.walkPhase)
      return
    }
    this.pose = 'idle'
    setIdlePose(this, this.baseScale, this.scene.time.now)
  }

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
