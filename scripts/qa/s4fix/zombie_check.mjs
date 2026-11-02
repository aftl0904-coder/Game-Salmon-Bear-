// 蜜僵 behaviour on a real run: (A) open ground — speed range / lunges, (B) a zombie behind the 760 pit chasing a hero standing past it.
import { chromium } from 'playwright'
const URL = process.env.URL, LABEL = process.env.LABEL
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })); localStorage.setItem('sake-kuma-difficulty-v1', 'normal') })
const page = await ctx.newPage(); await page.goto(URL); await page.waitForTimeout(4500)
await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 4); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3500)
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.storyIntro?.destroy(); s.storyIntro = null; s.started = true; s.startedAt = s.time.now; s.pauseReadyAt = s.time.now + 1200; if (s.scene.get('UIScene')) s.scene.setVisible(true, 'UIScene') })
await page.waitForTimeout(300)
const zs = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const h = s.boy; return { hx: Math.round(h.x), hhp: h.hp, z: s.enemies.getChildren().filter((e) => e.species === 'honeyzombie' && e.active).map((e) => ({ x: +e.x.toFixed(1), y: +e.y.toFixed(1), v: Math.round(e.body.velocity.x), fsm: e.fsm, leap: !!e.getData('leaping'), anim: e.anims?.currentAnim?.key })) } })
async function run(name, setup, secs) {
  await page.evaluate(setup)
  const rows = []; const t0 = Date.now()
  while ((Date.now() - t0) / 1000 < secs) { const s = await zs(); s.t = +((Date.now() - t0) / 1000).toFixed(2); rows.push(s); await page.waitForTimeout(80) }
  // per zombie 0: speed stats from position deltas, leaps, closest approach
  const z0 = rows.map((r) => r.z[0]).filter(Boolean)
  const sp = []; for (let i = 1; i < z0.length; i++) { const dt = rows[i].t - rows[i - 1].t; if (dt > 0 && !z0[i].leap && !z0[i - 1].leap) sp.push(Math.abs(z0[i].x - z0[i - 1].x) / dt) }
  sp.sort((a, b) => a - b)
  const leaps = rows.filter((r) => r.z[0] && r.z[0].leap).length
  const ymin = Math.min(...z0.map((z) => z.y))
  console.log(LABEL, name, JSON.stringify({ samples: rows.length, speedP10: Math.round(sp[Math.floor(sp.length * 0.1)] || 0), speedMed: Math.round(sp[Math.floor(sp.length * 0.5)] || 0), speedP90: Math.round(sp[Math.floor(sp.length * 0.9)] || 0), leapFrames: leaps, yMin: ymin, startX: z0[0]?.x, endX: z0[z0.length - 1]?.x, heroEnd: rows[rows.length - 1].hx, heroHpEnd: rows[rows.length - 1].hhp }))
  return rows
}
const A = await run('A open ground (hero stands at 560, zombie placed at 380)', () => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.hp = s.boy.maxHp = 99; s.boy.x = 560; s.boy.y = 285; const z = s.enemies.getChildren().filter((e) => e.species === 'honeyzombie'); for (const e of s.enemies.getChildren()) if (e !== z[0]) e.setActive(false).setVisible(false); z[0].x = 380 }, 9)
const B0 = 0
const B = await run('B pit hop (hero at 880, zombie placed at 700, pit 760-808)', () => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.x = 880; s.boy.y = 285; const z = s.enemies.getChildren().filter((e) => e.species === 'honeyzombie'); window.__zinfo = z.map((e) => [e.x, e.active, e.visible, e.fsm, e.hp]); z[0].setActive(true).setVisible(true); z[0].x = 700 }, 9)
console.log('zinfo', JSON.stringify(await page.evaluate(() => window.__zinfo)))
await page.screenshot({ path: `/tmp/fix4b/docs/qa-s4fix/zombie_${LABEL}.png` })
import fs from 'fs'; fs.writeFileSync(`/tmp/fix4b/docs/qa-s4fix/zombie_${LABEL}.json`, JSON.stringify({ A, B }))
await b.close()
