/**
 * 裝備：救返嘅小朋友喺攤檔隔離擺嘅檔口（docs/bible/story.md §5）。
 *
 * 劍同槍唔係另一套系統 — 佢哋係 金鮭 weapon level 嘅「底線」：買咗鐵劍之後，
 * 中招最多跌返鐵劍，唔會跌返木。其餘三件係新效果。
 * 每個角色自己一份，存喺 localStorage，過關之後仲喺度。
 */

export type GearId = 'sword' | 'gun' | 'armour' | 'boots' | 'charm'
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
}

export const GEAR: GearDef[] = [
  {
    id: 'sword',
    name: '劍',
    who: 'girl',
    price: [8, 18, 32],
    tiers: ['鐵劍：劍長 ×1.35', '好鐵劍：劍長 ×1.7，傷害 +1', '金劍：唔會跌級'],
    blurb: '琪寶寶用。買咗之後中招最多跌返買咗嗰級。',
  },
  {
    id: 'gun',
    name: '槍',
    who: 'boy',
    price: [8, 18, 32],
    tiers: ['雙管：一次兩粒', '三管：扇形三粒，射程 ×1.4', '金管：唔會跌級'],
    blurb: '倫寶用。買咗之後中招最多跌返買咗嗰級。',
  },
  {
    id: 'armour',
    name: '盔甲',
    who: 'both',
    price: [10, 22, 40],
    tiers: ['布甲：扣血 −1', '皮甲：扣血 −1，擊退少啲', '金甲：扣血 −2，多 1 格心'],
    blurb: '最少都會扣 1 格，唔會變成完全唔痛。',
  },
  {
    id: 'boots',
    name: '鞋',
    who: 'both',
    price: [6, 14, 26],
    tiers: ['波鞋：行快 10%', '行山鞋：行快 18%，跳高 8%', '飛毛鞋：行快 25%，跳高 15%'],
    blurb: '跳唔到嘅位，可能著對好鞋就跳到。',
  },
  {
    id: 'charm',
    name: '護身符',
    who: 'both',
    price: [6, 14, 26],
    tiers: ['木牌：無敵時間 +30%', '玉牌：+60%', '金蜂巢：+100%'],
    blurb: '中招之後閃幾耐。愈長愈容易逃出重圍。',
  },
]

export function gearById(id: GearId): GearDef {
  return GEAR.find((g) => g.id === id)!
}

const empty = (): Tiers => ({ sword: 0, gun: 0, armour: 0, boots: 0, charm: 0 })
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

/** Damage taken is reduced by this, never below 1. */
export function damageCut(who: Who): number {
  const t = tierOf(who, 'armour')
  return t >= 3 ? 2 : t >= 1 ? 1 : 0
}

/** Extra hearts on the max (gold armour only). */
export function bonusHearts(who: Who): number {
  return tierOf(who, 'armour') >= 3 ? 1 : 0
}

export function speedMul(who: Who): number {
  return [1, 1.1, 1.18, 1.25][tierOf(who, 'boots')] ?? 1
}

export function jumpMul(who: Who): number {
  return [1, 1, 1.08, 1.15][tierOf(who, 'boots')] ?? 1
}

export function knockMul(who: Who): number {
  return tierOf(who, 'armour') >= 2 ? 0.65 : 1
}

export function iframeMul(who: Who): number {
  return [1, 1.3, 1.6, 2][tierOf(who, 'charm')] ?? 1
}
