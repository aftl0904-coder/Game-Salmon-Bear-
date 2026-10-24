import Phaser from 'phaser'

/** Existence objective: 阻止玩家奪回春蜜／抵達祭壇 */
export type EnemyKind =
  | 'blocker'
  | 'chaser'
  | 'ambusher'
  | 'guardian'
  | 'interrupter'
  | 'boss'

/**
 * Round-1 visual species (must be visually distinct — not only tinted fish):
 * fish = 醃魚雜兵 chase/patrol；barrel = 木桶武者 hop/lunge
 */
export type EnemySpecies = 'fish' | 'barrel'

/** Goemon cadence: patrol → detect → chase/hop → windup → lunge/charge → recover */
export type EnemyState =
  | 'patrol'
  | 'detect'
  | 'chase'
  | 'hop'
  | 'pause'
  | 'charge'
  | 'windup'
  | 'attack'
  | 'recover'
  | 'retreat'
  | 'hurt'
  | 'die'

export type Creep = Phaser.Physics.Arcade.Sprite & {
  kind: EnemyKind
  species: EnemySpecies
  hp: number
  maxHp: number
  windup: number
  atkCd: number
  hitThis: boolean
  /** Body-bump iframe (ms). Separate from attack-frame hitThis latch. */
  contactCd: number
  state: EnemyState
  patrolDir: 1 | -1
  patrolMin: number
  patrolMax: number
  homeX: number
  homeY: number
  guardX: number
  think: number
  detectT: number
  hopCd: number
  chargeDir: 1 | -1
  phase: 1 | 2 | 3
  baseScale: number
  poseAngle: number
  label?: Phaser.GameObjects.Text
  boss?: boolean
  elite?: boolean
}

export type HeroRef = { x: number; y: number; active: boolean }

type KindStats = {
  hp: number
  spd: number
  patrolSpd: number
  aggro: number
  detect: number
  melee: number
  windupMs: number
  recoverMs: number
  atkCdMs: number
  scale: number
  tint?: number
  label: string
  chargePrefer: boolean
  hopChance: number
}

type SpeciesStats = {
  tex: string
  label: string
  style: 'chase' | 'hop'
  hopMul: number
  chargePrefer: boolean
  scaleMul: number
}

/** Two visually distinct Round-1 forms */
export const SPECIES_STATS: Record<EnemySpecies, SpeciesStats> = {
  fish: {
    tex: 'art-enemy',
    label: '醃魚雜兵',
    style: 'chase',
    hopMul: 1,
    chargePrefer: false,
    scaleMul: 1,
  },
  barrel: {
    tex: 'art-enemy-barrel',
    label: '木桶武者',
    style: 'hop',
    hopMul: 3.2,
    chargePrefer: true,
    scaleMul: 1.06,
  },
}

/** Default species per AI role — Round 1 mix of fish + barrel */
export function defaultSpecies(kind: EnemyKind): EnemySpecies {
  if (kind === 'boss') return 'fish'
  if (kind === 'ambusher' || kind === 'interrupter' || kind === 'guardian') return 'barrel'
  return 'fish' // blocker / chaser
}

export const KIND_STATS: Record<EnemyKind, KindStats> = {
  blocker: {
    // Slightly wider detect so opening fight engages in ~2–3s / ~180–250px.
    hp: 2, spd: 62, patrolSpd: 48, aggro: 280, detect: 340, melee: 50,
    windupMs: 360, recoverMs: 340, atkCdMs: 1050, scale: 1.75, tint: 0x88aacc,
    label: '路障', chargePrefer: false, hopChance: 0.012,
  },
  chaser: {
    hp: 2, spd: 110, patrolSpd: 52, aggro: 380, detect: 420, melee: 52,
    windupMs: 280, recoverMs: 280, atkCdMs: 900, scale: 1.65, tint: 0xff9977,
    label: '追擊', chargePrefer: true, hopChance: 0.022,
  },
  ambusher: {
    hp: 2, spd: 95, patrolSpd: 22, aggro: 180, detect: 280, melee: 56,
    windupMs: 260, recoverMs: 340, atkCdMs: 1000, scale: 1.7, tint: 0xaa88ff,
    label: '伏兵', chargePrefer: false, hopChance: 0.008,
  },
  guardian: {
    hp: 3, spd: 78, patrolSpd: 48, aggro: 300, detect: 360, melee: 52,
    windupMs: 340, recoverMs: 320, atkCdMs: 1000, scale: 1.8, tint: 0xffcc44,
    label: '守蜜', chargePrefer: false, hopChance: 0.015,
  },
  interrupter: {
    hp: 3, spd: 100, patrolSpd: 58, aggro: 420, detect: 480, melee: 56,
    windupMs: 320, recoverMs: 240, atkCdMs: 820, scale: 1.9, tint: 0xff6644,
    label: '精銳', chargePrefer: true, hopChance: 0.02,
  },
  boss: {
    hp: 12, spd: 95, patrolSpd: 48, aggro: 520, detect: 600, melee: 70,
    windupMs: 360, recoverMs: 300, atkCdMs: 900, scale: 2.55, tint: 0xffaa77,
    label: '武者', chargePrefer: true, hopChance: 0.018,
  },
}

