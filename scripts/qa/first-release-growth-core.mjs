// Tests the isolated accounting model only; it is not integrated into gameplay.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync('src/game/growth.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const g = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const { newGrowthWallet, redistributeGrowth, unspentGrowth, isGrowthWallet, growthRankPoints } = g
const boy = newGrowthWallet(5), girl = newGrowthWallet(5)
assert.equal(unspentGrowth(boy), 5)
assert.equal(unspentGrowth(girl), 5)
const allocated = redistributeGrowth(boy, { hp: 1, atk: 2, def: 1, stam: 1, sp: 0 })
assert.equal(unspentGrowth(allocated), 0)
assert.equal(unspentGrowth(boy), 5, 'input remains unchanged')
assert.equal(unspentGrowth(girl), 5, 'other role remains unchanged')
const respec = redistributeGrowth(allocated, { hp: 0, atk: 0, def: 0, stam: 0, sp: 5 })
assert.equal(respec.earned, 5)
assert.equal(unspentGrowth(respec), 0)
let repeated = respec
for (let i = 0; i < 1000; i++) {
  repeated = redistributeGrowth(repeated, i % 2 ? { hp: 5, atk: 0, def: 0, stam: 0, sp: 0 } : { hp: 0, atk: 0, def: 0, stam: 0, sp: 5 })
  assert.equal(repeated.earned, 5)
}
for (const bad of [
  { hp: 1, atk: 1, def: 1, stam: 1, sp: 2 },
  { hp: -1, atk: 0, def: 0, stam: 0, sp: 0 },
  { hp: 0.5, atk: 0, def: 0, stam: 0, sp: 0 },
  { hp: 0, atk: 0, def: 0, stam: 0, sp: 0, extra: 1 },
]) assert.throws(() => redistributeGrowth(boy, bad), RangeError)
for (const bad of [null, {}, { earned: NaN, allocation: boy.allocation }, { earned: -1, allocation: boy.allocation }, { earned: 1, allocation: respec.allocation }]) assert.equal(isGrowthWallet(bad), false)
assert.equal(isGrowthWallet({ ...boy, futureSchemaField: 1 }), false)
assert.equal(isGrowthWallet({ earned: 5, allocation: Object.assign(Object.create(boy.allocation), { a: 0, b: 0, c: 0, d: 0, e: 0 }) }), false)
for (const stage of [3, 5, 7]) for (const [rank, points] of Object.entries({ S: 3, A: 2, B: 1, C: 0 })) {
  assert.equal(growthRankPoints(stage, rank, true), points)
  assert.equal(growthRankPoints(stage, rank, false), 0)
}
for (const stage of [1, 2, 4, 6, 8, 9, 10]) assert.equal(growthRankPoints(stage, 'S', true), 0)
assert.throws(() => growthRankPoints(3, 'invalid', true), RangeError)
const singleAxis = (axis, points) => redistributeGrowth(newGrowthWallet(points), { hp: 0, atk: 0, def: 0, stam: 0, sp: 0, [axis]: points })
for (const points of [0, 1, 5, 14]) {
  const effects = Object.fromEntries(g.GROWTH_AXES.map(axis => [axis, g.previewGrowthEffects(singleAxis(axis, points))]))
  assert.equal(effects.hp.extraHearts, points * 0.5)
  assert.equal(effects.atk.attackMultiplier, 1 + points * 0.1)
  assert.equal(effects.def.damageReduction, Math.min(0.4, points * 0.05))
  assert.equal(effects.def.extraIframesMs, Math.min(500, points * 30))
  assert.equal(effects.stam.staminaMultiplier, 1 + points * 0.1)
  assert.equal(effects.stam.staminaRecoverMultiplier, 1 + points * 0.03)
  assert.equal(effects.sp.specialExtraDamage, points * 0.2)
  console.log(`PREVIEW only: ${points} points in each axis independently:`, JSON.stringify(effects))
}
console.log('PASS isolated growth accounting: separate 5-point wallets, allocation conservation, free redistribution, invalid input and S/A/B/C stage gates')
console.log('NOT TESTED: actual balance, persisted integration, anti-farming, actual gameplay, migration or UI')
