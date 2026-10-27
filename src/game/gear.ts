/**
 * 裝備：救返嘅小朋友喺攤檔隔離擺嘅檔口（docs/bible/story.md §5）。
 *
 * 劍同槍唔係另一套系統 — 佢哋係 金鮭 weapon level 嘅「底線」：買咗鐵劍之後，
 * 中招最多跌返鐵劍，唔會跌返木。其餘三件係新效果。
 * 每個角色自己一份，存喺 localStorage，過關之後仲喺度。
 */

import {
  charmBonusHearts,
  charmDamageCutPenalty,
  charmJumpMul,
  charmSpecialPowerBonus,
  charmSpeedMul,
  charmStamMaxMul,
  charmStamRecoverMul,
} from './charms'

export type GearId = 'heart' | 'sword' | 'gun' | 'armour' | 'boots' | 'charm'
export type Who = 'boy' | 'girl'
export type Tiers = Record<GearId, number>

const KEY = 'sake-kuma-gear-v1'
const MAX_TIER = 3

export type GearDef = {
  id: GearId
  name: string
  /** Which hero can use it ('both' = either). */
  who: Who | 'both'
  /** Price of tier 1, 2, 3. */
  price: [number, number, number]
  /** One line per tier, shown in the shop. */
  tiers: [string, string, string]
  blurb: string
  /** Only stocked once the player has cleared this stage (undefined = always). */
  fromStage?: number
}

export const GEAR: GearDef[] = [
  {
    id: 'heart',
    name: '大心心',
    who: 'both',
    price: [12, 26, 48],
    tiers: ['銅心：生命上限 +1', '銀心：+2', '金心：+3'],
    blurb: '生命值。多一格就多一次錯嘅機會。',
  },
  {
    id: 'sword',
    name: '劍',
    who: 'girl',
    price: [10, 22, 40],
    tiers: ['銅劍：劍長 ×1.35', '銀劍：劍長 ×1.7，傷害 +1', '金劍：唔會跌級'],
    blurb: '攻擊力。琪寶寶用。買咗之後中招最多跌返買咗嗰級。',
  },
  {
    id: 'gun',
    name: '三文魚槍',
    who: 'boy',
    price: [10, 22, 40],
    tiers: ['銅槍：一次兩粒', '銀槍：扇形三粒，射程 ×1.4', '金槍：唔會跌級'],
    blurb: '攻擊力。倫寶用。買咗之後中招最多跌返買咗嗰級。',
  },
  {
    id: 'armour',
    name: '盔甲',
    who: 'both',
    price: [10, 22, 40],
    tiers: ['銅甲：扣血 −1', '銀甲：扣血 −1，擊退少啲', '金甲：扣血 −2'],
    blurb: '防禦力。最少都會扣 1 格，唔會完全唔痛。',
  },
  {
    id: 'boots',
    name: '鞋',
    who: 'both',
    price: [8, 18, 32],
    tiers: ['銅鞋：耐力 +25%，回氣快啲', '銀鞋：耐力 +50%', '金鞋：耐力 +85%，回氣好快'],
    blurb: '耐力。連續出招嘅次數，同埋停手之後幾快回氣。',
  },
  {
    id: 'charm',
    name: '蜜符',
    who: 'both',
    price: [50, 90, 150],
    tiers: ['銅符：絕招 +1', '銀符：絕招 +2，無敵時間 +60%', '金符：絕招 +3，無敵時間 +100%'],
    blurb: '絕招。好貴 — 要儲足幾關，同埋喺小遊戲度搏多啲金幣先買得起。',
    /** The last thing the stall ever stocks: it shows up on the clear screen before the final stage. */
    fromStage: 4,
  },
]

export function gearById(id: GearId): GearDef {
  return GEAR.find((g) => g.id === id)!
}

const empty = (): Tiers => ({ heart: 0, sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 })
type Save = { boy: Tiers; girl: Tiers }

function read(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Save>
    return { boy: { ...empty(), ...(raw.boy ?? {}) }, girl: { ...empty(), ...(raw.girl ?? {}) } }
  } catch {
    return { boy: empty(), girl: empty() }
  }
}

function write(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode — gear just doesn't carry over */
  }
}

