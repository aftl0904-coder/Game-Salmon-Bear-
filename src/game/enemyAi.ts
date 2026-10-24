import Phaser from 'phaser'

/** Existence objective for every foe: 阻止玩家完成任務（奪回春蜜／抵達祭壇） */
export type EnemyKind =
  | 'blocker' // 路障：卡在右進路、切斷推進
  | 'chaser' // 追擊：發現就咬住不放
  | 'ambusher' // 平台伏兵：靜候→突襲下跳／撲擊
  | 'guardian' // 蜜罐守護：守住春蜜罐
  | 'interrupter' // 精銳干擾：玩家前進時施壓打斷節奏
  | 'boss' // 關底武者：多階段

export type EnemyState =
  | 'patrol'
  | 'detect'
  | 'chase'
  | 'windup'
  | 'attack'
  | 'recover'
  | 'retreat'

export type Creep = Phaser.Physics.Arcade.Sprite & {
  kind: EnemyKind
  hp: number
  maxHp: number
  windup: number
  atkCd: number
  hitThis: boolean
  state: EnemyState
  patrolDir: 1 | -1
  patrolMin: number
  patrolMax: number
  homeX: number
  homeY: number
  guardX: number
  think: number
  detectT: number
  phase: 1 | 2 | 3
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
}

/** Tuned easier than classic 吞食天地 — telegraphs are readable */
export const KIND_STATS: Record<EnemyKind, KindStats> = {
  blocker: {
    hp: 2,
    spd: 42,
    patrolSpd: 28,
    aggro: 220,
    detect: 300,
    melee: 46,
    windupMs: 520,
    recoverMs: 480,
    atkCdMs: 1400,
    scale: 1.75,
    tint: 0x88aacc,
    label: '路障',
  },
  chaser: {
    hp: 2,
    spd: 78,
    patrolSpd: 36,
    aggro: 340,
    detect: 400,
    melee: 48,
    windupMs: 400,
    recoverMs: 360,
    atkCdMs: 1100,
    scale: 1.65,
    tint: 0xff9977,
    label: '追擊',
  },
  ambusher: {
    hp: 2,
    spd: 70,
    patrolSpd: 18,
    aggro: 160,
    detect: 260,
    melee: 52,
    windupMs: 360,
    recoverMs: 420,
    atkCdMs: 1200,
    scale: 1.7,
    tint: 0xaa88ff,
    label: '伏兵',
  },
  guardian: {
    hp: 3,
    spd: 55,
    patrolSpd: 32,
    aggro: 280,
    detect: 340,
    melee: 50,
    windupMs: 480,
    recoverMs: 400,
    atkCdMs: 1250,
    scale: 1.8,
    tint: 0xffcc44,
    label: '守蜜',
  },
  interrupter: {
    hp: 3,
    spd: 68,
    patrolSpd: 40,
    aggro: 380,
    detect: 460,
    melee: 54,
    windupMs: 560,
    recoverMs: 300,
    atkCdMs: 1000,
    scale: 1.9,
    tint: 0xff6644,
    label: '精銳',
  },
  boss: {
    hp: 9,
    spd: 72,
    patrolSpd: 34,
    aggro: 480,
    detect: 560,
    melee: 66,
    windupMs: 520,
    recoverMs: 380,
    atkCdMs: 1100,
    scale: 2.55,
    tint: 0xffaa77,
    label: '武者',
  },
}

export function pickTarget(e: Creep, boy: HeroRef, girl: HeroRef): HeroRef {
  const db = Phaser.Math.Distance.Between(e.x, e.y, boy.x, boy.y)
  const dg = Phaser.Math.Distance.Between(e.x, e.y, girl.x, girl.y)
  // Prefer the lead (rightmost) when close — cut off progress
  if (Math.abs(db - dg) < 40) return boy.x >= girl.x ? boy : girl
  return db < dg ? boy : girl
}

function syncBossPhase(e: Creep) {
  if (e.kind !== 'boss') return
  const r = e.hp / e.maxHp
  e.phase = r > 0.66 ? 1 : r > 0.33 ? 2 : 3
}

function phaseMul(e: Creep): { spd: number; windup: number; aggro: number } {
  if (e.kind !== 'boss') return { spd: 1, windup: 1, aggro: 1 }
  if (e.phase === 1) return { spd: 0.85, windup: 1.15, aggro: 0.9 }
  if (e.phase === 2) return { spd: 1.15, windup: 0.9, aggro: 1.1 }
  return { spd: 1.4, windup: 0.7, aggro: 1.25 }
}

