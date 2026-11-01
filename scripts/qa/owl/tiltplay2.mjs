import { chromium } from 'playwright'
const OUT = '/tmp/res2x-on58/docs/qa-keepers'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 4); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3000)
for (let i = 0; i < 10; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await page.keyboard.press('Enter'); await page.waitForTimeout(700) }
await page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); const x = s.checkpointXs[0]; for (const h of [s.boy, s.girl]) if (h) { h.x = x + 4; h.y = 200 } })
await page.waitForTimeout(1200)
for (let i = 0; i < 2; i++) { await page.keyboard.press('KeyG'); await page.waitForTimeout(700) }
await page.waitForTimeout(1200)
import { execSync } from 'child_process'
const det = async (n) => { const p = `${OUT}/tt-${n}.png`; await page.screenshot({ path: p }); return JSON.parse(execSync(`python3 /tmp/pt/tiltdetect.py ${p}`).toString()) }
const log = []
let prev = null, held = []
const set = async (want) => { for (const k of held) if (!want.includes(k)) await page.keyboard.up(k); for (const k of want) if (!held.includes(k)) await page.keyboard.down(k); held = want }
for (let t = 0; t < 70; t++) {
  const d = await det(t)
  if (!d.ball || !d.hole) { log.push({ t, d }); await set([]); continue }
  const dx = d.hole[0] - d.ball[0], dy = d.hole[1] - d.ball[1]
  const want = []
  if (Math.abs(dx) > 6) want.push(dx > 0 ? 'ArrowRight' : 'ArrowLeft')
  if (Math.abs(dy) > 6) want.push(dy > 0 ? 'ArrowDown' : 'ArrowUp')
  const jump = prev ? Math.hypot(d.ball[0] - prev.ball[0], d.ball[1] - prev.ball[1]) : 0
  log.push({ t, ball: d.ball.map(Math.round), hole: d.hole.map(Math.round), pit: d.pit && d.pit.map(Math.round), jump: Math.round(jump) })
  prev = d
  await set(want)
}
await set([])
console.log(log.map((l) => JSON.stringify(l)).join('\n'))
await b.close()