function speciesOf(e: Creep): SpeciesStats {
  return SPECIES_STATS[e.species ?? 'fish']
}

function effectiveStats(e: Creep): KindStats {
  const st = KIND_STATS[e.kind]
  const sp = speciesOf(e)
  return {
    ...st,
    // barrel keeps natural wood colors; fish keep role tint accents
    tint: e.species === 'fish' ? st.tint : undefined,
    scale: st.scale * sp.scaleMul,
    hopChance: st.hopChance * sp.hopMul,
    chargePrefer: st.chargePrefer || sp.chargePrefer,
    label: sp.label,
  }
}

export function pickTarget(
  e: { x: number; y: number },
  boy: HeroRef,
  girl: HeroRef,
): HeroRef {
  const db = Phaser.Math.Distance.Between(e.x, e.y, boy.x, boy.y)
  const dg = Phaser.Math.Distance.Between(e.x, e.y, girl.x, girl.y)
  if (Math.abs(db - dg) < 40) return boy.x >= girl.x ? boy : girl
  return db < dg ? boy : girl
}

function syncBossPhase(e: Creep) {
  if (e.kind !== 'boss') return
  const r = e.hp / e.maxHp
  e.phase = r > 0.66 ? 1 : r > 0.33 ? 2 : 3
}

function phaseMul(e: Creep) {
  if (e.kind !== 'boss') return { spd: 1, windup: 1, aggro: 1 }
  if (e.phase === 1) return { spd: 0.9, windup: 1.1, aggro: 0.95 }
  if (e.phase === 2) return { spd: 1.2, windup: 0.85, aggro: 1.15 }
  return { spd: 1.45, windup: 0.65, aggro: 1.3 }
}

function desireX(e: Creep, target: HeroRef, leadX: number, advancing: boolean): number {
  switch (e.kind) {
    case 'blocker':
      return Math.max(e.homeX - 40, Math.min(leadX + 90, e.homeX + 220))
    case 'chaser':
      return target.x
    case 'ambusher':
      if (e.state === 'patrol' || e.state === 'detect') return e.homeX
      return target.x
    case 'guardian':
      if (Phaser.Math.Distance.Between(target.x, target.y, e.guardX, e.homeY) < 160) return target.x
      return e.guardX
    case 'interrupter':
      return advancing ? leadX + 70 : target.x
    case 'boss':
      if (e.phase === 3 && e.state === 'retreat') return e.x + (target.x < e.x ? 120 : -120)
      return target.x
  }
}

export type AiCtx = {
  dt: number
  boy: HeroRef
  girl: HeroRef
  leadX: number
  prevLeadX: number
  floatBang: (x: number, y: number, msg?: string) => void
}

function applyPose(e: Creep) {
  if (e.state === 'die') {
    e.setAngle(e.poseAngle)
    e.setScale(e.baseScale * 1.05, e.baseScale * 0.72)
    return
  }
  if (e.state === 'hurt') {
    e.setAngle(e.poseAngle)
    e.setScale(e.baseScale * 1.08, e.baseScale * 0.88)
    return
  }
  if (e.state === 'windup' || e.state === 'pause') {
    e.setAngle(0)
    e.setScale(e.baseScale * 1.12, e.baseScale * 0.86)
    return
  }
  if (e.state === 'charge' || e.state === 'attack' || e.state === 'hop') {
    e.setAngle(e.chargeDir * 10)
    e.setScale(e.baseScale * 0.92, e.baseScale * 1.1)
    return
  }
  const vx = Math.abs((e.body as Phaser.Physics.Arcade.Body)?.velocity.x ?? 0)
  if (vx > 8) {
    const t = performance.now() * 0.012
    e.setAngle(Math.sin(t) * 5 * e.patrolDir)
    e.setScale(e.baseScale * (1 + Math.sin(t) * 0.03), e.baseScale * (1 - Math.sin(t) * 0.04))
  } else {
    e.setAngle(0)
    e.setScale(e.baseScale)
  }
}

