import Phaser from 'phaser'
import { bindFootBody } from '../footBody'
import {
  LANE_DEFAULT, clampLane, inLaneBand, laneY, type LaneId,
} from '../engine/lanes'
import { actorDepth } from '../engine/depth'
import { enablePixelSprite } from '../pixelSnap'
import {
  type EnemyKind,
  type EnemySpecies,
  type EnemyState,
  KIND_STATS,
  SPECIES_STATS,
  defaultSpecies,
  pickTarget,
} from '../enemyAi'
import { Enemy, type EnemyFsm, type EnemyHooks, type EnemyTickCtx } from './Enemy'

type AtkPhase = 'none' | 'windup' | 'strike' | 'recover' | 'pause' | 'charge'

/** Round-1 patrol enemy — 醃魚雜兵 / 木桶武者 (+ boss / guardian kinds). */
export class PatrolEnemy extends Enemy {
  kind: EnemyKind = 'blocker'
  species: EnemySpecies = 'fish'
  patrolMin = 0
  patrolMax = 0
  homeX = 0
  homeY = 0
  guardX = 0
  atkCd = 0
  windup = 0
  detectT = 0
  hopCd = 0
  chargeDir: 1 | -1 = 1
  phase: 1 | 2 | 3 = 1
  boss = false
  elite = false
  atkPhase: AtkPhase = 'none'
  state: EnemyState = 'patrol'
  walkPhase = 0

  static spawn(
    scene: Phaser.Scene,
    group: Phaser.Physics.Arcade.Group,
    x: number,
    y: number,
    kind: EnemyKind,
    opts: {
      guardX?: number
      species?: EnemySpecies
      ground?: Phaser.Physics.Arcade.StaticGroup
      hooks?: EnemyHooks
      lane?: LaneId
    } = {},
  ): PatrolEnemy {
    const st = KIND_STATS[kind]
    const spKey = opts.species ?? defaultSpecies(kind)
    const sp = SPECIES_STATS[spKey]
    const tex = scene.textures.exists(sp.tex) ? sp.tex : 'art-enemy'
    const lane = clampLane(opts.lane ?? (inLaneBand(y) ? LANE_DEFAULT : 0))
    const feetY = inLaneBand(y) ? laneY(lane) : y
    const e = new PatrolEnemy(scene, x, feetY, tex)
    e.kind = kind
    e.species = spKey
    e.lane = lane
    e.hp = st.hp
    e.maxHp = st.hp
    e.atkCd = Phaser.Math.Between(300, 800)
    e.patrolDir = Math.random() > 0.5 ? 1 : -1
    const span = kind === 'guardian' ? 90 : kind === 'ambusher' ? 48 : 70
    e.patrolMin = x - span
    e.patrolMax = x + span
    e.homeX = x
    e.homeY = feetY
    e.guardX = opts.guardX ?? x
    e.hopCd = Phaser.Math.Between(200, 600)
    e.boss = kind === 'boss'
    e.elite = kind === 'interrupter'
    e.baseScale = st.scale * sp.scaleMul
    e.detectRadius = st.detect
    e.aggroRadius = st.aggro
    e.meleeRadius = st.melee
    e.attackMode = 'melee'
    e.groundGroup = opts.ground ?? null
    e.hooks = opts.hooks ?? {}
    e.setCollideWorldBounds(true)
    e.setDepth(actorDepth('enemy', lane, feetY))
    e.setScale(e.baseScale)
    enablePixelSprite(e)
    e.setData('baseTex', tex)
    if (spKey === 'fish' && st.tint) e.setTint(st.tint)
    bindFootBody(e, {
      bodyW: spKey === 'barrel' ? 44 : 40,
      bodyH: spKey === 'barrel' ? 56 : 44,
    })
    const body = e.body as Phaser.Physics.Arcade.Body
    if (inLaneBand(feetY)) {
      body.allowGravity = false
      e.setY(laneY(lane))
    }
    e.setFsm('PATROL')
    group.add(e)
    e.label = undefined
    return e
  }

  protected override defaultTint(): number | undefined {
    return this.species === 'fish' ? KIND_STATS[this.kind].tint : undefined
  }

  protected override onEnterFsm(next: EnemyFsm, _prev: EnemyFsm) {
    this.state = fsmToLegacy(next, this.atkPhase)
    if (next === 'HURT') this.atkPhase = 'none'
    if (next === 'DEAD') this.state = 'die'
    if (next === 'PATROL') this.atkPhase = 'none'
  }

