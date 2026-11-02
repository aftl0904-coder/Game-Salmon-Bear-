import { PLAYER_ATTACK_DMG } from './constants'

export type BossDamageOpts = {
  /** The boss is in its glowing weak window. */
  weak?: boolean
  /** Hit points a base-damage hit deals in the weak window (normal window always 1). */
  weakBase?: number
  capNormal?: number
  capWeak?: number
}

/**
 * Boss HP counts hits, but gear still matters: raw damage is scaled against the base hit
 * (PLAYER_ATTACK_DMG) and capped so no loadout skips a phase. A base hit deals exactly
 * what the old hard-coded `1` / `weakBase` did.
 */
export function bossHitDamage(raw: number, opts: BossDamageOpts = {}): number {
  const unit = Math.max(0, raw) / PLAYER_ATTACK_DMG
  const base = opts.weak ? (opts.weakBase ?? 3) : 1
  const cap = opts.weak ? (opts.capWeak ?? 5) : (opts.capNormal ?? 2)
  return Math.min(cap, Math.max(1, Math.round(base * unit)))
}
