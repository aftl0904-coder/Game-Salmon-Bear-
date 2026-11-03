import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { groundVisualSpans } from '../../src/game/engine/terrainVisual.ts'

const check = (name, x0, x1, pits, expected) => {
  assert.deepEqual(groundVisualSpans(x0, x1, pits), expected, name)
  console.log('PASS', name)
}
check('no pits', 0, 100, [], [{ x0: 0, x1: 100 }])
check('unordered, overlapping, clipping', 0, 100, [{x0:70,x1:110},{x0:-5,x1:10},{x0:20,x1:40},{x0:30,x1:60}], [{x0:10,x1:20},{x0:60,x1:70}])
check('empty and boundaries', 10, 10, [{x0:1,x1:3}], [])
let count = 0
for (let stage=1; stage<=6; stage++) {
  const data = JSON.parse(readFileSync(`data/levels/stage${stage}.json`, 'utf8'))
  const pits = data.pits.map(p=>({x0:p.x,x1:p.x+p.w}))
  const width = data.worldW ?? 3800
  const spans = groundVisualSpans(0, width, pits)
  for (const p of pits) {
    assert.ok(p.x0 >= 0 && p.x1 <= width, `stage ${stage} pit in world`)
    assert.ok(spans.every(s => s.x1 <= p.x0 || s.x0 >= p.x1), `stage ${stage} no top-edge inside ${p.x0}`)
    assert.ok(spans.some(s=>s.x1===p.x0), `stage ${stage} edge stops at ${p.x0}`)
    assert.ok(spans.some(s=>s.x0===p.x1), `stage ${stage} edge resumes at ${p.x1}`)
    count++
  }
  for (const zone of [...(data.slippery??[]),...(data.sticky??[]),...(data.bouncy??[])]) {
    const pieces = groundVisualSpans(zone.x0, zone.x1, pits)
    assert.ok(pieces.every(s=>pits.every(p=>s.x1<=p.x0 || s.x0>=p.x1)), `stage ${stage} surface band never crosses a pit`)
  }
  console.log(`PASS stage ${stage}: ${pits.length} actual pit openings`)
}
console.log(`PASS ${count} pit coordinates and surface-zone masks`)
