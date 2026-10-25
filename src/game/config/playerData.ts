/**
 * Runtime player stats — sourced from data/characters.json (replaces player.json).
 * PLAYER keeps a compatibility shape for existing Player / GameScene code.
 */
import charactersRaw from '../../../data/characters.json'

export const CHARACTERS = charactersRaw

export type CharactersPack = typeof charactersRaw
export type CharacterDef = CharactersPack['characters'][number]

const shared = CHARACTERS.shared
const p01 = CHARACTERS.characters.find((c) => c.id === 'P-01')!
const p02 = CHARACTERS.characters.find((c) => c.id === 'P-02')!

/** Compatibility view: shared + P-01 (倫寶) — used by Player.ts until full dual-role wiring. */
export const PLAYER = {
  id: p01.id,
  name: p01.name,
  hp: p01.hp,
  moveSpeed: p01.moveSpeed,
  hitbox: shared.hitbox,
  jump: {
    velocity: p01.jumpVelocity,
    gravity: shared.jump.gravity,
    holdMaxMs: shared.jump.holdMaxMs,
    releaseCut: shared.jump.releaseCut,
    coyoteMs: shared.jump.coyoteMs,
    bufferMs: shared.jump.bufferMs,
    targetHeightPx: shared.jump.targetHeightPx,
  },
  crouch: {
    speedMultiplier: shared.crouch.speedMultiplier,
    /** P-01 can shoot while crouching per characters.json */
    canAttack:
      p01.attack.type === 'projectile' ? Boolean(p01.attack.canShootCrouching) : true,
  },
  attack: (() => {
    const atk = p01.attack
    if (atk.type === 'projectile' && atk.projectile) {
      return {
        damage: atk.projectile.damage,
        startupMs: atk.startupMs,
        activeMs: atk.activeMs,
        recoveryMs: atk.recoveryMs,
        range: atk.projectile.rangePx,
      }
    }
    return { damage: 1, startupMs: 60, activeMs: 120, recoveryMs: 150, range: 28 }
  })(),
  special: {
    damage: p01.special.damage,
    cost: p01.special.cost,
    invulnMs: 0,
  },
  hurt: shared.hurt,
  fall: shared.fall,
} as const

export type PlayerJson = typeof PLAYER

export function characterById(id: string): CharacterDef | undefined {
  return CHARACTERS.characters.find((c) => c.id === id)
}

/** 琪寶寶 moveSpeed from JSON (replaces hardcoded GIRL_SPEED consumers gradually). */
export const GIRL_FROM_JSON = {
  id: p02.id,
  name: p02.name,
  hp: p02.hp,
  moveSpeed: p02.moveSpeed,
  jumpVelocity: p02.jumpVelocity,
} as const

/** Jump impulse (Arcade: negative = up). */
export function jumpVelocity(): number {
  return -Math.abs(PLAYER.jump.velocity)
}

/** World / body gravity from JSON. */
export function jumpGravity(): number {
  return PLAYER.jump.gravity
}

/** Apex velocity that reaches `heightPx` under current gravity: v = -√(2gh). */
export function apexVelocityForHeight(heightPx: number): number {
  const g = jumpGravity()
  return -Math.sqrt(Math.max(1, 2 * g * heightPx))
}

export function tapApexVelocity(): number {
  return apexVelocityForHeight(PLAYER.jump.targetHeightPx.tap)
}

export function fullApexVelocity(): number {
  const fromJson = jumpVelocity()
  const fromHeight = apexVelocityForHeight(PLAYER.jump.targetHeightPx.full)
  return Math.abs(fromJson - fromHeight) < 8 ? fromJson : fromHeight
}
