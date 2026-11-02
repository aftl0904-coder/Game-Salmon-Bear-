import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })
const page = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage()
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto('http://127.0.0.1:47411/'); await page.waitForTimeout(4000)
await page.mouse.click(300, 200)
for (const id of ['mall', 'mallboss', 'stage5']) {
  const r = await page.evaluate(async (id) => {
    const a = await import('/src/game/audio.ts')
    a.unlockAudio(); a.setMuted(false); a.playSong(id)
    let peak = 0
    for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); peak = Math.max(peak, a.debugPeak()) }
    a.stopBgm()
    return peak
  }, id)
  console.log(id, 'peak', r)
}
console.log(errs)
await b.close()
