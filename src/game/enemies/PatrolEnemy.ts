import Phaser from 'phaser'
import { bindFootBody } from '../footBody'
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
    } = {},
  ): PatrolEnemy {
    const st = KIND_STATS[kind]
    const spKey = opts.species ?? defaultSpecies(kind)
    const sp = SPECIES_STATS[spKey]
    const tex = scene.textures.exists(sp.tex) ? sp.tex : 'art-enemy'
    const e = new PatrolEnemy(scene, x, y, tex)
    e.kind = kind
    e.species = spKey
    e.hp = st.hp
    e.maxHp = st.hp
    e.atkCd = Phaser.Math.Between(300, 800)
    e.patrolDir = Math.random() > 0.5 ? 1 : -1
    const span = kind === 'guardian' ? 90 : kind === 'ambusher' ? 48 : 70
    e.patrolMin = x - span
    e.patrolMax = x + span
    e.homeX = x
    e.homeY = y
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
    e.setDepth(6)
    e.setScale(e.baseScale)
    if (spKey === 'fish' && st.tint) e.setTint(st.tint)
    bindFootBody(e, {
      bodyW: spKey === 'barrel' ? 22 : 20,
      bodyH: spKey === 'barrel' ? 28 : 22,
    })
    e.setFsm('PATROL')
    group.add(e)
    const labelText = kind === 'boss' ? st.label : sp.label
    e.label = scene.add
      .text(x, y - 44, labelText, {
        fontFamily: 'Noto Sans TC, sans-serif',
        fontSize: kind === 'boss' ? '14px' : '11px',
        color: '#fff4e0',
        backgroundColor: spKey === 'barrel' ? '#3a2818cc' : '#301820cc',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(12)
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
    const advancing = ctx.leadX > ctx.prevLeadX + 0.4
    const aggro = st.aggro * mul.aggro
    const detectR = st.detect * mul.aggro
    const melee = st.melee
    const spd = st.spd * mul.spd
    const patrolSpd = st.patrolSpd * mul.spd
    const body = this.body as Phaser.Physics.Arcade.Body | null
    if (!body) return

    if (this.label?.active) {
      this.label.setPosition(this.x, this.y - (this.kind === 'boss' ? 56 : 40))
      this.label.setText(
        this.kind === 'boss'
          ? this.phase === 1
            ? '武者・壹'
            : this.phase === 2
              ? '武者・貳'
              : '武者・參'
          : sp.label,
      )
    }

    if (this.fsm === 'HURT') {
      this.applyPose()
      if (this.think <= 0) {
        this.clearTint()
        const t = this.defaultTint()
        if (t) this.setTint(t)
        this.poseAngle = 0
        this.setFsm(dist < aggro ? 'CHASE' : 'PATROL')
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

    if (
      st.chargePrefer &&
      this.atkCd <= 0 &&
      this.fsm === 'CHASE' &&
      dist > melee + 20 &&
      dist < melee + (sp.style === 'hop' ? 170 : 140)
    ) {
      this.setFsm('ATTACK')
      this.atkPhase = 'pause'
      // Charge pause = readable red telegraph before lunge (≥260ms).
      this.think = Math.max(
        this.altarAmbush ? 300 : 260,
        260 + (this.kind === 'boss' ? 80 : 0),
      )
      this.hitThis = false
      this.setVelocityX(0)
      this.setTint(0xff1111)
      this.hooks.floatBang?.(
        this.x,
        this.y - 36,
        this.altarAmbush ? '伏兵！' : '！',
      )
      this.hooks.telegraph?.(this, this.altarAmbush ? 'ambush' : 'windup')
      this.applyPose()
      return
    }

    // Opening auto-aggro: first confrontation without a long walk-to-combat.
    if (
      this.earlyAggro &&
      this.fsm === 'PATROL' &&
      dist < Math.max(detectR, aggro + 40)
    ) {
      this.hooks.floatBang?.(this.x, this.y - 36, '！')
      this.think = 120
      this.setFsm('CHASE')
      this.setVelocityX(0)
      this.applyPose()
      return
    }

    if (this.fsm === 'PATROL' && dist < detectR) {
      this.hooks.floatBang?.(this.x, this.y - 36)
      this.think = 180
      this.setFsm('CHASE')
      this.setVelocityX(0)
      this.applyPose()
      return
    }

    if (this.fsm !== 'CHASE' && dist < aggro && this.kind === 'chaser') this.setFsm('CHASE')

    if (
      (this.fsm === 'CHASE' || this.fsm === 'PATROL') &&
      this.hopCd <= 0 &&
      body.blocked.down &&
      Math.random() < st.hopChance
    ) {
      this.think = sp.style === 'hop' ? 260 : 220
      this.hopCd = (sp.style === 'hop' ? 420 : 700) + Math.random() * (sp.style === 'hop' ? 520 : 900)
      const dir = (Math.sign(target.x - this.x) || this.patrolDir) as 1 | -1
      this.chargeDir = dir
      this.setVelocityY(sp.style === 'hop' ? -360 - Math.random() * 100 : -280 - Math.random() * 80)
      this.setVelocityX(dir * spd * (sp.style === 'hop' ? 1.35 : 1.1))
      this.setFlipX(dir > 0)
      this.applyPose()
      return
    }

    if (this.fsm === 'CHASE') {
      const dropMul = sp.style === 'chase' ? 1.5 : 1.2
      if (dist > aggro * dropMul && this.kind !== 'chaser' && this.kind !== 'boss') {
        this.setFsm('PATROL')
      } else {
        const goal = this.desireX(target, ctx.leadX, advancing)
        const dir = (Math.sign(goal - this.x) || 1) as 1 | -1
        if (this.kind === 'ambusher' && target.y > this.y + 30 && body.blocked.down) {
          this.setVelocityY(-280)
        }
        if (sp.style === 'hop' && body.blocked.down && this.hopCd <= 0 && Math.random() < 0.04) {
          this.setVelocityY(-220)
          this.hopCd = 280
        }
        const boost = this.kind === 'interrupter' && advancing ? 1.3 : 1
        this.setVelocityX(dir * spd * boost)
        this.setFlipX(dir > 0)
        this.patrolDir = dir
        this.applyPose()
        return
      }
    }

    this.setFsm('PATROL')
    if (this.kind === 'blocker') {
      const goal = this.desireX(target, ctx.leadX, advancing)
      this.patrolDir = (Math.sign(goal - this.x) || this.patrolDir) as 1 | -1
      this.reverseIfBlockedOrCliff()
      this.setVelocityX(this.patrolDir * patrolSpd)
      this.setFlipX(this.patrolDir > 0)
      this.applyPose()
      return
    }
    if (this.x < this.patrolMin) this.patrolDir = 1
    if (this.x > this.patrolMax) this.patrolDir = -1
    this.reverseIfBlockedOrCliff()
    const slow = this.kind === 'ambusher' ? 0.7 : 1
    this.setVelocityX(this.patrolDir * patrolSpd * slow)
    this.setFlipX(this.patrolDir > 0)
    this.applyPose()
  }

  private beginWindup(ms: number) {
    this.setFsm('ATTACK')
    this.atkPhase = 'windup'
    // Fair telegraph: red + pause ≥260ms (altar ≥300ms) before lunge.
    const floor = this.altarAmbush ? 300 : 260
    this.windup = Math.max(floor, ms)
    this.hitThis = false
    this.setVelocityX(0)
    this.setTint(0xff1111)
    this.hooks.floatBang?.(
      this.x,
      this.y - 36,
      this.altarAmbush ? '伏兵！' : '！',
    )
    this.hooks.telegraph?.(this, this.altarAmbush ? 'ambush' : 'windup')
    this.applyPose()
  }

  private tickAttack(
    target: { x: number; y: number },
    dist: number,
    aggro: number,
    spd: number,
    st: ReturnType<PatrolEnemy['effectiveStats']>,
    sp: (typeof SPECIES_STATS)[EnemySpecies],
  ) {
    if (this.atkPhase === 'recover') {
      this.setVelocityX(0)
      this.applyPose()
      if (this.think <= 0) {
        this.hitThis = false
        if (this.kind === 'boss' && this.phase === 3) {
          const away = (Math.sign(this.x - target.x) || 1) as 1 | -1
          this.setFsm('CHASE')
          this.think = 320
          this.setVelocityX(away * spd * 1.15)
          this.setFlipX(away > 0)
        } else if (this.kind === 'ambusher') this.setFsm('PATROL')
        else this.setFsm(dist < aggro ? 'CHASE' : 'PATROL')
      }
      return
    }
    if (this.atkPhase === 'pause') {
      this.setVelocityX(0)
      this.setTint(0xff4444)
      this.applyPose()
      if (this.think <= 0) {
        this.atkPhase = 'charge'
        this.think = 280
        this.hitThis = false
        this.chargeDir = (Math.sign(target.x - this.x) || 1) as 1 | -1
        this.setVelocityX(this.chargeDir * spd * 2.35)
        this.setVelocityY(sp.style === 'hop' ? -220 : -160)
        this.setFlipX(this.chargeDir > 0)
        this.hooks.floatBang?.(this.x, this.y - 36)
      }
      return
    }
    if (this.atkPhase === 'charge') {
      this.applyPose()
      if (this.think <= 0) {
        this.clearTint()
        const t = this.defaultTint()
        if (t) this.setTint(t)
        this.atkPhase = 'recover'
        this.think = st.recoverMs
        this.atkCd = st.atkCdMs
        this.setVelocityX(0)
      }
      return
    }
    if (this.atkPhase === 'windup') {
      this.setVelocityX(0)
      this.setTint(0xff3333)
      this.applyPose()
      if (this.windup <= 0) {
        this.atkPhase = 'strike'
        this.hitThis = false
        this.think = 200
        const dir = (Math.sign(target.x - this.x) || 1) as 1 | -1
        this.chargeDir = dir
        if (this.attackMode === 'projectile') {
          this.hooks.spawnProjectile?.(this, dir)
          this.setVelocityX(0)
        } else {
          this.setVelocityX(dir * spd * (sp.style === 'hop' ? 2.05 : 1.85))
          this.setVelocityY(sp.style === 'hop' ? -300 : -220)
        }
        this.setFlipX(dir > 0)
      }
      return
    }
    if (this.atkPhase === 'strike') {
      this.applyPose()
      if (this.think <= 0) {
        this.clearTint()
        const t = this.defaultTint()
        if (t) this.setTint(t)
        this.atkPhase = 'recover'
        this.think = st.recoverMs
        this.atkCd = st.atkCdMs
        this.setVelocityX(0)
      }
      return
    }
    this.setFsm(dist < aggro ? 'CHASE' : 'PATROL')
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

  private desireX(target: { x: number; y: number }, leadX: number, advancing: boolean): number {
    switch (this.kind) {
      case 'blocker':
        return Math.max(this.homeX - 40, Math.min(leadX + 90, this.homeX + 220))
      case 'chaser':
        return target.x
      case 'ambusher':
        return this.fsm === 'PATROL' ? this.homeX : target.x
      case 'guardian':
        if (Phaser.Math.Distance.Between(target.x, target.y, this.guardX, this.homeY) < 160) return target.x
        return this.guardX
      case 'interrupter':
        return advancing ? leadX + 70 : target.x
      case 'boss':
        if (this.phase === 3 && this.think > 0 && this.fsm === 'CHASE') {
          return this.x + (target.x < this.x ? 120 : -120)
        }
        return target.x
    }
  }

  private applyPose() {
    // Integer baseScale + angle-only feedback — NEAREST shreds non-uniform scale.
    const q = (ang = 0) => {
      this.setScale(this.baseScale)
      this.setAngle(Math.round(ang))
    }
    if (this.fsm === 'DEAD') {
      q(this.poseAngle)
      return
    }
    if (this.fsm === 'HURT') {
      q(this.poseAngle)
      return
    }
    if (this.atkPhase === 'windup' || this.atkPhase === 'pause') {
      q(-this.patrolDir * 6)
      this.setTint(0xff1111)
      return
    }
    if (this.atkPhase === 'charge' || this.atkPhase === 'strike') {
      q(this.chargeDir * 8)
      return
    }
    q(0)
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
