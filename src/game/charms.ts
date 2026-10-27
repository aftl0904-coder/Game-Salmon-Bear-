/**
 * 扭蛋機：開局前扭一次嘅 charm，成次 playthrough（由 1P/2P 揀角色嗰刻到通關）
 * 用返同一張 — 等每次開局都有少少唔同，有少少加強，都有少少trade-off。
 *
 * 淨係存喺呢個 module 嘅變數，唔寫 localStorage：唔似鞋/劍嗰啲裝備咁長留，
 * 隻係呢次開局生效，再開一次新遊戲（返menu撳開始）先至再扭過。
 */

export type CharmId = 'omamori' | 'speed' | 'power' | 'stamina' | 'luck'

export type CharmDef = {
  id: CharmId
  name: string
  /** texture key, 已經係 public/art/items/charm-<id>.png */
  icon: string
  desc: string
}

export const CHARMS: CharmDef[] = [
  {
    id: 'omamori',
    name: '御守',
    icon: 'charm-omamori',
    desc: '每關一次：搖吓手機（或撳 O）就有一下祝福 — 氣力全滿，仲有一陣無敵。',
  },
  {
    id: 'speed',
    name: '風符',
    icon: 'charm-speed',
    desc: '身手快啲、跳高啲，但回氣慢少少。',
  },
  {
    id: 'power',
    name: '力符',
    icon: 'charm-power',
    desc: '絕招傷害 +1，但中招會痛多少少。',
  },
  {
    id: 'stamina',
    name: '氣符',
    icon: 'charm-stamina',
    desc: '氣力上限大啲、回氣快啲，但身手慢少少。',
  },
  {
    id: 'luck',
    name: '運符',
    icon: 'charm-luck',
    desc: '多一格生命上限，但氣力上限細少少。',
  },
]

export function charmById(id: CharmId): CharmDef {
  return CHARMS.find((c) => c.id === id)!
}

let active: CharmId | null = null

/** Picks a random charm and makes it the active one for this run. */
export function rollCharm(): CharmDef {
  const pick = CHARMS[Math.floor(Math.random() * CHARMS.length)]!
  active = pick.id
  return pick
}

/** Forces a specific charm active without a random roll (QA/debug only — see GachaScene). */
export function setActiveCharm(id: CharmId): CharmDef {
  active = id
  return charmById(id)
}

export function activeCharm(): CharmId | null {
  return active
}

export function activeCharmDef(): CharmDef | null {
  return active ? charmById(active) : null
}

export function clearCharm() {
  active = null
}

// ── Effects (gear.ts folds these into the existing stat hooks) ─────────────

export function charmSpeedMul(): number {
  if (active === 'speed') return 1.15
  if (active === 'stamina') return 0.92
  return 1
}
export function charmJumpMul(): number {
  return active === 'speed' ? 1.08 : 1
}
export function charmStamMaxMul(): number {
  if (active === 'stamina') return 1.2
  if (active === 'luck') return 0.9
  return 1
}
export function charmStamRecoverMul(): number {
  if (active === 'stamina') return 1.2
  if (active === 'speed') return 0.85
  return 1
}
/** Subtracted from the normal damage-cut (never below 0 — gear.ts clamps). */
export function charmDamageCutPenalty(): number {
  return active === 'power' ? 1 : 0
}
export function charmSpecialPowerBonus(): number {
  return active === 'power' ? 1 : 0
}
export function charmBonusHearts(): number {
  return active === 'luck' ? 1 : 0
}

// ── 御守：一關一次嘅「搖一搖」祝福 ───────────────────────────────────────────

let prayCharge = false

/** Call once per stage load (GameScene.create()). */
export function resetPrayCharge() {
  prayCharge = active === 'omamori'
}

export function hasPrayCharge(): boolean {
  return prayCharge
}

/** Consumes the charge; returns false if there was none (already used / wrong charm). */
export function usePrayCharge(): boolean {
  if (!prayCharge) return false
  prayCharge = false
  return true
}
