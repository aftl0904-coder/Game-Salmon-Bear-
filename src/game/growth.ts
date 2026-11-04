/**
 * Growth-point and per-run provenance model. The ledger is stored with the
 * main-run checkpoint. New-run selection and bounded combat are wired; shop respec is not.
 * previewGrowthEffects below remains a historical prototype only.
 * See docs/bible/first-release-growth-20261104.md for limits and remaining work.
 */
export const GROWTH_AXES = ['hp', 'atk', 'def', 'stam', 'sp'] as const
export type GrowthAxis = (typeof GROWTH_AXES)[number]
export type GrowthAllocation = Record<GrowthAxis, number>
export type GrowthWallet = { earned: number; allocation: GrowthAllocation }
export type GrowthRank = 'S' | 'A' | 'B' | 'C'

/** Reject corrupt/unknown data, never silently clamp or discard it. */
export function isGrowthWallet(value: unknown): value is GrowthWallet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const w = value as Record<string, unknown>
  if (Object.keys(w).length !== 2 || !Object.hasOwn(w, 'earned') || !Object.hasOwn(w, 'allocation')) return false
  if (!Number.isSafeInteger(w.earned) || (w.earned as number) < 0 || !w.allocation || typeof w.allocation !== 'object' || Array.isArray(w.allocation)) return false
  const allocation = w.allocation as Record<string, unknown>
  if (Object.keys(allocation).length !== GROWTH_AXES.length) return false
  let used = 0
  for (const axis of GROWTH_AXES) {
    if (!Object.hasOwn(allocation, axis)) return false
    const n = allocation[axis]
    if (!Number.isSafeInteger(n) || (n as number) < 0) return false
    used += n as number
    if (!Number.isSafeInteger(used)) return false
  }
  return used <= (w.earned as number)
}

export function newGrowthWallet(earned = 0): GrowthWallet {
  const wallet = { earned, allocation: { hp: 0, atk: 0, def: 0, stam: 0, sp: 0 } }
  if (!isGrowthWallet(wallet)) throw new RangeError('invalid growth wallet')
  return wallet
}

export function unspentGrowth(wallet: GrowthWallet): number {
  if (!isGrowthWallet(wallet)) throw new RangeError('invalid growth wallet')
  return wallet.earned - GROWTH_AXES.reduce((sum, axis) => sum + wallet.allocation[axis], 0)
}

/** Free redistribution cannot change earned points or move points between heroes. */
export function redistributeGrowth(wallet: GrowthWallet, allocation: GrowthAllocation): GrowthWallet {
  if (!isGrowthWallet(wallet)) throw new RangeError('invalid growth wallet')
  const next = { earned: wallet.earned, allocation: { ...allocation } }
  if (!isGrowthWallet(next)) throw new RangeError('allocation exceeds earned points or is invalid')
  return next
}

/**
 * Prototype only, not connected to gameplay. A fractional heart would require
 * explicit HUD / carry / healing integration before this could be used.
 * Combat damage rounding and boss-specific rules likewise need runtime QA.
 */
export function previewGrowthEffects(wallet: GrowthWallet) {
  if (!isGrowthWallet(wallet)) throw new RangeError('invalid growth wallet')
  const p = wallet.allocation
  return {
    extraHearts: p.hp * 0.5,
    attackMultiplier: 1 + p.atk * 0.1,
    damageReduction: Math.min(0.4, p.def * 0.05),
    extraIframesMs: Math.min(500, p.def * 30),
    staminaMultiplier: 1 + p.stam * 0.1,
    staminaRecoverMultiplier: 1 + p.stam * 0.03,
    specialExtraDamage: p.sp * 0.2,
  }
}

/** Bounded, integer-safe combat bonuses. Allocations are validated by the run ledger. */
export function combatGrowthEffects(p: GrowthAllocation) {
  return {
    extraHearts: Math.min(p.hp, 5),
    attackBonus: Math.ceil(Math.min(p.atk, 5) / 2),
    extraIframesMs: Math.min(p.def, 10) * 60,
    staminaMultiplier: 1 + Math.min(p.stam, 10) * 0.1,
    staminaRecoverMultiplier: 1 + Math.min(p.stam, 10) * 0.03,
    specialBonus: Math.ceil(Math.min(p.sp, 5) / 2),
  }
}

