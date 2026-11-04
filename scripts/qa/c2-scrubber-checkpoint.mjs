// Checkpoint only: stage, initial arena position and P2/P3 HP are injected.
// Dodges and the recovery attack use real keyboard or CDP touch input; not a full run.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const mode = process.env.MODE || 'desktop'
const out = 'docs/qa-c2-mall-scrubber'
const report = { mode, setup: 'stage and arena/hero positions injected; P2/P3 hp and one hit injected; dodge and attack via keyboard or native simulated touch; not a full playthrough', errors: [], rounds: [] }
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } })
const page = await context.newPage()
page.on('pageerror', e => report.errors.push(e.message))
let cdp
async function input(button, down) {
  if (mode === 'desktop') return down ? page.keyboard.down(button === 'left' ? 'KeyA' : 'KeyF') : page.keyboard.up(button === 'left' ? 'KeyA' : 'KeyF')
  const box = await page.locator('canvas').boundingBox()
  const x = box.x + box.width * (button === 'left' ? 12 : 532) / 640
  const y = box.y + box.height * (button === 'left' ? 324 : 312) / 360
  cdp ||= await context.newCDPSession(page)
  return cdp.send('Input.dispatchTouchEvent', { type: down ? 'touchStart' : 'touchEnd', touchPoints: down ? [{ x, y }] : [] })
}
const state = () => page.evaluate(() => {
  const s=window.__SAKE_GAME__.scene.getScene('play'), q=s.queen, h=s.boy
  if (!q) return null
  return { now: Math.round(s.time.now), act:q.act, phase:q.qphase, elapsed:Math.round(q.elapsed), move:q.move, bossX:Math.round(q.x), heroX:Math.round(h.x), hp:h.hp, bossHp:q.hp, warning:q.warning, canHurt:q.canHurtPlayer(), marker:q.marker.visible, body:{ x:q.body.x, width:q.body.width }, texture:q.texture.key }
})
async function waitState(pred, ms=25000) {
  const start=Date.now()
  while (Date.now()-start < ms) { const st=await state(); if (st && pred(st)) return st; await page.waitForTimeout(40) }
  throw Error(`timed out waiting for state; last=${JSON.stringify(await state())}`)
}
async function shot(name) { await page.screenshot({ path:`${out}/resume4-${mode}-${name}.png` }) }
try {
  await page.goto('http://127.0.0.1:47431/?c2=1')
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene?.getScene('play') && window.__SAKE_GAME__.scene.getScenes(true).length > 0, null, { timeout:30000 })
  await page.evaluate(() => {
    const g=window.__SAKE_GAME__; g.registry.set('stageNo',6); g.registry.set('difficulty','normal'); g.registry.set('playMode','1p'); g.registry.set('soloCast','boy'); g.registry.set('stageRound',1)
    for(const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
    g.scene.start('play')
  })
  await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('play')?.started, null, { timeout:30000 })
  // Wait until approved A dialogue has finished naturally, no injected story skip.
  await page.waitForFunction(() => {const s=window.__SAKE_GAME__.scene.getScene('play');return s.mallStorySeen.has(0)&&!s.storyIntro}, null, { timeout:30000 })
  await page.evaluate(() => {
    const s=window.__SAKE_GAME__.scene.getScene('play'); s.mallStorySeen=new Set([0,1,2,3,4]); s.coffeeDone=true; s.s2Pending=[]
    s.boy.setPosition(5025,285); s.boy.body.reset(5025,285); s.startQueenFight()
  })
  await page.waitForFunction(() => !!window.__SAKE_GAME__.scene.getScene('play').queen, null, { timeout:30000 })
  async function round(phase, expectedMove) {
    const warn=await waitState(s=>s.act==='warn'&&s.phase===phase&&s.move===expectedMove)
    assert.equal(warn.marker,true); assert.equal(warn.canHurt,false); assert.equal(warn.texture,'mall-scrubber-placeholder')
    await input('left',true)
    await shot(`p${phase}-${expectedMove}-warning`)
    const active=await waitState(s=>s.phase===phase&&s.act===expectedMove)
    await input('left',false)
    await shot(`p${phase}-${expectedMove}-active`)
    const recover=await waitState(s=>s.phase===phase&&s.act==='recover')
    await shot(`p${phase}-${expectedMove}-recover`)
    assert.equal(active.canHurt,true); assert.equal(recover.canHurt,false); assert.equal(recover.marker,false)
    report.rounds.push({warn,active,recover})
    assert.equal(recover.hp,warn.hp,'no HP loss during this dodge')
  }
  await round(1,'charge')
  // Genuine P1 input during recovery: record whether it caused damage, do not inject damage.
  const before=await state(); await input('attack',true); await page.waitForTimeout(130); await input('attack',false); await page.waitForTimeout(1100)
  report.counterattack={ before, after:await state() }
  // Force phase only: explicitly not a fair fight / normal progression.
  await page.evaluate(() => {const s=window.__SAKE_GAME__.scene.getScene('play'),q=s.queen,h=s.boy; q.hp=Math.floor(q.maxHp*0.60); q.lastHitAt=-1000; q.receiveHit(1,1); h.setPosition(q.x-40,h.y);h.body.reset(h.x,h.y);h.setVelocity(0,0)})
  await round(2,'brush')
  await page.evaluate(() => {const s=window.__SAKE_GAME__.scene.getScene('play'),q=s.queen,h=s.boy; q.hp=Math.floor(q.maxHp*0.20); q.lastHitAt=-1000; q.receiveHit(1,1); h.setPosition(q.x-55,h.y);h.body.reset(h.x,h.y);h.setVelocity(0,0)})
  await round(3,'charge')
  assert.deepEqual(report.errors,[])
  report.passed=true
} catch(e) { report.passed=false; report.error=e.stack||String(e); await shot('failure').catch(()=>{}) }
finally { fs.writeFileSync(`${out}/resume4-${mode}.json`,JSON.stringify(report,null,2)+'\n'); await browser.close() }
console.log(JSON.stringify(report,null,2)); if(!report.passed) process.exitCode=1
