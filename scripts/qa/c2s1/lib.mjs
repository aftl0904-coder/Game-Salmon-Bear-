import { chromium } from 'playwright'
export const URL = process.env.URL || 'http://127.0.0.1:47411/'
export const OUT = process.env.OUT || '/tmp/c2s1/docs/qa-c2s1'
export async function boot({ mode = '1p', cast = 'boy' } = {}) {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
  await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.goto(URL); await page.waitForTimeout(5000)
  await page.evaluate(({ mode, cast }) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 6); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', mode); g.registry.set('soloCast', cast); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, { mode, cast })
  await page.waitForTimeout(3000)
  for (let i = 0; i < 12; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await page.keyboard.press('Enter'); await page.waitForTimeout(700) }
  return { b, page, errs }
}
export const S = (page, fn, arg) => page.evaluate(({ fn, arg }) => { const s = window.__SAKE_GAME__.scene.getScene('play'); return (new Function('s', 'a', fn))(s, arg) }, { fn: fn.toString().replace(/^[^{]*\{|\}$/g, ''), arg })