/** Caller must establish main-run sequencing and one-time award atomically. */
export function growthRankPoints(stage: number, rank: GrowthRank, mainFirstClear: boolean): number {
  if (!mainFirstClear || ![3, 5, 7].includes(stage)) return 0
  switch (rank) {
    case 'S': return 3
    case 'A': return 2
    case 'B': return 1
    case 'C': return 0
    default: throw new RangeError('invalid rank')
  }
}

/**
 * A book is saved inside the same run snapshot as its stage transition.
 * Archived branches are immutable: selecting one copies it into a new branch,
 * never merges it with a different branch. Unknown fields fail closed.
 */
export type GrowthHero = 'boy' | 'girl'
export type GrowthBranch = {
  id: string
  startStage: 1 | 6
  nextStage: number
  rewardFrom: number
  sourceId: string | null
  // Legacy runs can have zero seed. New/carry runs have at least five each.
  seed: Record<GrowthHero, number>
  heroes: Record<GrowthHero, GrowthWallet>
  awards: Partial<Record<'3' | '5' | '7', GrowthRank>>
}
export type GrowthBook = { version: 1; activeId: string; branches: GrowthBranch[] }
const HEROES: GrowthHero[] = ['boy', 'girl']
const RANKS: GrowthRank[] = ['S', 'A', 'B', 'C']
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const keysAre = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k))
const validId = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 128
const safeAmount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0
const copyWallet = (w: GrowthWallet): GrowthWallet => ({ earned: w.earned, allocation: { ...w.allocation } })
const copyBook = (book: GrowthBook): GrowthBook => ({
  version: 1,
  activeId: book.activeId,
  branches: book.branches.map((b) => ({ ...b, seed: { ...b.seed }, heroes: { boy: copyWallet(b.heroes.boy), girl: copyWallet(b.heroes.girl) }, awards: { ...b.awards } })),
})