/** Desired X this tick based on kind objective */
function desireX(
  e: Creep,
  target: HeroRef,
  leadX: number,
  advancing: boolean,
): number {
  switch (e.kind) {
    case 'blocker':
      // Stand slightly ahead of the lead player to cut rightward progress
      return Math.max(e.homeX - 40, Math.min(leadX + 90, e.homeX + 220))
    case 'chaser':
      return target.x
    case 'ambusher':
      // Stay near perch until close, then dive toward target X
      if (e.state === 'patrol' || e.state === 'detect') return e.homeX
      return target.x
    case 'guardian':
      // Orbit honey pot; only leave briefly to swat intruders
      if (Phaser.Math.Distance.Between(target.x, target.y, e.guardX, e.homeY) < 160) {
        return target.x
      }
      return e.guardX
    case 'interrupter':
      // When players advance right, cut in front; otherwise pressure nearest
      if (advancing) return leadX + 70
      return target.x
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
  floatBang: (x: number, y: number) => void
}

export function tickEnemy(e: Creep, ctx: AiCtx) {
  if (!e.active) return
  const st = KIND_STATS[e.kind]
  syncBossPhase(e)
  const mul = phaseMul(e)

  e.think = Math.max(0, e.think - ctx.dt)
  e.atkCd = Math.max(0, e.atkCd - ctx.dt)
  e.windup = Math.max(0, e.windup - ctx.dt)
  e.detectT = Math.max(0, e.detectT - ctx.dt)

  const target = pickTarget(e, ctx.boy, ctx.girl)
  const dist = Phaser.Math.Distance.Between(e.x, e.y, target.x, target.y)
  const advancing = ctx.leadX > ctx.prevLeadX + 0.4
  const aggro = st.aggro * mul.aggro
  const detectR = st.detect * mul.aggro
  const melee = st.melee
  const spd = st.spd * mul.spd
  const patrolSpd = st.patrolSpd * mul.spd

  if (e.label?.active) {
    e.label.setPosition(e.x, e.y - (e.kind === 'boss' ? 56 : 40))
    if (e.kind === 'boss') {
      e.label.setText(e.phase === 1 ? '武者・壹' : e.phase === 2 ? '武者・貳' : '武者・參')
    }
  }

  // ——— recover / retreat ———
  if (e.state === 'recover') {
    e.setVelocityX(0)
    if (e.think <= 0) {
      if (e.kind === 'boss' && e.phase === 3) {
        e.state = 'retreat'
        e.think = 380
      } else if (e.kind === 'ambusher') {
        e.state = 'patrol'
      } else {
        e.state = dist < aggro ? 'chase' : 'patrol'
      }
    }
    return
  }

  if (e.state === 'retreat') {
    const away = (Math.sign(e.x - target.x) || 1) as 1 | -1
    e.setVelocityX(away * spd * 1.1)
    e.setFlipX(away > 0)
    if (e.think <= 0) {
      e.state = 'chase'
    }
    return
  }

  // ——— windup telegraph → attack window ———
  if (e.state === 'windup') {
    e.setVelocityX(0)
    e.setTint(0xff5555)
    if (e.windup <= 0) {
      e.state = 'attack'
      e.hitThis = false
      e.think = 220
      // short lunge toward target
      const dir = (Math.sign(target.x - e.x) || 1) as 1 | -1
      e.setVelocityX(dir * spd * 1.6)
      e.setFlipX(dir > 0)
    }
    return
  }

  if (e.state === 'attack') {
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

  // ——— engage: melee windup ———
  if (dist < melee && e.atkCd <= 0 && (e.state === 'chase' || e.state === 'detect')) {
    e.state = 'windup'
    e.windup = st.windupMs * mul.windup
    e.hitThis = false
    e.setVelocityX(0)
    e.setTint(0xff5555)
    ctx.floatBang(e.x, e.y - 36)
    return
  }

  // ——— detect → chase ———
  if (e.state === 'patrol' && dist < detectR) {
    e.state = 'detect'
    e.detectT = 280
    e.setVelocityX(0)
    ctx.floatBang(e.x, e.y - 36)
    return
  }

  if (e.state === 'detect') {
    e.setVelocityX(0)
    if (e.detectT <= 0) e.state = 'chase'
    return
  }

  if (e.state === 'chase' || (e.state === 'patrol' && dist < aggro && e.kind === 'chaser')) {
    if (e.state !== 'chase' && dist < aggro) e.state = 'chase'
  }

  if (e.state === 'chase') {
    if (dist > aggro * 1.35 && e.kind !== 'chaser' && e.kind !== 'boss') {
      e.state = 'patrol'
    } else {
      const goal = desireX(e, target, ctx.leadX, advancing)
      const dir = (Math.sign(goal - e.x) || 1) as 1 | -1
      // Ambusher: hop down when player is below
      if (e.kind === 'ambusher' && target.y > e.y + 30) {
        const body = e.body as Phaser.Physics.Arcade.Body
        if (body.blocked.down) e.setVelocityY(-120)
      }
      // Interrupter boosts when player is advancing
      const boost = e.kind === 'interrupter' && advancing ? 1.25 : 1
      e.setVelocityX(dir * spd * boost)
      e.setFlipX(dir > 0)
      return
    }
  }

  // ——— patrol / kind-specific idle motion ———
  e.state = 'patrol'
  if (e.kind === 'blocker') {
    const goal = desireX(e, target, ctx.leadX, advancing)
    const dir = (Math.sign(goal - e.x) || e.patrolDir) as 1 | -1
    e.setVelocityX(dir * patrolSpd)
    e.setFlipX(dir > 0)
    return
  }
  if (e.kind === 'guardian') {
    if (e.x < e.patrolMin) e.patrolDir = 1
    if (e.x > e.patrolMax) e.patrolDir = -1
    e.setVelocityX(e.patrolDir * patrolSpd)
    e.setFlipX(e.patrolDir > 0)
    return
  }
  if (e.kind === 'ambusher') {
    // creep slowly on platform perch
    if (e.x < e.patrolMin) e.patrolDir = 1
    if (e.x > e.patrolMax) e.patrolDir = -1
    e.setVelocityX(e.patrolDir * patrolSpd * 0.6)
    e.setFlipX(e.patrolDir > 0)
    return
  }

  if (e.x < e.patrolMin) e.patrolDir = 1
  if (e.x > e.patrolMax) e.patrolDir = -1
  e.setVelocityX(e.patrolDir * patrolSpd)
  e.setFlipX(e.patrolDir > 0)
}

/** Hurt only connects during attack window (after telegraph) — forgiving */
export function enemyCanHurt(e: Creep): boolean {
  if (e.state === 'attack' && !e.hitThis) return true
  // legacy brief window at end of windup for readability
  if (e.state === 'windup' && e.windup <= 80 && !e.hitThis) return true
  return false
}
