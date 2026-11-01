import { boot, OUT } from './owllib.mjs'
// Dodge-by-cue bot: acts only after the cue (gapX set / warn) + human reaction delay.
const react = +(process.argv[2] ?? 350), N = +(process.argv[3] ?? 5), mode = process.argv[4] ?? 'cue'
const { page, S, b, lvl, errs, ev } = await boot('boy')
const held = new Set()
const hold = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k) } else if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k) } }

const volleys = []; let cur = null, t0 = Date.now(), prevAct = ''
let shot = 0
while (volleys.length < N && Date.now() - t0 < 200000) {
  const s = await S(); if (s.gone) break
  if (s.act === 'feathers' && prevAct !== 'feathers') { cur = { startHp: s.hp, t: Date.now(), gap: null, hx0: s.hx, dodged: null, reactAt: null, trace: [] } }
  if (s.act === 'feathers' && cur) {
    cur.gap = s.gap
    cur.trace.push([Date.now() - cur.t, s.hx, s.hp])
    if (mode === 'still') { await hold('a', false); await hold('d', false) }
    else if (Date.now() - cur.t > react) {
      const d = s.gap - s.hx
      await hold('a', d < -10); await hold('d', d > 10)
    }
    if (shot < 2 && Date.now() - cur.t > 1400) { shot++; await page.screenshot({ path: `${OUT}/feathers-${shot}.png` }) }
    if (shot === 0 && Date.now() - cur.t > 250) { shot = -1; await page.screenshot({ path: `${OUT}/feathers-warn.png` }); shot = 0 }
  }
  if (prevAct === 'feathers' && s.act !== 'feathers' && cur) {
    await hold('a', false); await hold('d', false)
    volleys.push({ reactMs: react, gap: cur.gap, hx0: cur.hx0, hpLost: cur.startHp - s.hp, travel: Math.abs((cur.trace.at(-1)?.[1] ?? 0) - cur.hx0) })
    cur = null
  }
  prevAct = s.act
  // keep the hero away from owl contact: stay put otherwise; owl in 'rest' etc. not engaged
  if (s.act !== 'feathers') { await hold('a', false); await hold('d', false) }
  await page.waitForTimeout(40)
}
for (const k of [...held]) await hold(k, false)
console.log(JSON.stringify({ mode, react, volleys, errs: errs.slice(0, 4) }))
await b.close()
