import { createRequire } from 'module'
const require = createRequire(import.meta.url)
import { boot, OUT, startRec, getRec, summarize } from './owllib.mjs'
const mode = process.argv[2] ?? 'greedy' // greedy | polite
const phase = +(process.argv[3] ?? 1)
const { page, S, b, ev } = await boot('girl')
if (phase > 1) await ev((p) => { const q = window.__SAKE_GAME__.scene.getScene('play').queen; q.hp = p === 2 ? 22 : 10; q.updatePhase() }, phase)
await startRec(page)
const want = phase === 1 ? 'rest' : phase === 2 ? 'window2' : 'weak'
const log = []; let lastForce = 0, lastHp = 6, t0 = Date.now(), engaged = false, shots = 0, prev = ''
const hold = async (k, on) => on ? page.keyboard.down(k) : page.keyboard.up(k)
while (Date.now() - t0 < 120000) {
  const s = await S(); if (s.gone) break
  if (s.hp !== lastHp) { log.push({ t: Date.now() - t0, hpChange: [lastHp, s.hp], act: s.act, hx: s.hx, qx: s.qx, hy: s.hy }); lastHp = s.hp }
  if (s.act !== prev) { log.push({ t: Date.now() - t0, act: s.act, hp: s.hp, qhp: s.qhp, hx: s.hx, qx: s.qx, wh: s.wh }); prev = s.act }
  if (phase === 3 && s.act === 'guard' && !engaged) { // break crate fast: poke it
    await ev(() => { const sc = window.__SAKE_GAME__.scene.getScene('play'); const c = sc.queen.crate; if (c) { c.receiveHit(1, 1); c.receiveHit(1, 1); c.receiveHit(1, 1) } })
  }
  if (phase === 2 && !engaged) {
    if (s.act === 'tell2') { const away = s.hx < s.dest ? 'a' : 'd'; await hold(away, true); await hold(away === 'a' ? 'd' : 'a', false) }
    else { await hold('a', false); await hold('d', false) }
  }
  if (s.act === want && !engaged) {
    engaged = true
    await ev(() => { const sc = window.__SAKE_GAME__.scene.getScene('play'); const h = sc.boy?.active ? sc.boy : sc.girl; h.x = sc.queen.x - 40; h.y = 250; h.facing = 1 })
    await page.waitForTimeout(150)
  }
  if (engaged && s.act === want) {
    if (mode === 'forced') { if (Date.now() - lastForce > 400) { lastForce = Date.now(); await ev(() => { const q = window.__SAKE_GAME__.scene.getScene('play').queen; q.receiveHit(1, 1) }) } }
    else if (mode === 'greedy' || s.wh < 3) { await page.keyboard.press('f') }
    else { await hold('a', true) }
    if (shots === 0) { shots = 1 }
  } else { await hold('a', false) }
  if (s.act === 'tell' && shots === 1) { shots = 2; await page.screenshot({ path: `${OUT}/greed-tell-${phase}.png` }) }
  if (s.act === 'blast' && shots === 2) { shots = 3; await page.screenshot({ path: `${OUT}/greed-blast-${phase}.png` }) }
  if (engaged && s.act === 'fly' && log.length > 4) break
  await page.waitForTimeout(40)
}
await hold('a', false)
const rec = await getRec(page)
require('fs').writeFileSync('/tmp/pt/rec.json', JSON.stringify(rec)); console.log(mode, phase); console.log(summarize(rec).join('\n'))
await b.close()
