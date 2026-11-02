// Real-input walkthrough bot: no teleports. Holds "right", mashes attack, jumps on a timer.
// HP assist: when a hero drops to <=1 HP it is topped up to 4 (logged), so the run reaches the end instead of game-over.
import { boot, OUT } from './lib.mjs'
import fs from 'fs'
const mode = process.env.MODE || '2p'
const CAP_MIN = Number(process.env.CAP_MIN || 25)
const { b, page, errs } = await boot({ mode })
const run = (code, a) => page.evaluate(({ code, a }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', code))(s, a) }, { code, a })
const P1 = { left: 'KeyA', right: 'KeyD', atk: 'KeyF', jump: 'KeyG' }
const P2 = { left: 'ArrowLeft', right: 'ArrowRight', atk: 'Comma', jump: 'Period' }
const pads = mode === '2p' ? [P1, P2] : [P1]
for (const p of pads) await page.keyboard.down(p.right)
const lvl = await page.evaluate(() => fetch('/data/levels/stage6.json').then((r) => r.json()))
const pits = [...(lvl.pits || []), ...(lvl.steps || []), ...(lvl.platforms || [])].map((p) => [p.x, p.x + p.w])
const log = { mode, samples: [], assists: 0, shots: [], result: null }
const t0 = Date.now(); let tick = 0, done = false
const snap = async (name) => { await page.screenshot({ path: `${OUT}/W-${mode}-${name}.png` }) }
let seen = new Set(); let turned = false
while (!done && Date.now() - t0 < CAP_MIN * 60000) {
  tick++
  const xs = await run(`return [s.boy, s.girl].filter(Boolean).map(h => h.x)`)
  for (const [i, p] of pads.entries()) {
    await page.keyboard.press(p.atk)
    const hx = xs[i] ?? 0
    if (pits.some(([a]) => a - hx > -4 && a - hx < 60) && tick % 2 === 0) await page.keyboard.press(p.jump)
  }
  if (tick % 10 === 0) await page.keyboard.press('Space')
  if (tick % 15 === 0) {
    const st = await run(`const hs = [s.boy, s.girl].filter(Boolean); let assist = 0; for (const h of hs) if (h.alive && h.hp <= 1) { h.hp = 4; assist++ }; return { assist, ended: s.ended, outro: s.outroOn, now: Math.round(s.time.now), xs: hs.map(h => Math.round(h.x)), hps: hs.map(h => h.hp), q: s.queen ? { act: s.queen.act, ph: s.queen.qphase, hp: s.queen.hp } : null, bossFight: s.bossFight, jar: s.honeyPickups?.children ? s.honeyPickups.getChildren().filter(o => o.active && o.getData('bossJar')).length : -1, sceneActive: s.scene.isActive(), keys: s.scene.manager.getScenes(true).map(x => x.scene.key).join('+'), pend: s.s2Pending.length, deaths: s.deaths }`)
    log.assists += st.assist
    log.samples.push({ wall: Math.round((Date.now() - t0) / 1000), ...st })
    fs.appendFileSync(`/tmp/walk_${mode}.jsonl`, JSON.stringify(log.samples.at(-1)) + '\n')
    const seg = st.xs[0] < 855 ? 'A' : st.xs[0] < 1995 ? 'B' : st.xs[0] < 3135 ? 'C' : st.xs[0] < 4560 ? 'D' : 'E'
    if (!seen.has(seg)) { seen.add(seg); await snap('seg' + seg) }
    if (st.jar > 0 && !turned) { turned = true; for (const p of pads) { await page.keyboard.up(p.right); await page.keyboard.down(p.left) } await snap('jar') }
    if (st.q && !seen.has('P' + st.q.ph)) { seen.add('P' + st.q.ph); await snap('boss-P' + st.q.ph) }
    if (st.outro || st.ended && st.q && st.q.hp <= 0) { await page.waitForTimeout(6000); await snap('clear'); log.result = 'cleared'; done = true }
  }
  await page.waitForTimeout(90)
}
for (const p of pads) { await page.keyboard.up(p.right); await page.keyboard.up(p.left) }
log.result ??= 'timeout'
log.wallSec = Math.round((Date.now() - t0) / 1000)
log.errs = errs
fs.writeFileSync(`${OUT}/walk_${mode}.log.json`, JSON.stringify(log, null, 1))
console.log(log.result, log.wallSec, 'assists', log.assists, 'errs', errs.length, errs.slice(0, 5), JSON.stringify(log.samples.slice(-1)))
await b.close()