  override canHurtPlayer(): boolean {
    if (!this.active || this.fsm === 'DEAD' || this.fsm === 'HURT') return false
    if (this.fsm === 'ATTACK') {
      if (this.atkPhase === 'recover') return false
      if (this.atkPhase === 'strike' || this.atkPhase === 'charge') return !this.hitThis
      if (this.atkPhase === 'windup' && this.windup <= 60) return !this.hitThis
      return false
    }
    if (this.fsm === 'PATROL' || this.fsm === 'CHASE') return this.contactCd <= 0
    return false
  }

  override tick(dt: number, ctx: EnemyTickCtx) {
    if (!this.active || this.fsm === 'DEAD') {
      this.applyPose()
      return
    }
    const st = this.effectiveStats()
    const sp = SPECIES_STATS[this.species]
    this.syncBossPhase()
    const mul = this.phaseMul()
    this.think = Math.max(0, this.think - dt)
    this.atkCd = Math.max(0, this.atkCd - dt)
    this.windup = Math.max(0, this.windup - dt)
    this.detectT = Math.max(0, this.detectT - dt)
    this.hopCd = Math.max(0, this.hopCd - dt)
    this.contactCd = Math.max(0, this.contactCd - dt)
    const target = pickTarget(this, ctx.boy, ctx.girl)
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y)
    const aggro = st.aggro * mul.aggro
    const melee = st.melee
    const spd = st.spd * mul.spd
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!body) return

    this.holdLaneFloor(body)

    if (this.fsm === 'HURT') {
      this.applyPose()
      if (this.think <= 0) {
        this.clearTint()
        const t = this.defaultTint()
        if (t) this.setTint(t)
        this.poseAngle = 0
        this.setFsm('CHASE')
      }
      return
    }

    if (this.fsm === 'ATTACK') {
      this.tickAttack(target, dist, aggro, spd, st, sp)
      return
    }

    if (dist < melee && this.atkCd <= 0 && this.fsm === 'CHASE') {
      this.beginWindup(st.windupMs * mul.windup * (sp.style === 'hop' ? 0.85 : 1))
      return
    }

    // Always chase once active — never idle/patrol freeze.
    if (this.fsm !== 'CHASE') this.setFsm('CHASE')
    {
      const dx = target.x - this.x
      const dir = (Math.sign(dx) || this.patrolDir) as 1 | -1
      const arrive = Math.abs(dx) < 12
      this.setVelocityX(arrive ? dir * spd * 0.45 : dir * spd)
      this.setFlipX(dir < 0)
      this.patrolDir = dir
      this.walkPhase += arrive ? 0.08 : 0.14
      this.applyPose()
    }
  }

  private beginWindup(ms: number) {
    this.setFsm('ATTACK')
    this.atkPhase = 'windup'
    // Short telegraph — keep walking in (no freeze).
    this.windup = Math.min(160, Math.max(90, ms))
    this.hitThis = false
    this.setTint(0xff1111)
    this.hooks.telegraph?.(this, this.altarAmbush ? 'ambush' : 'windup')
    this.applyPose()
  }

  private tickAttack(
    target: { x: number; y: number },
    _dist: number,
    _aggro: number,
    spd: number,
    st: ReturnType<PatrolEnemy['effectiveStats']>,
    _sp: (typeof SPECIES_STATS)[EnemySpecies],
  ) {
    const dir = (Math.sign(target.x - this.x) || this.patrolDir) as 1 | -1
    const walkIn = (mul: number) => {
      this.setVelocityX(dir * spd * mul)
      this.setFlipX(dir < 0)
      this.patrolDir = dir
      this.walkPhase += 0.12 * mul
    }
    if (this.atkPhase === 'recover') {
      // Keep closing — no stand-still recover.
      walkIn(0.7)
      this.applyPose()
      if (this.think <= 0) {
        this.hitThis = false
        this.setFsm('CHASE')
      }
      return
    }
    // Legacy pause/charge → treat as strike while walking
    if (this.atkPhase === 'pause' || this.atkPhase === 'charge') {
      this.atkPhase = 'strike'
      this.think = 180
      this.hitThis = false
      this.chargeDir = dir
    }
    if (this.atkPhase === 'windup') {
      this.setTint(0xff3333)
      walkIn(0.85)
      this.applyPose()
      if (this.windup <= 0) {
        this.atkPhase = 'strike'
        this.hitThis = false
        this.think = 180
        this.chargeDir = dir
        if (this.attackMode === 'projectile') this.hooks.spawnProjectile?.(this, dir)
      }
      return
    }
    if (this.atkPhase === 'strike') {
      walkIn(1.35)
      this.applyPose()
      if (this.think <= 0) {
        this.clearTint()
        const t = this.defaultTint()
        if (t) this.setTint(t)
        this.atkPhase = 'recover'
        this.think = Math.min(160, st.recoverMs)
        this.atkCd = st.atkCdMs
      }
      return
    }
    this.setFsm('CHASE')
  }

  private effectiveStats() {
    const st = KIND_STATS[this.kind]
    const sp = SPECIES_STATS[this.species]
    return {
      ...st,
      tint: this.species === 'fish' ? st.tint : undefined,
      scale: st.scale * sp.scaleMul,
      hopChance: st.hopChance * sp.hopMul,
      chargePrefer: st.chargePrefer || sp.chargePrefer,
      label: sp.label,
    }
  }

  private syncBossPhase() {
    if (this.kind !== 'boss') return
    const r = this.hp / this.maxHp
    this.phase = r > 0.66 ? 1 : r > 0.33 ? 2 : 3
  }

  private phaseMul() {
    if (this.kind !== 'boss') return { spd: 1, windup: 1, aggro: 1 }
    if (this.phase === 1) return { spd: 0.9, windup: 1.1, aggro: 0.95 }
    if (this.phase === 2) return { spd: 1.2, windup: 0.85, aggro: 1.15 }
    return { spd: 1.45, windup: 0.65, aggro: 1.3 }
  }

  private holdLaneFloor(body: Phaser.Physics.Arcade.Body) {
    if (!inLaneBand(this.homeY) && !inLaneBand(this.y)) return
    const target = laneY(this.lane)
    // Never freefall off the lane plane (was melting FPS / soft-freezing play).
    if (this.y > target + 48 || this.y < target - 160) {
      this.setY(target)
      body.velocity.y = 0
      body.allowGravity = false
      this.setDepth(actorDepth('enemy', this.lane, this.y))
      return
    }
    const airborne = Math.abs(body.velocity.y) > 40 || body.velocity.y < -10
    if (airborne) {
      body.allowGravity = true
      return
    }
    if (this.y > target + 2 || (body.velocity.y >= 0 && this.y >= target - 2)) {
      this.setY(target)
      body.velocity.y = 0
      body.allowGravity = false
    }
    this.setDepth(actorDepth('enemy', this.lane, this.y))
  }
  private applyPose() {
    const lock = () => {
      this.setScale(Math.round(this.baseScale) || 1)
      this.setAngle(0)
    }
    const base = (this.getData('baseTex') as string) || 'art-enemy'
    const setTex = (key: string) => {
      if (this.scene.textures.exists(key) && this.texture.key !== key) this.setTexture(key)
    }
    if (this.fsm === 'DEAD' || this.fsm === 'HURT') {
      setTex(base)
      lock()
      return
    }
    if (this.atkPhase === 'windup' || this.atkPhase === 'pause') {
      setTex(`${base}-atk-windup`)
      this.setTint(0xff1111)
      lock()
      return
    }
    if (this.atkPhase === 'charge' || this.atkPhase === 'strike') {
      setTex(`${base}-atk-strike`)
      lock()
      return
    }
    const vx = Math.abs((this.body as Phaser.Physics.Arcade.Body | null)?.velocity.x ?? 0)
    if (vx > 20 && (this.fsm === 'CHASE' || this.fsm === 'PATROL' || this.atkPhase === 'recover')) {
      if (this.atkPhase === 'none' || this.atkPhase === 'recover') {
        this.walkPhase += 0.1
      }
      const frame = Math.floor(this.walkPhase) % 4
      setTex(`${base}-run-${frame}`)
      lock()
      return
    }
    setTex(base)
    lock()
  }
}

function fsmToLegacy(fsm: EnemyFsm, atk: AtkPhase): EnemyState {
  switch (fsm) {
    case 'PATROL':
      return 'patrol'
    case 'CHASE':
      return 'chase'
    case 'HURT':
      return 'hurt'
    case 'DEAD':
      return 'die'
    case 'ATTACK':
      if (atk === 'windup') return 'windup'
      if (atk === 'strike') return 'attack'
      if (atk === 'charge') return 'charge'
      if (atk === 'pause') return 'pause'
      if (atk === 'recover') return 'recover'
      return 'attack'
  }
}
