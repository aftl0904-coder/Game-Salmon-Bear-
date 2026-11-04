// Pure geometry test only: no Phaser, renderer, game, browser or physics.
// Run: node --experimental-strip-types scripts/qa/c2s2-mid-layout.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { stage7ViewportSlice } from '../../src/game/stage7BackdropLayout.ts'

const stage = JSON.parse(fs.readFileSync('data/levels/stage7.json', 'utf8'))
const spans = stage.segments
assert.deepEqual(spans.map(({id,x0,x1})=>[id,x0,x1]), [
  ['A',0,855], ['B',855,1995], ['C',1995,3135], ['D',3135,4560], ['E',4560,5700],
])
const view = 640
let samples = 0
// Exercise the render-scale-2 half-pixel camera positions across the whole level.
for (let half = 0; half <= (stage.worldW - view) * 2; half++) {
  const scroll = half / 2
  const left = Math.round(scroll)
  const visible = spans.map(s => ({...s, slice:stage7ViewportSlice(s.x0, s.x1, scroll, view)})).filter(s=>s.slice)
  let covered = 0
  for (const {x0,x1,slice} of visible) {
    assert.equal(slice.x, covered, `gap/overlap at scroll ${scroll}`)
    assert.ok(slice.width > 0)
    assert.equal(slice.x + left, Math.max(x0,left))
    assert.equal(slice.width, Math.min(x1,left+view) - Math.max(x0,left))
    assert.equal(slice.tileX, left + slice.x - x0)
    covered += slice.width
  }
  assert.equal(covered, view, `viewport not covered at scroll ${scroll}`)
  samples++
}
// Odd source widths normalize by nearest half-up: preserve actual output periods.
for (const [segment, period] of [[spans[1],560],[spans[2],318]]) {
  const first = stage7ViewportSlice(segment.x0, segment.x1, segment.x0, view)
  const next = stage7ViewportSlice(segment.x0, segment.x1, segment.x0 + period, view)
  assert.equal(first.tileX % period, next.tileX % period)
}
assert.equal(stage7ViewportSlice(855,1995,0,view), null)
console.log(`PASS: ${samples} camera positions; A–E cover 640px without calculated gaps; B/C use 560/318px tile periods. Pure geometry only.`)
