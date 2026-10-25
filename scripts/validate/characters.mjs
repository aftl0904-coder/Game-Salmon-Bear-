#!/usr/bin/env node
import { loadJson, requireKeys, uniqueIds, fail, report } from './_util.mjs'

const errors = []
const raw = loadJson('characters.json')
requireKeys(raw, ['shared', 'characters', 'balanceTargets'], 'characters', errors)

if (raw.shared) {
  requireKeys(raw.shared, ['hitbox', 'jump', 'crouch', 'hurt', 'fall'], 'characters.shared', errors)
  if (raw.shared.hitbox) {
    requireKeys(raw.shared.hitbox, ['standing', 'crouch'], 'shared.hitbox', errors)
    for (const k of ['standing', 'crouch']) {
      if (raw.shared.hitbox[k]) {
        requireKeys(raw.shared.hitbox[k], ['w', 'h'], `shared.hitbox.${k}`, errors)
      }
    }
  }
  if (raw.shared.jump) {
    requireKeys(
      raw.shared.jump,
      ['gravity', 'holdMaxMs', 'releaseCut', 'coyoteMs', 'bufferMs', 'targetHeightPx'],
      'shared.jump',
      errors,
    )
  }
}

if (!Array.isArray(raw.characters) || raw.characters.length < 2) {
  fail(errors, 'characters.characters need ≥2 entries (P-01, P-02)')
} else {
  uniqueIds(raw.characters, errors, 'characters')
  const ids = new Set(raw.characters.map((c) => c.id))
  for (const id of ['P-01', 'P-02']) {
    if (!ids.has(id)) fail(errors, `characters: missing ${id}`)
  }
  for (const c of raw.characters) {
    const label = `character ${c.id ?? '?'}`
    requireKeys(
      c,
      ['id', 'name', 'role', 'difficulty', 'hp', 'moveSpeed', 'jumpVelocity', 'weapon', 'attack', 'special', 'weakness'],
      label,
      errors,
    )
    if (c.weapon) requireKeys(c.weapon, ['name', 'look'], `${label}.weapon`, errors)
    if (!c.attack?.type) fail(errors, `${label}.attack.type required`)
    else if (c.attack.type === 'projectile') {
      requireKeys(
        c.attack,
        ['projectile', 'startupMs', 'activeMs', 'recoveryMs', 'cooldownMs', 'maxOnScreen'],
        `${label}.attack`,
        errors,
      )
      if (c.attack.projectile) {
        requireKeys(
          c.attack.projectile,
          ['name', 'speed', 'gravity', 'rangePx', 'damage', 'sizePx', 'pierce', 'spawnOffset'],
          `${label}.projectile`,
          errors,
        )
      }
    } else if (c.attack.type === 'melee') {
      requireKeys(c.attack, ['comboWindowMs', 'cooldownMs', 'hitboxHeightPx', 'combo'], `${label}.attack`, errors)
      if (!Array.isArray(c.attack.combo) || c.attack.combo.length < 1) {
        fail(errors, `${label}.attack.combo must be non-empty`)
      } else {
        for (let i = 0; i < c.attack.combo.length; i++) {
          requireKeys(
            c.attack.combo[i],
            ['damage', 'startupMs', 'activeMs', 'recoveryMs', 'range'],
            `${label}.combo[${i}]`,
            errors,
          )
        }
      }
      if (c.id === 'P-02') {
        requireKeys(c, ['backFan'], label, errors)
        if (c.backFan?.glide) {
          requireKeys(
            c.backFan.glide,
            ['holdJumpInAir', 'fallSpeedMultiplier', 'maxMs', 'extraDistanceTiles'],
            `${label}.backFan.glide`,
            errors,
          )
        }
      }
    } else {
      fail(errors, `${label}.attack.type unknown: ${c.attack.type}`)
    }
  }
}

if (raw.balanceTargets) {
  for (const k of ['dpsRatioGirlToBoy', 'clearRateBotBoy', 'clearRateBotGirl']) {
    const v = raw.balanceTargets[k]
    if (!Array.isArray(v) || v.length !== 2) fail(errors, `balanceTargets.${k} must be [lo, hi]`)
    else if (v[0] > v[1]) fail(errors, `balanceTargets.${k}: lo > hi`)
  }
}

const ok = report('characters.json', errors)
process.exit(ok ? 0 : 1)