/** Validation rejects corrupt, unknown, inconsistent and duplicate provenance. */
export function isGrowthBook(value: unknown): value is GrowthBook {
  if (!object(value) || !keysAre(value, ['version', 'activeId', 'branches']) || value.version !== 1 || !validId(value.activeId) || !Array.isArray(value.branches) || !value.branches.length) return false
  const seen = new Map<string, GrowthBranch>()
  for (const candidate of value.branches) {
    if (!object(candidate) || !keysAre(candidate, ['id', 'startStage', 'nextStage', 'rewardFrom', 'sourceId', 'seed', 'heroes', 'awards'])) return false
    const b = candidate as unknown as GrowthBranch
    if (!validId(b.id) || seen.has(b.id) || (b.startStage !== 1 && b.startStage !== 6) || !Number.isInteger(b.nextStage) || b.nextStage < b.startStage || b.nextStage > 11) return false
    if (!Number.isInteger(b.rewardFrom) || b.rewardFrom < b.startStage || b.rewardFrom > b.nextStage) return false
    if (b.sourceId !== null && (!validId(b.sourceId) || !seen.has(b.sourceId))) return false
    if (!object(b.seed) || !keysAre(b.seed, HEROES) || !object(b.heroes) || !keysAre(b.heroes, HEROES) || !object(b.awards)) return false
    let awardTotal = 0
    for (const [stage, rank] of Object.entries(b.awards)) {
      if (!['3', '5', '7'].includes(stage) || Number(stage) < b.rewardFrom || Number(stage) >= b.nextStage || !RANKS.includes(rank)) return false
      awardTotal += growthRankPoints(Number(stage), rank, true)
    }
    for (const stage of [3, 5, 7]) {
      if (stage >= b.rewardFrom && stage < b.nextStage && !Object.hasOwn(b.awards, String(stage))) return false
    }
    if (b.sourceId === null && !((b.seed.boy === 0 && b.seed.girl === 0) || (b.seed.boy === 5 && b.seed.girl === 5))) return false
    if ((b.sourceId !== null || b.seed.boy === 5) && b.rewardFrom !== b.startStage) return false
    for (const hero of HEROES) {
      if (!safeAmount(b.seed[hero]) || !isGrowthWallet(b.heroes[hero])) return false
      if (b.heroes[hero].earned !== b.seed[hero] + awardTotal) return false
      if (b.sourceId && b.seed[hero] !== Math.max(5, seen.get(b.sourceId)!.heroes[hero].earned)) return false
    }
    seen.set(b.id, b)
  }
  return value.branches[value.branches.length - 1]?.id === value.activeId
}
function requireBook(book: GrowthBook) {
  if (!isGrowthBook(book)) throw new RangeError('invalid growth book; preserve original data')
}
function active(book: GrowthBook): GrowthBranch { return book.branches.find((b) => b.id === book.activeId)! }
function seedBranch(id: string, stage: 1 | 6, nextStage: number, points: number): GrowthBranch {
  return { id, startStage: stage, nextStage, rewardFrom: nextStage, sourceId: null, seed: { boy: points, girl: points }, heroes: { boy: newGrowthWallet(points), girl: newGrowthWallet(points) }, awards: {} }
}
/** A fresh new run gets five points per hero; initial points are not old carry. */
export function createGrowthBook(id: string, stage: 1 | 6): GrowthBook {
  const book: GrowthBook = { version: 1, activeId: id, branches: [seedBranch(id, stage, stage, 5)] }
  requireBook(book)
  return book
}
/** Existing pre-growth runs get no retroactive invented rewards. Unknown growth is refused. */
export function migrateEmptyLegacyGrowth(id: string, stage: 1 | 6, nextStage: number, oldGrowth: unknown): GrowthBook {
  if (!object(oldGrowth) || Object.keys(oldGrowth).length !== 0) throw new RangeError('unknown legacy growth; preserve original data')
  const book: GrowthBook = { version: 1, activeId: id, branches: [seedBranch(id, stage, nextStage, 0)] }
  requireBook(book)
  return book
}
/** Null source = no carry; otherwise choose any prior branch, never sum branches. */
export function startGrowthBranch(book: GrowthBook, id: string, stage: 1 | 6, sourceId: string | null): { book: GrowthBook; carriedOldGrowth: boolean } {
  requireBook(book)
  if (!validId(id) || book.branches.some((b) => b.id === id)) throw new RangeError('invalid or duplicate branch id')
  const source = sourceId === null ? null : book.branches.find((b) => b.id === sourceId)
  if (sourceId !== null && !source) throw new RangeError('unknown growth source')
  const next = copyBook(book)
  const branch = seedBranch(id, stage, stage, 5)
  branch.sourceId = sourceId
  if (source) for (const hero of HEROES) {
    branch.seed[hero] = Math.max(5, source.heroes[hero].earned)
    branch.heroes[hero] = { earned: branch.seed[hero], allocation: { ...source.heroes[hero].allocation } }
  }
  next.branches.push(branch)
  next.activeId = id
  requireBook(next)
  return { book: next, carriedOldGrowth: !!source && HEROES.some((hero) => source.heroes[hero].earned > 0) }
}
/** Both heroes receive the rank points, including solo play. Side events do nothing. */
export function advanceGrowthBook(book: GrowthBook, stage: number, rank: GrowthRank, context: 'main' | 'side'): GrowthBook {
  requireBook(book)
  if (!Number.isInteger(stage) || stage < 1 || stage > 10 || !RANKS.includes(rank) || (context !== 'main' && context !== 'side')) throw new RangeError('invalid clear event')
  const previous = active(book)
  if (context === 'side' || stage < previous.nextStage) return copyBook(book)
  if (stage !== previous.nextStage) throw new RangeError('out-of-order clear')
  const next = copyBook(book)
  const branch = active(next)
  if ([3, 5, 7].includes(stage)) {
    const key = String(stage) as '3' | '5' | '7'
    if (Object.hasOwn(branch.awards, key)) throw new RangeError('award already recorded')
    branch.awards[key] = rank
    const points = growthRankPoints(stage, rank, true)
    for (const hero of HEROES) branch.heroes[hero].earned += points
  }
  branch.nextStage++
  requireBook(next)
  return next
}
/** Free redistribution is limited to one hero of the current branch. */
export function respecGrowthBook(book: GrowthBook, hero: GrowthHero, allocation: GrowthAllocation): GrowthBook {
  requireBook(book)
  if (!HEROES.includes(hero)) throw new RangeError('unknown hero')
  const next = copyBook(book)
  const branch = active(next)
  branch.heroes[hero] = redistributeGrowth(branch.heroes[hero], allocation)
  requireBook(next)
  return next
}
