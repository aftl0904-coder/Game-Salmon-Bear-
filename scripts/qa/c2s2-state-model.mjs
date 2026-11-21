// Exploratory deterministic model ONLY: not Phaser, not a runtime fix or acceptance test.
// All numbers below are synthetic monotonic timestamps; no hardware presentation claim.
import assert from 'node:assert/strict'
import fs from 'node:fs'

const out = process.env.OUT || 'docs/qa-c2s2/state-checkpoint-model.json'
if (fs.existsSync(out)) throw Error(`refusing to overwrite ${out}`)
class Candidate {
  constructor() { this.state = 'warning'; this.elapsed = 0; this.anchor = null; this.blocked = false; this.drawn = false; this.trace = [] }
  invalidate(t, why) { this.anchor = null; this.drawn = false; this.trace.push({ t, why, state: this.state, elapsed: this.elapsed }) }
  pause(t) { this.blocked = true; this.invalidate(t, 'pause') }
  resume(t) { this.blocked = false; this.invalidate(t, 'resume') }
  render(t) { if (!this.blocked && this.state !== 'end') { this.anchor = t; this.drawn = true; this.trace.push({ t, event: 'engine-render', state: this.state, elapsed: this.elapsed }) } }
  prePhysics(t) {
    let damageAllowed = false
    if (this.blocked) return { damageAllowed, state: this.state }
    if (this.anchor !== null) {
      this.elapsed += t - this.anchor
      this.anchor = null
      if (this.state === 'warning' && this.elapsed >= 800) { this.state = 'active'; this.elapsed = 0; this.drawn = false }
      else if (this.state === 'active' && this.elapsed >= 1500) { this.state = 'end'; this.drawn = false }
      else if (this.state === 'active' && this.drawn) damageAllowed = true
    }
    this.trace.push({ t, event: 'pre-physics', state: this.state, elapsed: this.elapsed, damageAllowed })
    return { damageAllowed, state: this.state }
  }
}
const report = { description: 'Synthetic model only; post-render means engine callback, NOT display presentation. No Phaser integration, collision, camera, real tab background or natural play tested.', cases: [], blockers: [] }
const run = (name, fn) => { const c = new Candidate(); const row = { name }; report.cases.push(row); try { fn(c); row.modelAssertions = 'pass' } catch(e) { row.modelAssertions = 'fail'; row.error = String(e); process.exitCode = 1 } row.trace = c.trace }
run('warning-not-before-800ms', c => { c.render(0); for (let t = 100; t <= 700; t += 100) { assert.equal(c.prePhysics(t).state, 'warning'); c.render(t) } assert.equal(c.prePhysics(800).state, 'active'); assert.equal(c.prePhysics(801).damageAllowed, false); c.render(802); assert.equal(c.prePhysics(803).damageAllowed, true) })
run('warning-pause-does-not-count', c => { c.render(0); c.prePhysics(200); c.render(200); c.pause(250); c.resume(1250); assert.equal(c.prePhysics(1251).state, 'warning'); c.render(1252); assert.equal(c.prePhysics(1851).state, 'warning'); c.render(1851); assert.equal(c.prePhysics(1852).state, 'active') })
run('active-resume-requires-new-render', c => { c.render(0); c.prePhysics(800); c.render(801); assert.equal(c.prePhysics(900).damageAllowed, true); c.render(900); c.pause(901); c.resume(1901); assert.equal(c.prePhysics(1902).damageAllowed, false); c.render(1902); assert.equal(c.prePhysics(1903).damageAllowed, true) })
run('active-end-before-physics-at-1500', c => { c.render(0); c.prePhysics(800); c.render(801); const r = c.prePhysics(2301); assert.equal(r.state, 'end'); assert.equal(r.damageAllowed, false) })
run('short-low-fps-no-early-warning', c => { c.render(0); for (let t=125;t<800;t+=125) { assert.equal(c.prePhysics(t).state, 'warning'); c.render(t) } assert.equal(c.prePhysics(875).state, 'active') })
// Counterexample: a later POST_RENDER listener blocks the main thread until t=900.
// No evidence a compositor ever presented the first engine render during that time.
// The model enters active even when a hypothetical first presentation is at t=901.
run('counterexample-postrender-is-not-present', c => { c.render(0); assert.equal(c.prePhysics(900).state, 'active'); c.trace.push({ t: 901, event: 'hypothetical-first-compositor-presentation', note: 'independent of engine callbacks; not observed or measured' }) })
report.blockers.push('Model cannot observe compositor presentation; POST_RENDER by itself does not establish visible-on-screen duration.')
report.blockers.push('Model uses hypothetical callbacks; real hidden/visible, draw inclusion, physics multi-step, scene shutdown/death, camera obstruction and shared Boss phase transitions are untested.')
report.blockers.push('A long stall can consume the active wall interval before any physics step; whether to skip or extend that frame-quantized damage window requires an integrated conservative policy and tests.')
report.promotableToRuntime = false
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ out, modelAssertions: report.cases.map(c => [c.name, c.modelAssertions]), promotableToRuntime: report.promotableToRuntime }))