export function gearOf(who: Who): Tiers {
  return read()[who]
}

export function tierOf(who: Who, id: GearId): number {
  return gearOf(who)[id] ?? 0
}

/** Price of the next tier, or null when it is already maxed. */
export function nextPrice(who: Who, id: GearId): number | null {
  const t = tierOf(who, id)
  if (t >= MAX_TIER) return null
  return gearById(id).price[t]!
}

export function buy(who: Who, id: GearId): boolean {
  const s = read()
  const t = s[who][id] ?? 0
  if (t >= MAX_TIER) return false
  s[who][id] = t + 1
  write(s)
  return true
}

/**
 * Death: drop one tier of the most valuable thing carried, never below 0.
 * Tier 3 sword / gun are marked 「唔會跌級」, so they are skipped.
 */
export function dropOnDeath(who: Who): { id: GearId; from: number } | null {
  const s = read()
  const t = s[who]
  let best: GearId | null = null
  let bestVal = 0
  for (const g of GEAR) {
    const cur = t[g.id] ?? 0
    if (cur <= 0) continue
    if ((g.id === 'sword' || g.id === 'gun') && cur >= MAX_TIER) continue
    const val = g.price[cur - 1]!
    if (val > bestVal) {
      bestVal = val
      best = g.id
    }
  }
  if (!best) return null
  const from = t[best]!
  t[best] = from - 1
  write(s)
  return { id: best, from }
}

export function resetGear() {
  write({ boy: empty(), girl: empty() })
}

// ── Effects ──────────────────────────────────────────────────────────────

/** Weapon-level floor: 琪寶寶 reads `sword`, 倫寶 reads `gun`. */
export function weaponFloor(who: Who): number {
  return 1 + tierOf(who, who === 'girl' ? 'sword' : 'gun')
}

/** Damage taken is reduced by this, never below 0 — 力符 trades some of it away. */
export function damageCut(who: Who): number {
  const t = tierOf(who, 'armour')
  const base = t >= 3 ? 2 : t >= 1 ? 1 : 0
  return Math.max(0, base - charmDamageCutPenalty())
}

/** Extra hearts on the max — the 大心心, one per tier, plus the 運符 charm. */
export function bonusHearts(who: Who): number {
  return tierOf(who, 'heart') + charmBonusHearts()
}

/** Boots are 耐力: a bigger bar and a faster recovery. 氣符/運符 scale it further. */
export function stamMax(who: Who): number {
  return ([1, 1.25, 1.5, 1.85][tierOf(who, 'boots')] ?? 1) * charmStamMaxMul()
}
export function stamRecoverMul(who: Who): number {
  return ([1, 1.2, 1.35, 1.6][tierOf(who, 'boots')] ?? 1) * charmStamRecoverMul()
}

/** 扭蛋機 charm for this run — 風符/氣符 only, no gear affects this (yet). */
export function speedMul(): number {
  return charmSpeedMul()
}

export function jumpMul(): number {
  return charmJumpMul()
}

export function knockMul(who: Who): number {
  return tierOf(who, 'armour') >= 2 ? 0.65 : 1
}

export function iframeMul(who: Who): number {
  return [1, 1, 1.6, 2][tierOf(who, 'charm')] ?? 1
}

/** Base 絕招 damage is 3; the 蜜符 adds one per tier, 力符 adds one more. */
export function specialPower(who: Who): number {
  return 3 + tierOf(who, 'charm') + charmSpecialPowerBonus()
}

export type StatId = 'hp' | 'atk' | 'def' | 'stam' | 'sp'
export const STAT_NAMES: Record<StatId, string> = { hp: '生命', atk: '攻擊', def: '防禦', stam: '耐力', sp: '絕招' }

/**
 * The pentagon on the shop screen. Each axis is 0..1: a fifth for being alive at all,
 * then a fifth per tier of the gear that drives it.
 */
export function stats(who: Who): Record<StatId, number> {
  const t = gearOf(who)
  const axis = (n: number) => Math.min(1, 0.25 + n * 0.25)
  return {
    hp: axis(t.heart),
    atk: axis(who === 'girl' ? t.sword : t.gun),
    def: axis(t.armour),
    stam: axis(t.boots),
    sp: axis(t.charm),
  }
}
