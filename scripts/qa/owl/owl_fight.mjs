import { boot, OUT, startRec, getRec, summarize } from './owllib.mjs'
import fs from 'fs'
const react = +(process.argv[2] ?? 400), tag = process.argv[3] ?? 'r', polite = (process.argv[4] ?? 'polite') === 'polite', cast = process.argv[5] ?? 'boy', maxS = +(process.argv[6] ?? 170)
const { page, S, b, ev, lvl } = await boot(cast)
await startRec(page)
const held = new Set()
const hold = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k) } else if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k) } }
const rel = async () => { for (const k of [...held]) await hold(k, false) }
const x0 = lvl.boss.arenaX0, x1 = lvl.boss.arenaX1
let actSince = Date.now(), prevAct = null, t0 = Date.now(), result = null, jumped = false, lastQhp = 36
const move = async (dx, dead = 12) => { await hold('a', dx < -dead); await hold('d', dx > dead) }
const face = async (dx) => { await hold(dx < 0 ? 'a' : 'd', true); await page.waitForTimeout(30); await hold(dx < 0 ? 'a' : 'd', false) }
while ((Date.now() - t0) / 1000 < maxS) {
  const s = await S()
  if (s.gone || s.ended || s.qhp <= 0 || s.qhp === undefined) { result = s.qhp <= 0 || s.gone ? 'WIN' : 'END'; break }
  if (!s.alive || s.cont || s.hp <= 0) { result = 'LOSE'; break }
  if (s.act !== prevAct) { prevAct = s.act; actSince = Date.now(); jumped = false }
  const age = Date.now() - actSince, ready = age > react
  const dxq = s.qx - s.hx
  if (s.act === 'feathers') { await rel(); if (ready) await move(s.gap - s.hx, 8) ; continue }
  if (s.act === 'tell2') { await rel(); if (ready) { const dir = s.hx < s.dest ? -1 : 1; const room = dir < 0 ? s.hx - x0 : x1 - s.hx; const d2 = room < 90 ? -dir : dir; if (Math.abs(s.hx - s.dest) < 120) await move(d2 * 100) } continue }
  if (s.act === 'tell' || s.act === 'blast') { await rel(); if (ready && !jumped && Math.abs(dxq) < 160) { jumped = true; await page.keyboard.press('g') } continue }
  if (s.act === 'guard' && s.cued && ready) { await rel(); if (Math.abs(dxq) < 260) await move(-Math.sign(dxq || 1) * 100); continue }
  if (s.act === 'dive') { await rel(); if (Math.abs(dxq) < 260) await move(-Math.sign(dxq || 1) * 100); continue }
  const counter = ['rest', 'window2', 'weak'].includes(s.act)
  if (counter) {
    if (polite && s.wh >= 3) { await rel(); await move(-Math.sign(dxq || 1) * 100); continue }
    const want = 120
    if (Math.abs(dxq) > want + 25) await move(dxq); else { await rel(); await face(dxq) }
    if (cast === 'boy' ? true : Math.abs(dxq) < 70) await page.keyboard.press('f')
    continue
  }
  if (s.act === 'split' || s.act === 'guard') {
    // shoot from range, keep distance ~160
    if (Math.abs(dxq) > 200) await move(dxq); else if (Math.abs(dxq) < 130) await move(-dxq); else { await rel(); await face(dxq) }
    if (Math.abs(dxq) < 260) await page.keyboard.press('f')
    continue
  }
  await rel()
  await page.waitForTimeout(30)
}
await rel()
const rec = await getRec(page)
const fin = await S().catch(() => ({}))
const out = { tag, react, polite, cast, result: result ?? 'TIMEOUT', secs: +((Date.now() - t0) / 1000).toFixed(1), qhpLeft: fin.qhp ?? 0, heroHp: fin.hp ?? 0 }
fs.writeFileSync(`${OUT}/fight-${tag}.json`, JSON.stringify({ out, events: summarize(rec) }, null, 1))
await page.screenshot({ path: `${OUT}/fight-${tag}.png` }).catch(() => {})
console.log(JSON.stringify(out))
await b.close()
