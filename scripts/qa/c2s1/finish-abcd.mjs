/** Smoke for A rival / B stage7 / C floor room / D shop sprites. */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const URL = process.env.URL || 'http://127.0.0.1:4533/'
const OUT = process.env.OUT || '/tmp/c2s1/docs/qa-abcd'
fs.mkdirSync(OUT, { recursive: true })
const results = []
const pass = (id, ok, detail) => {
  results.push({ id, ok: !!ok, detail })
  console.log(ok ? 'PASS' : 'FAIL', id, typeof detail === 'string' ? detail : JSON.stringify(detail)?.slice(0, 220))
}

const quizSrc = fs.readFileSync('/tmp/gsb-qa/src/game/membershipQuiz.ts', 'utf8')
pass('A-rival-window', /base = qi === 0 \? 2200/.test(quizSrc), 'Q1 base 2200')

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e.message)))
await page.addInitScript(() => {
  localStorage.setItem('sake-kuma-progress-v1', JSON.stringify({ maxStage: 7 }))
})

const boot = async (stage, mode = '1p') => {
  await page.goto(URL)
  await page.waitForTimeout(4000)
  await page.evaluate(({ stage, mode }) => {
    const g = window.__SAKE_GAME__
    g.registry.set('stageNo', stage)
    g.registry.set('difficulty', 'normal')
    g.registry.set('playMode', mode)
    g.registry.set('soloCast', 'boy')
    g.registry.set('stageRound', 1)
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  }, { stage, mode })
  await page.waitForTimeout(2500)
  for (let i = 0; i < 14; i++) {
    if (!(await page.evaluate(() => !!window.__SAKE_GAME__?.scene.getScene('play')?.storyIntro))) break
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
  }
}

const run = (code, a) =>
  page.evaluate(({ code, a }) => {
    const s = window.__SAKE_GAME__.scene.getScene('play')
    return new Function('s', 'a', code)(s, a)
  }, { code, a })

await boot(6)
// D shops: real textures visible + signs
const shops = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const imgs = s.children.list.filter((o) => o.type === 'Image' && String(o.texture?.key || '').startsWith('s6-shop'))
  const texts = s.children.list.filter((o) => o.type === 'Text').map((o) => o.text)
  return {
    shopImgs: imgs.length,
    signs: texts.filter((t) => ['茶餐廳', '鞋店', '電器', '藥妝', '書店', '服飾', '手信', '咖啡'].includes(t)),
    door: texts.some((t) => /維修門/.test(t)),
  }
})
await page.screenshot({ path: path.join(OUT, 'D-shops.png') })
pass('D-shop-sprites', shops.shopImgs >= 6 && shops.signs.length >= 6, shops)

// C floor room
await run(`s.coffeeDone=true;s.physics.resume();s.storyIntro=null; for(const h of [s.boy,s.girl]) if(h){h.hp=6;h.graceUntil=s.time.now+9e5; if(h.body?.reset) h.body.reset(1432,300)}; s.cameras.main.centerOn(1432,180)`)
await page.waitForTimeout(400)
await page.keyboard.press('ArrowUp')
await page.waitForTimeout(800)
const room = await page.evaluate(() => {
  const texts = []
  const walk = (n) => {
    for (const o of n || []) {
      if (o.type === 'Text' && o.text) texts.push(String(o.text))
      if (o.list) walk(o.list)
    }
  }
  walk(window.__SAKE_GAME__.scene.getScene('play').children.list)
  return {
    title: texts.some((t) => /樓層掣|維修房/.test(t)),
    p: texts.some((t) => t === 'P'),
    sample: texts.filter((t) => /樓層|維修|P|中庭|會員|工場/.test(t)).slice(0, 12),
  }
})
await page.screenshot({ path: path.join(OUT, 'C-floor-room.png') })
pass('C-floor-room-open', room.title && room.p, room)
// Press correct P — key TWO is parking (index 1)
await page.keyboard.press('Digit2')
await page.waitForTimeout(1000)
const afterP = await run(`return { done: s.floorRoomDone, coins: s.purse?.boy ?? s.coinStock, intro: !!s.storyIntro }`)
pass('C-floor-p-reward', afterP.done === true && afterP.coins >= 8, afterP)

// B stage7
await boot(7)
const s7 = await page.evaluate(() => {
  const s = window.__SAKE_GAME__.scene.getScene('play')
  const coins = s.coins?.getChildren?.()?.length ?? s.children.list.filter((o) => o.type === 'Sprite' && String(o.texture?.key || '').includes('coin')).length
  const texts = s.children.list.filter((o) => o.type === 'Text').map((o) => o.text)
  return {
    stage: s.stageNo,
    exhibit: !!s.exhibit,
    mall: !!s.mall,
    member: texts.some((t) => /會員中心/.test(t)),
    coinish: coins,
    cps: s.checkpointXs,
  }
})
await page.screenshot({ path: path.join(OUT, 'B-stage7.png') })
pass('B-stage7-boot', s7.stage === 7 && s7.exhibit && s7.member, s7)

pass('no-pageerror', errs.length === 0, errs.slice(0, 5))
const summary = { results, fails: results.filter((r) => !r.ok).length, out: OUT }
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))
console.log('SUMMARY', JSON.stringify({ fails: summary.fails, n: results.length }))
await b.close()
process.exit(summary.fails ? 1 : 0)
