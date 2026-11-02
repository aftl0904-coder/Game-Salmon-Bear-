import { boot } from './owllib.mjs'
const { page, S, b, ev } = await boot('boy')
const res = await page.evaluate(async () => {
  const s = window.__SAKE_GAME__.scene.getScene('play'); const q = s.queen
  const out = { cls: q.constructor.name, acts: q.act, rows: [] }
  const slp = (ms) => new Promise((r) => setTimeout(r, ms))
  for (const [weak, raw] of [[false, 3], [false, 5], [false, 8], [false, 15], [true, 3], [true, 5], [true, 8], [true, 15]]) {
    q.hp = q.maxHp = 100; q.lastHitAt = -9999
    const save = q.act
    if (weak) q.act = q.act === 'rest' ? 'rest' : 'weak'
    const wk = weak ? (q.constructor.name === 'MudMane' ? 'exposed' : 'weak') : 'fly'
    q.act = weak ? wk : (q.constructor.name === 'MirrorOwl' ? 'fly' : q.act)
    q.hp = 100; const before = q.hp
    q.receiveHit(raw, 1)
    out.rows.push([weak ? 'weak' : 'normal', raw, before - q.hp])
    await slp(10)
  }
  return out
})
console.log(JSON.stringify(res))
await b.close()
