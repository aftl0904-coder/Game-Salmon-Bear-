// Cross-stage regression for Player.resolveLaneJumpLanding on PR #70.
// Stage/position setup is injected for repeatability; jumps and movement use
// the actual mobile touch controls or desktop keyboard, not velocity injection.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const OUT = process.env.QA_OUT ?? 'docs/qa-stage4'
const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47313/'
const MODE = process.env.QA_MODE ?? 'mobile'
const ROLE = process.env.QA_ROLE ?? 'boy'
assert.ok(['mobile', 'desktop'].includes(MODE))
assert.ok(['boy', 'girl'].includes(ROLE))
fs.mkdirSync(OUT, { recursive: true })
const allCases = [
  // Start on actual surfaces, jump and land, then walk off to ground.
  { stage: 1, startX: 1064, startHeight: 56, targetX: 1040, targetHeight: 56, lowerHeight: 0, kind: 'platform' },
  { stage: 2, startX: 1155, startHeight: 24, targetX: 1100, targetHeight: 24, lowerHeight: 0, kind: 'step' },
  { stage: 3, startX: 868, startHeight: 16, targetX: 820, targetHeight: 16, lowerHeight: 0, kind: 'step' },
  { stage: 5, startX: 1830, startHeight: 32, targetX: 1780, targetHeight: 32, lowerHeight: 0, kind: 'step' },
]
const cases = process.env.QA_STAGE ? allCases.filter(c => c.stage === Number(process.env.QA_STAGE)) : allCases
assert.ok(cases.length, 'at least one stage selected')
const report = { mode: MODE, role: ROLE, setup: 'stage and initial position injected; movement uses input', cases: [], errors: [] }
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  for (const c of cases) {
    const context = await browser.newContext(MODE === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } })
    const page = await context.newPage()
    page.on('pageerror', e => report.errors.push({ stage: c.stage, message: e.message }))
    const cdp = MODE === 'mobile' ? await context.newCDPSession(page) : null
    const touch = async (type, coords = []) => {
      const box = await page.locator('canvas').boundingBox()
      assert.ok(box, 'canvas visible')
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: coords.map(([x, y], id) => ({ x: box.x + box.width*x/640, y: box.y + box.height*y/360, id })) })
    }
    const tap = async (x, y) => { await touch('touchStart', [[x,y]]); await touch('touchEnd') }
    const state = () => page.evaluate(() => {
      const h = window.__SAKE_GAME__.scene.getScene('play').boy
      return { x: h.x, y: h.y, vx: h.body.velocity.x, vy: h.body.velocity.y, bodyBottom: h.body.bottom, jumping: h.laneJumping }
    })
    try {
      await page.goto(BASE)
      await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 30000 })
      await page.waitForTimeout(800)
      await page.evaluate(({ stage, role }) => {
        const g = window.__SAKE_GAME__
        g.registry.set('stageNo', stage); g.registry.set('difficulty', 'normal')
        g.registry.set('playMode', '1p'); g.registry.set('soloCast', role); g.registry.set('stageRound', 1)
        for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key)
        g.scene.start('play')
      }, { stage: c.stage, role: ROLE })
      await page.waitForTimeout(3500)
      if (MODE === 'mobile') await tap(615, 14)
      else await page.keyboard.press('Enter')
      await page.waitForFunction(() => { const s=window.__SAKE_GAME__.scene.getScene('play'); return s.started && !s.storyIntro }, null, { timeout: 15000 })
      const floor = await page.evaluate(() => window.__SAKE_TERRAIN__.terrainSolids().find(s => s.kind === 'ground').top)
      const target = await page.evaluate(({ x, kind }) => window.__SAKE_TERRAIN__.terrainSolids().find(s => s.kind === kind && s.x0 === x), { x: c.targetX, kind: c.kind })
      assert.ok(target && target.top === floor-c.targetHeight, `stage ${c.stage}: target terrain exists`)
      await page.evaluate(({ c, floor }) => {
        const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy
        s.coffeeDone=true; s.lastCheckpointX=10000; s.s2Pending=[]
        for (const e of [...s.enemies.getChildren()]) { e.disableBody?.(true,true); e.destroy() }
        h.setPosition(c.startX, floor-c.startHeight); h.body.reset(h.x,h.y)
        h.laneJumping=false; h.jumpConsumed=false; h.prevFeetY=h.y; h.hp=99; h.graceUntil=s.time.now+60000
        const original=h.resolveLaneJumpLanding.bind(h); window.__landings=[]; window.__jumpPeak=h.y
        h.resolveLaneJumpLanding=(body) => {
          window.__jumpPeak=Math.min(window.__jumpPeak,h.y)
          const prior={ y:h.y, vx:body.velocity.x, jumping:h.laneJumping }
          original(body)
          if (prior.jumping && !h.laneJumping) window.__landings.push({ prior, y:h.y, vx:body.velocity.x, bodyBottom:body.bottom, at:performance.now() })
        }
      }, { c, floor })
      await page.waitForTimeout(500)
      const start=await state()
      assert.ok(Math.abs(start.y-(floor-c.startHeight))<3, `stage ${c.stage}: starts on expected ground`)
      if (MODE === 'mobile') await touch('touchStart', [[584,320]])
      else await page.keyboard.down('g')
      await page.waitForFunction(top => window.__landings.some(x => Math.abs(x.y-top)<2), target.top, { timeout: 8000, polling: 30 })
      if (MODE === 'mobile') await touch('touchEnd')
      else await page.keyboard.up('g')
      await page.waitForTimeout(200)
      const landed=await state(), traces=await page.evaluate(() => window.__landings)
      const jumpPeak=await page.evaluate(() => window.__jumpPeak)
      const onTarget=traces.find(x => Math.abs(x.y-target.top)<2)
      assert.ok(target.top-jumpPeak>10, `stage ${c.stage}: real input raises hero before landing`)
      assert.ok(Math.abs(landed.y-target.top)<3 && !landed.jumping, `stage ${c.stage}: stays on upper surface`)
      assert.ok(Math.abs(onTarget.bodyBottom-(onTarget.y-2))<4, `stage ${c.stage}: body aligned in landing frame`)
      assert.ok(Math.abs(landed.bodyBottom-(landed.y-2))<4, `stage ${c.stage}: body remains aligned with feet`)
      await page.screenshot({ path: `${OUT}/cross-stage-${MODE}-${ROLE}-s${c.stage}.png`, scale: 'css' })
      if (MODE === 'mobile') await touch('touchStart', [[12,324]])
      else await page.keyboard.down('a')
      await page.waitForFunction(top => window.__landings.some(x => Math.abs(x.y-top)<2), floor-c.lowerHeight, { timeout: 8000, polling: 30 })
      if (MODE === 'mobile') await touch('touchEnd')
      else await page.keyboard.up('a')
      await page.waitForTimeout(180)
      const lower=await state()
      const lowerLanding=(await page.evaluate(() => window.__landings)).find(x => Math.abs(x.y-(floor-c.lowerHeight))<2)
      assert.ok(Math.abs(lower.y-(floor-c.lowerHeight))<3 && !lower.jumping, `stage ${c.stage}: lands on lower surface`)
      assert.ok(Math.abs(lowerLanding.bodyBottom-(lowerLanding.y-2))<4, `stage ${c.stage}: body aligned in lower landing frame`)
      assert.ok(Math.abs(lower.bodyBottom-(lower.y-2))<4, `stage ${c.stage}: body aligned after descending`)
      assert.ok(lowerLanding.prior.vx < -10 && Math.abs(lowerLanding.vx-lowerLanding.prior.vx)<0.01, `stage ${c.stage}: horizontal speed preserved at landing`)
      const result={stage:c.stage,kind:c.kind,start,jumpPeak,upper:landed,upperLanding:onTarget,lower,lowerLanding,passed:true}
      report.cases.push(result)
      console.log('PASS', MODE, ROLE, JSON.stringify(result))
    } catch (e) {
      const diagnostic = await page.evaluate(() => { const h=window.__SAKE_GAME__?.scene.getScene('play')?.boy; return h && {x:h.x,y:h.y,vx:h.body.velocity.x,vy:h.body.velocity.y,jumping:h.laneJumping,landings:window.__landings} }).catch(() => null)
      report.cases.push({ stage:c.stage, passed:false, error:e.stack??String(e), diagnostic })
      await page.screenshot({ path: `${OUT}/cross-stage-${MODE}-${ROLE}-s${c.stage}-failure.png`, scale:'css' }).catch(()=>{})
      console.error('FAIL', MODE, ROLE, c.stage, e.stack??String(e), JSON.stringify(diagnostic))
    } finally { await context.close() }
  }
} finally {
  report.passed = report.cases.length === cases.length && report.cases.every(c => c.passed) && !report.errors.length
  fs.writeFileSync(`${OUT}/cross-stage-${MODE}-${ROLE}.json`, JSON.stringify(report,null,2)+'\n')
  await browser.close()
}
if (!report.passed) process.exitCode=1