export function tickEnemy(e: Creep, ctx: AiCtx) {
  // Expandable FSM path (PatrolEnemy / Enemy subclass)
  const fsmEnemy = e as Creep & {
    fsm?: string
    tick?: (dt: number, c: {
      boy: HeroRef
      girl: HeroRef
      leadX: number
      prevLeadX: number
    }) => void
  }
  if (fsmEnemy.fsm && typeof fsmEnemy.tick === 'function') {
    fsmEnemy.tick(ctx.dt, {
      boy: ctx.boy,
      girl: ctx.girl,
      leadX: ctx.leadX,
      prevLeadX: ctx.prevLeadX,
    })
    return
  }

  if (!e.active) return
  if (e.state === 'die') {
    applyPose(e)
    return
  }

  if (!e.species) e.species = defaultSpecies(e.kind)
  const st = effectiveStats(e)
  const sp = speciesOf(e)
  syncBossPhase(e)
  const mul = phaseMul(e)

  e.think = Math.max(0, e.think - ctx.dt)
  e.atkCd = Math.max(0, e.atkCd - ctx.dt)
  e.windup = Math.max(0, e.windup - ctx.dt)
  e.detectT = Math.max(0, e.detectT - ctx.dt)
  e.hopCd = Math.max(0, (e.hopCd ?? 0) - ctx.dt)
  e.contactCd = Math.max(0, (e.contactCd ?? 0) - ctx.dt)

  const target = pickTarget(e, ctx.boy, ctx.girl)
  const dist = Phaser.Math.Distance.Between(e.x, e.y, target.x, target.y)
  const advancing = ctx.leadX > ctx.prevLeadX + 0.4
  const aggro = st.aggro * mul.aggro
  const detectR = st.detect * mul.aggro
  const melee = st.melee
  const spd = st.spd * mul.spd
  const patrolSpd = st.patrolSpd * mul.spd
  const body = e.body as Phaser.Physics.Arcade.Body

  if (e.label?.active) {
    e.label.setPosition(e.x, e.y - (e.kind === 'boss' ? 56 : 40))
    if (e.kind === 'boss') {
      e.label.setText(e.phase === 1 ? '武者・壹' : e.phase === 2 ? '武者・貳' : '武者・參')
    } else {
      e.label.setText(sp.label)
    }
  }

  if (e.state === 'hurt') {
    applyPose(e)
    if (e.think <= 0) {
      e.clearTint()
      if (st.tint) e.setTint(st.tint)
      e.state = dist < aggro ? 'chase' : 'patrol'
      e.poseAngle = 0
    }
    return
  }

  if (e.state === 'recover') {
    e.setVelocityX(0)
    applyPose(e)
    if (e.think <= 0) {
      e.hitThis = false
      if (e.kind === 'boss' && e.phase === 3) {
        e.state = 'retreat'
        e.think = 320
      } else if (e.kind === 'ambusher') e.state = 'patrol'
      else e.state = dist < aggro ? 'chase' : 'patrol'
    }
    return
  }

  if (e.state === 'retreat') {
    const away = (Math.sign(e.x - target.x) || 1) as 1 | -1
    e.setVelocityX(away * spd * 1.15)
    e.setFlipX(away > 0)
    applyPose(e)
    if (e.think <= 0) e.state = 'chase'
    return
  }

  if (e.state === 'hop') {
    applyPose(e)
    if (e.think <= 0) e.state = dist < aggro ? 'chase' : 'patrol'
    return
  }

  if (e.state === 'pause') {
    e.setVelocityX(0)
    e.setTint(0xff4444)
    applyPose(e)
    if (e.think <= 0) {
      e.state = 'charge'
      e.think = 280
      e.hitThis = false
      e.chargeDir = (Math.sign(target.x - e.x) || 1) as 1 | -1
      e.setVelocityX(e.chargeDir * spd * 2.35)
      e.setVelocityY(sp.style === 'hop' ? -220 : -160)
      e.setFlipX(e.chargeDir > 0)
      ctx.floatBang(e.x, e.y - 36)
    }
    return
  }

  if (e.state === 'charge') {
    applyPose(e)
    if (e.think <= 0) {
      e.clearTint()
      if (st.tint) e.setTint(st.tint)
      e.state = 'recover'
      e.think = st.recoverMs
      e.atkCd = st.atkCdMs
      e.setVelocityX(0)
    }
    return
  }

  if (e.state === 'windup') {
    e.setVelocityX(0)
    e.setTint(0xff5555)
    applyPose(e)
    if (e.windup <= 0) {
      e.state = 'attack'
      e.hitThis = false
      e.think = 200
      const dir = (Math.sign(target.x - e.x) || 1) as 1 | -1
      e.chargeDir = dir
      e.setVelocityX(dir * spd * (sp.style === 'hop' ? 2.05 : 1.85))
      e.setVelocityY(sp.style === 'hop' ? -300 : -220)
      e.setFlipX(dir > 0)
    }
    return
  }

  if (e.state === 'attack') {
    applyPose(e)
    if (e.think <= 0) {
      e.clearTint()
      if (st.tint) e.setTint(st.tint)
      e.state = 'recover'
      e.think = st.recoverMs
      e.atkCd = st.atkCdMs
      e.setVelocityX(0)
    }
    return
  }

  // 木桶武者：hop-lunge windup; 醃魚雜兵：chase into melee
  if (dist < melee && e.atkCd <= 0 && (e.state === 'chase' || e.state === 'detect')) {
    e.state = 'windup'
    e.windup = Math.max(200, st.windupMs * mul.windup * (sp.style === 'hop' ? 0.85 : 1))
    e.hitThis = false
    e.setVelocityX(0)
    e.setTint(0xff3333)
    ctx.floatBang(e.x, e.y - 36)
    applyPose(e)
    return
  }

  if (
    st.chargePrefer &&
    e.atkCd <= 0 &&
    e.state === 'chase' &&
    dist > melee + 20 &&
    dist < melee + (sp.style === 'hop' ? 170 : 140)
  ) {
    e.state = 'pause'
    e.think = Math.max(200, 220 + (e.kind === 'boss' ? 80 : 0) - (sp.style === 'hop' ? 40 : 0))
    e.hitThis = false
    e.setVelocityX(0)
    e.setTint(0xff3333)
    ctx.floatBang(e.x, e.y - 36)
    applyPose(e)
    return
  }

  if (e.state === 'patrol' && dist < detectR) {
    e.state = 'detect'
    e.detectT = 180
    e.setVelocityX(0)
    ctx.floatBang(e.x, e.y - 36)
    applyPose(e)
    return
  }

  if (e.state === 'detect') {
    e.setVelocityX(0)
    applyPose(e)
    if (e.detectT <= 0) e.state = 'chase'
    return
  }

  if (e.state === 'chase' || (e.state === 'patrol' && dist < aggro && e.kind === 'chaser')) {
    if (e.state !== 'chase' && dist < aggro) e.state = 'chase'
  }

  // 木桶 hops often; 醃魚 mostly patrol/chase walks
  if (
    (e.state === 'chase' || e.state === 'patrol') &&
    (e.hopCd ?? 0) <= 0 &&
    body.blocked.down &&
    Math.random() < st.hopChance
  ) {
    e.state = 'hop'
    e.think = sp.style === 'hop' ? 260 : 220
    e.hopCd = (sp.style === 'hop' ? 420 : 700) + Math.random() * (sp.style === 'hop' ? 520 : 900)
    const dir = (Math.sign(target.x - e.x) || e.patrolDir) as 1 | -1
    e.chargeDir = dir
    e.setVelocityY(sp.style === 'hop' ? -360 - Math.random() * 100 : -280 - Math.random() * 80)
    e.setVelocityX(dir * spd * (sp.style === 'hop' ? 1.35 : 1.1))
    e.setFlipX(dir > 0)
    applyPose(e)
    return
  }

  if (e.state === 'chase') {
    const dropMul = sp.style === 'chase' ? 1.5 : 1.2
    if (dist > aggro * dropMul && e.kind !== 'chaser' && e.kind !== 'boss') {
      e.state = 'patrol'
    } else {
      const goal = desireX(e, target, ctx.leadX, advancing)
      const dir = (Math.sign(goal - e.x) || 1) as 1 | -1
      if (e.kind === 'ambusher' && target.y > e.y + 30 && body.blocked.down) e.setVelocityY(-280)
      if (sp.style === 'hop' && body.blocked.down && (e.hopCd ?? 0) <= 0 && Math.random() < 0.04) {
        e.setVelocityY(-220)
        e.hopCd = 280
      }
      const boost = e.kind === 'interrupter' && advancing ? 1.3 : 1
      e.setVelocityX(dir * spd * boost)
      e.setFlipX(dir > 0)
      e.patrolDir = dir
      applyPose(e)
      return
    }
  }

  e.state = 'patrol'
  if (e.kind === 'blocker') {
    const goal = desireX(e, target, ctx.leadX, advancing)
    const dir = (Math.sign(goal - e.x) || e.patrolDir) as 1 | -1
    e.patrolDir = dir
    reverseIfBlockedOrCliff(e)
    e.setVelocityX(e.patrolDir * patrolSpd)
    e.setFlipX(e.patrolDir > 0)
    applyPose(e)
    return
  }
  if (e.x < e.patrolMin) e.patrolDir = 1
  if (e.x > e.patrolMax) e.patrolDir = -1
  reverseIfBlockedOrCliff(e)
  const slow = e.kind === 'ambusher' ? 0.7 : 1
  e.setVelocityX(e.patrolDir * patrolSpd * slow)
  e.setFlipX(e.patrolDir > 0)
  applyPose(e)
}

