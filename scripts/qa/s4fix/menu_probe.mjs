import { chromium, devices } from 'playwright'
import fs from 'fs'
const OUT = '/tmp/fix4/docs/qa-s4fix'; fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ ...devices['Pixel 7 landscape'] })
const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://127.0.0.1:47612/'); await page.waitForTimeout(2500)
const cdp = await ctx.newCDPSession(page)
const geo = async () => page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, sc: r.width / 640 } })
const tapL = async (lx, ly) => { const g = await geo(); const x = g.x + lx * g.sc, y = g.y + ly * g.sc; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] }); await page.waitForTimeout(80); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
const scenes = () => page.evaluate(() => window.__SAKE_GAME__.scene.getScenes(true).map((s) => s.scene.key).join('+'))
for (let i = 0; i < 6; i++) { console.log(i, await scenes()); await page.screenshot({ path: `${OUT}/probe-${i}.png` }); await tapL(320, 180); await page.waitForTimeout(1800) }
console.log(await scenes(), errs); await b.close()
