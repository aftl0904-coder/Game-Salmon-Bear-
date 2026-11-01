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
await key('ArrowLeft'); await key('ArrowLeft'); await key('ArrowLeft')
console.log('A sel after 3x left (should skip disabled)', (await st()).sel)
await key('Enter')
console.log('A Enter on shop opens shop modal', (await st()).modal)
await key('Escape'); await page.waitForTimeout(400)
console.log('A after Esc from shop', JSON.stringify(await st()))
await b.close()
// B: carry
const b2 = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const c2 = await b2.newContext({ viewport: { width: 1280, height: 720 } })
await c2.addInitScript(() => { localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 5 })) })
const p2 = await c2.newPage(); p2.on('pageerror', (e) => errs.push(e.message))
await p2.goto('http://127.0.0.1:47313/'); await p2.waitForTimeout(5000)
await p2.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 2); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'girl'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await p2.waitForTimeout(3000)
for (let i = 0; i < 10; i++) { const intro = await p2.evaluate(() => !!window.__SAKE_GAME__.scene.getScene('play').storyIntro); if (!intro) break; await p2.keyboard.press('Enter'); await p2.waitForTimeout(700) }
await p2.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); s.boy.hp = 2; s.win() })
await p2.waitForTimeout(5500)
await p2.keyboard.press('Enter'); await p2.waitForTimeout(1500)
console.log('B carryHp', JSON.stringify(await p2.evaluate(() => window.__SAKE_GAME__.registry.get('carryHp'))))
await p2.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 3); g.registry.set('leavingToMenu', false); g.registry.set('winScreenShown', false); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await p2.waitForTimeout(3000)
console.log('B stage3 start hp', await p2.evaluate(() => window.__SAKE_GAME__.scene.getScene('play').boy.hp), 'carry consumed', await p2.evaluate(() => window.__SAKE_GAME__.registry.get('carryHp')))
console.log('errors', errs)
await b2.close()
