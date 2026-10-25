import Phaser from 'phaser'
import { bindFootBody } from './footBody'
import {
  AIR_ACCEL_MUL,
  BOY_SPEED,
  COYOTE_MS,
  FALL_GRAVITY_MUL,
  GIRL_SPEED,
  GRAVITY_Y,
  HURT_IFRAME_MS,
  HURT_LOCK_MS,
  JUMP_BUF_MS,
  JUMP_CUT,
  JUMP_V,
  LANE_COUNT,
  LANE_DEFAULT,
  LANE_SNAP_SPEED,
  LANE_SWITCH_MS,
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
import { EventBus, GameEvents } from './EventBus'
import {
  enableActorSprite,
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
  speed?: number
  scale?: number
  bodyW?: number
  bodyH?: number
  graceUntil?: number
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
 * Arcade player (倫寶 / 琪寶寶) — 超任 SNES weight on Phaser Arcade.
 *
 * Physics: high gravity, snappy jump, variable cut, fast fall, coyote/buffer ~100ms.
 * FSM: IDLE/MOVE/JUMP/LANE_SWAP/HURT/ATTACK(/DIE) with Entry/Update/Exit;
 * JUMP/LANE_SWAP timeout 800ms → never freeze mid-air.
 * Render: scale 1 after 2× bake; depth = lane*1000+y each update.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  hp = MAX_HP
  facing: 1 | -1 = 1
  atkCd = 0
  hurtCd = 0
  hurtLock = 0
  grace = 0
  role: PlayerRole = 'boy'
  baseScale = 1
  coyote = 0
  jumpBuf = 0
  jumpConsumed = false
  walkPhase = 0
  wasGrounded = true
  pose: HeroPose = 'idle'
  alive = true
  awaitingContinue = false
  moveSpeed = BOY_SPEED
  lane: LaneId = LANE_DEFAULT
  laneCd = 0
  laneJumping = false
  laneBuf = 0
  justLanded = false

  fsm: PlayerFsm = 'IDLE'
  fsmEnterAt = 0

  attackHitbox!: Phaser.Physics.Arcade.Image
  private attackUntil = 0
  private flashTween?: Phaser.Tweens.Tween
  private jumpCutApplied = false

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
    this.baseScale = (cfg.scale ?? 1) * ACTOR_DISPLAY_SCALE * HERO_SIZE_MUL
    this.moveSpeed = cfg.speed ?? (cfg.role === 'girl' ? GIRL_SPEED : BOY_SPEED)
    this.coyote = 0
    this.jumpBuf = 0
    this.jumpConsumed = false
    this.jumpCutApplied = false
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
    enableActorSprite(this)
    // 2× baked cast frames — hurtbox matches visual feet/torso (not pre-bake 22×36).
    bindFootBody(this, {
      bodyW: cfg.bodyW ?? 44,
      bodyH: cfg.bodyH ?? 72,
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
      laneUpJust?: boolean
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
    this.laneCd = Math.max(0, this.laneCd - dt)
    this.resolveLaneJumpLanding(body)
    const grounded =
      isLaneGrounded(body, this.y, this.laneJumping) || this.canStartLaneJump(body)

    if (grounded && !this.laneJumping) {
      this.coyote = COYOTE_MS
      this.jumpConsumed = false
    } else {
      this.coyote = Math.max(0, this.coyote - dt)
    }

    if (opts.jumpJust) this.jumpBuf = JUMP_BUF_MS
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt)

    this.atkCd = Math.max(0, this.atkCd - dt)
    this.hurtCd = Math.max(0, this.hurtCd - dt)
    this.hurtLock = Math.max(0, this.hurtLock - dt)
    this.tickIFrameFlash(now)
    this.syncAttackHitbox(now)
    this.applyAirGravity(body)

    if (this.hurtLock > 0 || this.hp <= 0 || !this.alive) {
      if (this.hurtLock > 0 && grounded) this.setVelocityX(body.velocity.x * 0.82)
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

    // Hold W/S (or ↑↓): keep stepping lanes while cooldown ready — no release needed.
    const laneUp = !!opts.laneUpJust
    const laneDown = !!opts.laneDownJust
    const laneMax = LANE_COUNT - 1
    if (
      grounded &&
      !this.laneJumping &&
      this.laneCd <= 0 &&
      inLaneBand(this.y)
    ) {
      if (laneUp && this.lane > 0) {
        this.lane = clampLane(this.lane - 1)
        this.laneCd = LANE_SWITCH_MS
        fsmEnter(this, 'LANE_SWAP', now)
        opts.onLane?.(this.lane)
      } else if (laneDown && this.lane < laneMax) {
        this.lane = clampLane(this.lane + 1)
        this.laneCd = LANE_SWITCH_MS
        fsmEnter(this, 'LANE_SWAP', now)
        opts.onLane?.(this.lane)
      }
    }
    this.laneBuf = 0

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

    const canJump =
      !this.jumpConsumed &&
      !this.laneJumping &&
      (this.canStartLaneJump(body) || this.coyote > 0)
    if (this.jumpBuf > 0 && canJump) {
      body.allowGravity = true
      body.setGravity(0, 0)
      this.laneJumping = true
      this.jumpCutApplied = false
      this.setVelocityY(JUMP_V)
      this.jumpBuf = 0
      this.coyote = 0
      this.jumpConsumed = true
      fsmEnter(this, 'JUMP', now)
      opts.onJump?.()
    }

    if (
      !opts.jumpHeld &&
      !this.jumpCutApplied &&
      this.laneJumping &&
      body.velocity.y < -80
    ) {
      this.setVelocityY(body.velocity.y * JUMP_CUT)
      this.jumpCutApplied = true
    }

    this.holdLaneFloor(body, dt)
    if (!this.wasGrounded && grounded) this.justLanded = true
    this.wasGrounded = grounded

    if (this.atkCd <= 0 && opts.attackJust) {
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

  private applyAirGravity(body: Phaser.Physics.Arcade.Body) {
    if (!this.laneJumping || !body.allowGravity) {
      body.setGravity(0, 0)
      return
    }
    if (body.velocity.y > 0) {
      body.setGravity(0, GRAVITY_Y * (FALL_GRAVITY_MUL - 1))
    } else {
      body.setGravity(0, 0)
    }
  }

  private canStartLaneJump(body: Phaser.Physics.Arcade.Body): boolean {
    if (this.laneJumping) return false
    if (isLaneGrounded(body, this.y, false)) return body.velocity.y >= -20
    return isGrounded(body) && body.velocity.y >= 0
  }

  private resolveLaneJumpLanding(body: Phaser.Physics.Arcade.Body) {
    if (!this.laneJumping) return
    const target = laneY(this.lane)
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
    }
    if (this.laneJumping && body.velocity.y >= -20 && Math.abs(this.y - target) < 3) {
      this.setY(target)
      body.velocity.y = 0
      body.allowGravity = false
      body.setGravity(0, 0)
      this.laneJumping = false
      this.justLanded = true
      this.jumpCutApplied = false
    }
  }

  private holdLaneFloor(body: Phaser.Physics.Arcade.Body, dt: number) {
    if (this.laneJumping) return
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
