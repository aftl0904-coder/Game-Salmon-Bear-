import Phaser from 'phaser'
import { bindFootBody } from '../footBody'
import { ANIM_SETS, SPECIES_ANIM, animTex, hasAnimSet, type AnimSetId } from '../heroAnims'
import {
  LANE_DEFAULT, clampLane, inLaneBand, laneY, nearestLane, sameLaneId, type LaneId,
} from '../engine/lanes'
import { actorDepth } from '../engine/depth'
import { enableActorSprite, WALK_FRAMES } from '../pixelSnap'
import { freezeActors, isActorFrozen } from '../fx'
import { ATTACK_COMMIT_FREEZE_MS, ACTOR_DISPLAY_SCALE, WEAPON_DISPLAY_SCALE } from '../engine/constants'
import {
  type EnemyKind,
  type EnemySpecies,
  type EnemyState,
  KIND_STATS,
  SPECIES_STATS,
  aiNum,
  defaultSpecies,
  pickTarget,
} from '../enemyAi'
import { difficultyHpMul, getDifficulty } from '../difficulty'
import { Enemy, type EnemyFsm, type EnemyHooks, type EnemyTickCtx } from './Enemy'

type AtkPhase = 'none' | 'windup' | 'strike' | 'recover' | 'pause' | 'charge'

