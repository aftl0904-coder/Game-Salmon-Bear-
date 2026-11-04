/**
 * Pure growth-point accounting checkpoint. NOT wired to gameplay or storage yet.
 * Persisting/rewarding across new runs is intentionally blocked pending the
 * decisions in docs/bible/first-release-growth-20261104.md.
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
