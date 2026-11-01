import { chromium } from 'playwright'
const OUT = '/tmp/res2x-on58/docs/qa-gear'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } })
await ctx.addInitScript(() => { localStorage.setItem('sake-kuma-difficulty-v1', 'normal'); localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const page = await ctx.newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
const begin = async (purse, hp) => {
  await page.evaluate((p) => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 2); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); g.registry.set('winScreenShown', false); g.registry.set('leavingToMenu', false); g.registry.set('carryPurse', { boy: 0, girl: p }); g.registry.set('carryCoins', p); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, purse)
  await page.waitForTimeout(3000)
  for (let i = 0; i < 10; i++) { const intro = await page.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await page.keyboard.press('Enter'); await page.waitForTimeout(700) }
  await page.evaluate((h) => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.hp = h; s.win() }, hp)
  await page.waitForTimeout(5500)
}
const st = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return { hp: s.boy.hp, coins: s.purse.girl, modal: s.clearModal, sel: s.clearBtns.map((b, i) => `${b.id}:${b.on ? 1 : 0}${i === s.clearSel ? '*' : ''}`).join(' '), win: !!s.registry.get('winScreenShown'), carry: s.registry.get('carryHp') } })
const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(400) }
// A: broke
await begin(5, 2)
console.log('A broke', JSON.stringify(await st()))
await page.screenshot({ path: `${OUT}/clear-broke.png` })
await key('ArrowLeft')
await key('Enter')
console.log('A shop open modal', (await st()).modal)
await key('Escape'); await page.waitForTimeout(500)
console.log('A after Esc from shop (win should stay true, modal false)', JSON.stringify(await st()))
await b.close()
console.log('errors', errs)