/** Round-1 patrol enemy — 醃魚雜兵 / 木桶武者 (+ boss / guardian kinds). */
/** 帽仔兵 throws when the hero is within this distance (px). */
const THROW_RANGE = 230
/** 帽仔兵 keeps the hero between these distances. */
const KEEP_AWAY_MIN = 110
const KEEP_AWAY_MAX = 190
/** 紅魚 starts its dash wind-up from this far away. */
const DASH_TRIGGER = 150

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
  /** Random brief freeze (ms timestamp). */
  staggerUntil = 0
  /** 機械豬: armour is open (full damage from the front) until this time. */
  vulnerableUntil = 0
  /** Cooldown before next lane-step decision (per-enemy, staggered). */
  laneSwitchCd = 0
  /** Lane we're smoothly walking toward (may differ from committed `lane`). */
  desiredLane: LaneId = LANE_DEFAULT
  /** True while lerping Y between rows — holdLaneFloor must not hard-snap. */
  laneSliding = false
  /** Extra reaction lag after hero changes row (ms, individual). */
  laneReactLag = 0
  weapon: Phaser.GameObjects.Image | null = null
  /** Frame-animation set (Cursor action sheets); null → legacy warped still. */
  animSet: AnimSetId | null = null
  private animState = ''

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
    const set = SPECIES_ANIM[spKey]
    const animated = !!set && hasAnimSet(scene, set)
    const tex = animated ? animTex(set!) : scene.textures.exists(sp.tex) ? sp.tex : 'art-enemy'
    const lane = clampLane(opts.lane ?? (inLaneBand(y) ? LANE_DEFAULT : 0))
    const feetY = inLaneBand(y) ? laneY(lane) : y
    const e = new PatrolEnemy(scene, x, feetY, tex, animated ? ANIM_SETS[set!].anims.walk?.start ?? 0 : undefined)
    e.animSet = animated ? set! : null
    e.kind = kind
    e.species = spKey
    e.lane = lane
    e.desiredLane = lane
    e.laneSliding = false
    // Stagger so the pack doesn't all hop rows the same frame.
    e.laneSwitchCd = Phaser.Math.Between(80, 720)
    e.laneReactLag = Phaser.Math.Between(120, 520)
    const hp = Math.max(1, Math.round(st.hp * (sp.hpMul ?? 1) * difficultyHpMul(getDifficulty())))
    e.hp = hp
    e.maxHp = hp
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
    e.baseScale = st.scale * sp.scaleMul * ACTOR_DISPLAY_SCALE
    e.detectRadius = st.detect
    e.aggroRadius = st.aggro
    // Elephant nose hit range ≈ 1.5× own body length (fighter-forward extend).
    const bodyW = 56 * e.baseScale
    e.meleeRadius =
      spKey === 'elephant' ? Math.round(Math.max(st.melee * 2.4, bodyW * 1.5)) : st.melee
    // 刺刺魚：遠程小彈；其餘近戰
    // 紅魚 = charger (dash), 帽仔兵 = thrower (arcing rocks), 機械豬 = heavy slam.
    e.attackMode = spKey === 'barrel' ? 'projectile' : 'melee'
    e.setData('spdMul', sp.spdMul ?? 1)
    e.groundGroup = opts.ground ?? null
    e.hooks = opts.hooks ?? {}
    e.setCollideWorldBounds(true)
    e.setDepth(actorDepth('enemy', lane, feetY))
    e.setScale(e.baseScale)
    enableActorSprite(e)
    e.setData('baseTex', tex)
    // Real painted art — no role tint (was turning 紅魚 blue/orange).
    // Painted enemies carry their own look (紅魚 bite, 帽仔兵 rock, 機械豬 slam):
    // no separate held weapon sprite — the old knife / club / elephant trunk
    // didn't match the new art. Attack reads via wind-up frames + red flash.
    e.weapon = null
    bindFootBody(e, {
      bodyW: spKey === 'elephant' ? 52 : spKey === 'barrel' ? 44 : 40,
      bodyH: spKey === 'elephant' ? 52 : spKey === 'barrel' ? 56 : 44,
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
    return undefined
  }

  protected override onEnterFsm(next: EnemyFsm, _prev: EnemyFsm) {
    this.state = fsmToLegacy(next, this.atkPhase)
    if (next === 'HURT') this.atkPhase = 'none'
    if (next === 'DEAD') this.state = 'die'
    if (next === 'PATROL') this.atkPhase = 'none'
  }

  override canHurtPlayer(): boolean {
    if (!this.active || this.fsm === 'DEAD' || this.fsm === 'HURT') return false
    // 帽仔兵 only hurts with thrown rocks.
    if (this.species === 'barrel') return false
    // Only during attack action (no passive bump) — late windup + full strike window.
    if (this.fsm !== 'ATTACK') return false
    if (this.atkPhase === 'recover') return false
    if (this.atkPhase === 'windup' || this.atkPhase === 'pause') {
      return this.windup <= 120 && !this.hitThis
    }
    if (this.atkPhase === 'strike' || this.atkPhase === 'charge') return !this.hitThis
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
    // Timers always tick — actor freeze must not stall attack windup/strike.
    this.think = Math.max(0, this.think - dt)
    this.atkCd = Math.max(0, this.atkCd - dt)
    this.windup = Math.max(0, this.windup - dt)
    this.detectT = Math.max(0, this.detectT - dt)
    this.hopCd = Math.max(0, this.hopCd - dt)
    this.contactCd = Math.max(0, this.contactCd - dt)
    this.laneSwitchCd = Math.max(0, this.laneSwitchCd - dt)
    if (isActorFrozen(this, this.scene.time.now)) {
      this.setVelocity(0, 0)
      if (this.fsm === 'ATTACK' && this.atkPhase === 'windup' && this.windup <= 0) {
        this.atkPhase = 'strike'
        this.hitThis = false
        this.think = 320
      }
      this.applyPose()
      this.syncWeapon()
      return
    }
    const target = pickTarget(this, ctx.boy, ctx.girl)
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y)
    const aggro = st.aggro * mul.aggro
    const spMul = (this.getData('spdMul') as number) || sp.spdMul || 1
    const melee = this.species === 'elephant' ? this.meleeRadius : st.melee
    const spd = st.spd * mul.spd * spMul
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!body) return

    this.holdLaneFloor(body)

    if (this.scene.time.now < this.staggerUntil) {
      this.setVelocityX(0)
      this.setData('staggerTint', true)
      this.applyPose()
      this.syncWeapon()
      return
    }
    if (this.getData('staggerTint')) {
      this.setData('staggerTint', false)
      this.clearTint()
      const t = this.defaultTint()
      if (t) this.setTint(t)
    }

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

    // Seek hero lane first — smooth per-enemy row walk (no pack teleport).
    const targetLane = clampLane(
      target.lane !== undefined ? target.lane : nearestLane(target.y),
    )
    this.seekHeroLane(targetLane, Math.abs(target.x - this.x))

    const onHeroLane = sameLaneId(this.lane, targetLane, 0) && !this.laneSliding
    // Species trigger range: 帽仔兵 throws from afar, 紅魚 starts its dash run-up early.
    const trigger =
      this.species === 'barrel' ? THROW_RANGE : this.species === 'fish' ? Math.max(melee, DASH_TRIGGER) : melee
    if (onHeroLane && dist < trigger && this.atkCd <= 0 && this.fsm === 'CHASE') {
      const wind =
        st.windupMs * mul.windup * (sp.windupMul ?? 1) * (sp.style === 'hop' ? 0.85 : 1)
      this.beginWindup(wind)
      return
    }

    // Always chase once active — never idle/patrol freeze.
    if (this.fsm !== 'CHASE') this.setFsm('CHASE')
    {
      const dx = target.x - this.x
      const dir = (Math.sign(dx) || this.patrolDir) as 1 | -1
      // While off-lane, still close X but keep pressure so hero can dodge/row-swap.
      const arrive = Math.abs(dx) < 12
      const xMul = onHeroLane ? 1 : 0.85
      if (this.species === 'barrel') {
        // Thrower keeps a throwing distance: back off when crowded, close in when far.
        const adx = Math.abs(dx)
        const vx = adx < KEEP_AWAY_MIN ? -dir * spd * 0.8 : adx > KEEP_AWAY_MAX ? dir * spd : 0
        this.setVelocityX(vx)
        this.patrolDir = dir
        this.setFlipX(dir < 0) // always face the hero, even while backing off
      } else {
        this.setVelocityX(arrive ? dir * spd * 0.45 * xMul : dir * spd * xMul)
        this.patrolDir = dir
        this.faceMoveDir()
      }
      // Advance walk frames by distance moved (~10px per frame) — no treadmill when slow.
      this.walkPhase += (Math.abs(body.velocity.x) * dt) / 1000 / 10
      this.applyPose()
      this.syncWeapon()
    }
  }

  /**
   * Smoothly walk toward hero's lane — one row at a time, per-enemy timing.
   * No synchronized jumps: each creep has its own react lag + switch CD.
   */
  private seekHeroLane(targetLane: LaneId, distX: number) {
    // Finish in-progress slide every frame.
    if (this.laneSliding) {
      this.smoothLaneSlide()
      return
    }
    if (this.lane === targetLane) {
      this.desiredLane = targetLane
      return
    }
    if (this.laneSwitchCd > 0) return
    // Far away: keep own row and approach on X first (no telepathic pack hop).
    if (distX > Math.max(220, this.aggroRadius * 0.85)) return

    const step = Math.sign(targetLane - this.lane)
    if (!step) return
    this.desiredLane = clampLane(this.lane + step)
    this.laneSliding = true
    // Individual cadence — elephants slower, fish snappier; + personal react lag.
    const base =
      this.species === 'elephant'
        ? Phaser.Math.Between(560, 920)
        : this.species === 'fish'
          ? Phaser.Math.Between(300, 520)
          : Phaser.Math.Between(380, 700)
    this.laneSwitchCd = base + this.laneReactLag
    this.smoothLaneSlide()
  }

  /** Lerp feet Y toward desiredLane; commit `lane` only when arrived. */
  private smoothLaneSlide() {
    const ty = laneY(this.desiredLane)
    const dy = ty - this.y
    if (Math.abs(dy) < 1.2) {
      this.setY(ty)
      this.lane = this.desiredLane
      this.homeY = ty
      this.laneSliding = false
      this.setDepth(actorDepth('enemy', this.lane, this.y))
      const body = this.body as Phaser.Physics.Arcade.Body | null
      if (body) {
        body.velocity.y = 0
        body.allowGravity = false
      }
      return
    }
    // Smooth ease — ~180–260 px/s equivalent at 60fps, not a teleport.
    const step = Math.sign(dy) * Math.min(Math.abs(dy), 3.6 + Math.random() * 1.4)
    this.setY(this.y + step)
    this.homeY = ty
    this.setDepth(actorDepth('enemy', this.desiredLane, this.y))
  }

  /** Face the side we're actually moving (forward or back). */
  private faceMoveDir() {
    const vx = (this.body as Phaser.Physics.Arcade.Body | null)?.velocity.x ?? 0
    if (Math.abs(vx) > 6) this.setFlipX(vx < 0)
    else this.setFlipX(this.patrolDir < 0)
  }

  private beginWindup(ms: number) {
    this.setFsm('ATTACK')
    this.atkPhase = 'windup'
    // 霸鼻象：蓄力至少 0.5s；其他種保持原 telegraph。
    if (this.species === 'elephant') {
      this.windup = Math.max(500, ms)
    } else if (this.species === 'fish') {
      // Charger: long, readable run-up so the hero can jump the dash.
      this.windup = aiNum('fish', 'telegraphMs', 500)
    } else {
      this.windup = Math.min(420, Math.max(220, ms))
    }
    this.hitThis = false
    freezeActors(this.scene, [this], ATTACK_COMMIT_FREEZE_MS)
    this.setTint(0xff1111)
    this.hooks.telegraph?.(this, this.altarAmbush ? 'ambush' : 'windup')
    this.applyPose()
    this.syncWeapon()
  }

  /** 霸鼻象打中後短暫霸體 */
  isDominating(now: number) {
    return this.species === 'elephant' && now < ((this.getData('dominateUntil') as number) || 0)
  }

  grantDominate(now: number, ms: number) {
    if (this.species !== 'elephant') return
    this.setData('dominateUntil', now + ms)
    this.setTint(0xffee88)
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
    const now = this.scene.time.now
    if (this.atkPhase === 'recover') {
      // Punish window: stand still (紅魚 dizzy after dash, 機械豬 exposed after slam).
      this.setVelocityX(0)
      this.applyPose()
      this.syncWeapon()
      if (this.think <= 0) {
        this.hitThis = false
        this.clearTint()
        this.setFsm('CHASE')
      }
      return
    }
    if (this.atkPhase === 'pause' || this.atkPhase === 'charge') this.atkPhase = 'windup'
    if (this.atkPhase === 'windup') {
      // Telegraph: plant feet and face the hero.
      this.setTint(0xff3333)
      this.setVelocityX(0)
      this.patrolDir = dir
      this.setFlipX(dir < 0)
      this.applyPose()
      this.syncWeapon()
      if (this.windup <= 0) {
        this.hitThis = false
        this.chargeDir = dir
        if (this.species === 'barrel') {
          // 帽仔兵: lob a rock and step back into range.
          this.hooks.spawnProjectile?.(this, dir)
          this.atkPhase = 'recover'
          this.think = 260
          this.atkCd = aiNum('barrel', 'throwIntervalMs', 1800)
          this.clearTint()
        } else if (this.species === 'fish') {
          this.atkPhase = 'strike'
          this.think = aiNum('fish', 'dashMs', 600)
        } else {
          this.atkPhase = 'strike'
          this.think = 260
        }
      }
      return
    }
    if (this.atkPhase === 'strike') {
      if (this.species === 'fish') {
        // Straight dash along the floor (keepEnemyOnTerrain stops it at pit edges).
        this.setVelocityX(this.chargeDir * aiNum('fish', 'dashSpeed', 180))
      } else {
        // 機械豬: short heavy lunge.
        this.setVelocityX(this.chargeDir * spd * 2.2)
      }
      this.applyPose()
      this.syncWeapon()
      if (this.think <= 0) {
        this.clearTint()
        this.atkPhase = 'recover'
        if (this.species === 'fish') {
          this.think = aiNum('fish', 'stunMs', 1000)
          this.hooks.floatBang?.(this.x, this.y - 44, '暈～')
        } else {
          const ms = aiNum('elephant', 'vulnerableAfterSlamMs', 1200)
          this.think = ms
          this.vulnerableUntil = now + ms
          this.hooks.floatBang?.(this.x, this.y - 60, '破綻！')
        }
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
      windupMs: Math.round(st.windupMs * (sp.windupMul ?? 1)),
      atkCdMs: Math.round(st.atkCdMs * (sp.atkCdMul ?? 1)),
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
    // While sliding between rows, don't hard-snap — seekHeroLane owns Y.
    if (this.laneSliding) {
      body.velocity.y = 0
      body.allowGravity = false
      return
    }
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
  /** Show a frame of an animation (manual frame index — used for distance-driven walks). */
  private showFrame(name: string, index: number) {
    const a = ANIM_SETS[this.animSet!].anims[name]
    if (!a) return
    if (this.anims.isPlaying) this.anims.stop()
    this.animState = `${name}#`
    this.setFrame(a.start + (((Math.floor(index) % a.count) + a.count) % a.count))
  }

  /** Play an animation once per state change (loops keep looping, one-shots hold). */
  private playState(name: string) {
    const set = this.animSet!
    if (!ANIM_SETS[set].anims[name]) return
    if (this.animState === name) return
    this.animState = name
    this.anims.play(`${set}-${name}`)
  }

  private applyAnimPose() {
    this.setScale(this.baseScale || 1)
    this.setAngle(0)
    const sp = this.species
    if (this.fsm === 'DEAD') return
    if (this.fsm === 'HURT') {
      this.playState(sp === 'elephant' ? 'block' : 'hit')
      return
    }
    const now = this.scene.time.now
    if (this.atkPhase === 'windup' || this.atkPhase === 'pause') {
      // Telegraph = the wind-up frames + a soft red pulse (the art already shows the tell).
      if (sp === 'fish') this.playState('charge')
      else if (sp === 'elephant') this.playState('windup')
      else this.showFrame(this.nextThrowHigh() ? 'throw-high' : 'throw-low', Math.min(1, ((now / 120) | 0) % 2))
      if (Math.floor(now / 90) % 2 === 0) this.setTint(0xff7070)
      else this.clearTint()
      return
    }
    if (this.atkPhase === 'charge' || this.atkPhase === 'strike') {
      this.clearTint()
      if (sp === 'fish') this.playState('dash')
      else if (sp === 'elephant') this.playState('lunge')
      else this.playState(this.nextThrowHigh() ? 'throw-high' : 'throw-low')
      return
    }
    if (this.atkPhase === 'recover') {
      if (sp === 'fish') this.playState('dizzy')
      else if (sp === 'elephant') this.playState('opening')
      else this.showFrame('throw-low', 3)
      return
    }
    // Walk frames advance with distance travelled (feet don't skate); stand on frame 0.
    const vx = Math.abs((this.body as Phaser.Physics.Arcade.Body | null)?.velocity.x ?? 0)
    this.showFrame('walk', vx > 8 ? this.walkPhase : 0)
  }

  /** 帽仔兵 alternates low / high rocks (GameScene.spawnRock reads the same counter). */
  private nextThrowHigh() {
    return (((this.getData('throwN') as number) || 0) + 1) % 2 === 0
  }

  private applyPose() {
    if (this.animSet) {
      this.applyAnimPose()
      this.syncWeapon()
      return
    }
    const lock = () => {
      // Keep fractional scale (elephant bigger than fish).
      this.setScale(this.baseScale || 1)
      this.setAngle(0)
    }
    const base = (this.getData('baseTex') as string) || 'art-enemy'
    const setTex = (key: string) => {
      if (this.scene.textures.exists(key) && this.texture.key !== key) this.setTexture(key)
    }
    if (this.fsm === 'DEAD' || this.fsm === 'HURT') {
      setTex(base)
      lock()
      this.syncWeapon()
      return
    }
    if (this.atkPhase === 'windup' || this.atkPhase === 'pause') {
      setTex(`${base}-atk-windup`)
      this.setTint(0xff1111)
      lock()
      this.syncWeapon()
      return
    }
    if (this.atkPhase === 'charge' || this.atkPhase === 'strike') {
      // Alternate 2 attack frames for readable strike motion.
      const strikeKey =
        Math.floor(this.walkPhase) % 2 === 0 ? `${base}-atk-strike` : `${base}-atk-windup`
      setTex(this.scene.textures.exists(strikeKey) ? strikeKey : `${base}-atk-strike`)
      this.walkPhase += 0.25
      lock()
      this.syncWeapon()
      return
    }
    const vx = Math.abs((this.body as Phaser.Physics.Arcade.Body | null)?.velocity.x ?? 0)
    if (vx > 8 && (this.fsm === 'CHASE' || this.fsm === 'PATROL' || this.atkPhase === 'recover')) {
      // walkPhase is advanced by distance in tick() — nothing extra here.
      // At least 2 distinct walk frames.
      const frame = Math.floor(this.walkPhase) % Math.max(2, WALK_FRAMES)
      setTex(`${base}-run-${frame}`)
      lock()
      this.syncWeapon()
      return
    }
    setTex(base)
    lock()
    this.syncWeapon()
  }

  protected override die(dir: number) {
    if (this.weapon) {
      this.weapon.destroy()
      this.weapon = null
    }
    if (this.animSet && this.scene.anims.exists(`${this.animSet}-die`)) {
      // Death plays on a detached sprite (the enemy body is removed by Enemy.die).
      const corpse = this.scene.add
        .sprite(this.x, this.y, animTex(this.animSet))
        .setOrigin(0.5, 1)
        .setFlipX(this.flipX)
        .setScale(this.baseScale || 1)
        .setDepth(this.depth)
      corpse.play(`${this.animSet}-die`)
      // `this` is destroyed ~280ms after die(), so drive the fade from the corpse's own scene.
      corpse.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        corpse.scene?.tweens.add({ targets: corpse, alpha: 0, delay: 350, duration: 300, onComplete: () => corpse.destroy() })
      })
      super.die(dir)
      this.setVisible(false)
      return
    }
    super.die(dir)
  }

  /** Public so GameScene can snap weapons on activate (deferred spawns). */
  syncWeaponPublic() {
    this.syncWeapon()
  }

  private syncWeapon() {
    const w = this.weapon
    if (!w) return
    // Deferred / hidden enemy → weapon must stay hidden too (was floating on the ground).
    if (!this.active || !this.visible) {
      w.setVisible(false)
      return
    }
    // Allow re-show after defer (setActive false on weapon)
    if (!w.active) w.setActive(true)
    if (this.fsm === 'DEAD') {
      w.setVisible(false)
      return
    }
    w.setVisible(true)
    const face = this.flipX ? -1 : 1
    const strike = this.atkPhase === 'strike' || this.atkPhase === 'charge'
    const wind = this.atkPhase === 'windup' || this.atkPhase === 'pause'
    const trunk = !!w.getData('isTrunk') || this.species === 'elephant'
    if (trunk) {
      // Always anchor trunk BASE on the face — never float to the ground.
      // Origin at the snout end so curl/thrust grows outward from the face.
      const faceX = this.x + face * (this.displayWidth * 0.4)
      const faceY = this.y - this.displayHeight * 0.58
      w.setOrigin(this.flipX ? 1 : 0, 0.5)
      if (wind) {
        if (this.scene.textures.exists('fx-elephant-trunk-0')) w.setTexture('fx-elephant-trunk-0')
        w.setPosition(faceX, faceY)
        w.setScale(WEAPON_DISPLAY_SCALE)
        w.setAngle(face * -55)
      } else if (strike) {
        if (this.scene.textures.exists('fx-elephant-trunk-1')) w.setTexture('fx-elephant-trunk-1')
        w.setPosition(faceX, faceY)
        // Long thrust from the face (reach handled by meleeRadius, not by moving sprite to ground).
        w.setScale(2 * WEAPON_DISPLAY_SCALE)
        w.setAngle(face * 8)
      } else {
        if (this.scene.textures.exists('fx-elephant-trunk-0')) w.setTexture('fx-elephant-trunk-0')
        w.setPosition(faceX, faceY + 2)
        w.setScale(WEAPON_DISPLAY_SCALE)
        w.setAngle(face * 28)
      }
      w.setFlipX(this.flipX)
      w.setDepth(actorDepth('enemy', this.lane, this.y) + 0.25)
      return
    }
    const knife = (w.texture?.key || '').includes('knife')
    const bodyH = Math.max(20, this.displayHeight || 40)
    const ox = strike ? (knife ? bodyH * 0.55 : bodyH * 0.5) : wind ? (knife ? bodyH * 0.15 : bodyH * 0.2) : bodyH * 0.32
    const oy = strike ? (knife ? -bodyH * 0.38 : -bodyH * 0.32) : wind ? -bodyH * 0.58 : -bodyH * 0.4
    w.setPosition(this.x + face * ox, this.y + oy)
    w.setScale(WEAPON_DISPLAY_SCALE)
    w.setFlipX(this.flipX)
    w.setAngle(strike ? face * (knife ? 5 : 25) : wind ? face * (knife ? -55 : -35) : face * -8)
    w.setDepth(actorDepth('enemy', this.lane, this.y) + 0.25)
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