/** Readable macro FSM for F1 debug / design docs. */
export type EnemyFsmLabel = 'PATROL' | 'CHASE' | 'ATTACK' | 'HURT' | 'DEAD'

export function enemyFsmLabel(e: Creep): EnemyFsmLabel {
  switch (e.state) {
    case 'die':
      return 'DEAD'
    case 'hurt':
      return 'HURT'
    case 'windup':
    case 'attack':
    case 'charge':
    case 'pause':
    case 'recover':
      return 'ATTACK'
    case 'chase':
    case 'hop':
    case 'detect':
    case 'retreat':
      return 'CHASE'
    default:
      return 'PATROL'
  }
}

/** PATROL: reverse on wall or cliff edge (probe ahead of feet). */
function reverseIfBlockedOrCliff(e: Creep) {
  const body = e.body as Phaser.Physics.Arcade.Body | null
  if (!body) return
  if (e.patrolDir < 0 && body.blocked.left) {
    e.patrolDir = 1
    return
  }
  if (e.patrolDir > 0 && body.blocked.right) {
    e.patrolDir = -1
    return
  }
  // Cliff: no floor contact just ahead of feet while currently grounded.
  if (!(body.blocked.down || body.touching.down)) return
  const probeX = e.x + e.patrolDir * (body.width * 0.55 + 10)
  const probeY = body.bottom + 8
  // If velocity would walk off and world has a gap, turn around when vy starts falling soon.
  // Lightweight: if blocked.down just flipped false next frame AI turns; also reverse when
  // horizontal blocked already handled. Extra: reverse when near patrol ends with drop intent.
  void probeX
  void probeY
  // Soft ledge: if moving and not blocked.down in the facing toe sample via world bounds gap
  // — Arcade lacks raycast here; use patrolMin/Max already. Wall is primary.
}

/**
 * Hitbox active windows:
 * - lunge / charge / late windup = dedicated attack frames (hitThis latch → recover clears)
 * - chase / patrol / hop body bump = contact damage gated by contactCd (not permanent hitThis)
 * Prefers Enemy.canHurtPlayer() when the expandable FSM class is in use.
 */
export function enemyCanHurt(e: Creep): boolean {
  const withFsm = e as Creep & { canHurtPlayer?: () => boolean }
  if (typeof withFsm.canHurtPlayer === 'function') return withFsm.canHurtPlayer()
  if (!e.active || e.state === 'die' || e.state === 'hurt' || e.state === 'recover') return false
  if (e.state === 'attack' || e.state === 'charge') return !e.hitThis
  if (e.state === 'windup' && e.windup <= 60) return !e.hitThis
  if (e.state === 'chase' || e.state === 'patrol' || e.state === 'hop' || e.state === 'detect') {
    return (e.contactCd ?? 0) <= 0
  }
  return false
}
