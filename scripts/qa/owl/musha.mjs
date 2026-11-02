import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
const errs = []; page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://127.0.0.1:47313/'); await page.waitForTimeout(5000)
await page.evaluate(() => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 5); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', '1p'); g.registry.set('soloCast', 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') })
await page.waitForTimeout(3000)
const r = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play'); const out = []
  for (const raw of [3, 5, 8, 15]) { const e = s.mkEnemy(s.boy.x + 300, 285, 'boss'); e.hp = e.maxHp = 100; e.lastHit = 0; e.receiveHit(raw, 1); out.push([raw, 100 - e.hp]) }
  const g = window.__SAKE_GAME__; const ids = ['huihui','guard','denim','brownie','snowcat','shiba','ginger','fleecy','gnome','tigercub','kuro']
  const res = {}
  g.registry.set('runFriends', ids.slice(0, 10)); res.ten = s.perfectEnding()
  g.registry.set('runFriends', ids); res.all = s.perfectEnding()
  g.registry.set('runFriends', []); localStorage.setItem('sake-kuma-friends-v1', JSON.stringify(ids)); res.saveOnly = s.perfectEnding()
  return { musha: out, res }
})
console.log(JSON.stringify(r), errs)
await b.close()
