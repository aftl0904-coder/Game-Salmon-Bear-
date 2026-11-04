// Actual cover -> difficulty -> menu input; clear events/gear/score fixtures explicitly injected.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47951/'
const out = process.env.QA_OUT ?? 'docs/qa-first-release-growth/ui-20261104'
const mode = process.env.QA_MODE ?? 'desktop'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } })
const page = await context.newPage(), errors = [], checks = []
let passed = false
page.on('pageerror', e => errors.push(e.message))
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('sake-kuma-run-v1') || 'null'))
const raw = () => page.evaluate(() => localStorage.getItem('sake-kuma-run-v1'))
const screen = name => page.screenshot({ path: `${out}/${mode}-${name}.png`, scale: 'css' })
const tap = async (x, y) => { const b = await page.locator('canvas').boundingBox(); assert.ok(b); await page.touchscreen.tap(b.x + b.width*x/640, b.y + b.height*y/360); await page.waitForTimeout(160) }
const key = async k => { await page.keyboard.press(k); await page.waitForTimeout(90) }
const waitMenu = async () => {
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 45000 }); await page.waitForTimeout(900)
  if (mode === 'mobile') await tap(242, 330); else await key('Enter')
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('difficulty')); await page.waitForTimeout(800)
  if (mode === 'mobile') await tap(320, 190); else await key('Enter')
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('menu')); await page.waitForTimeout(900)
}
const reloadMenu = async () => { await page.reload(); await waitMenu() }
const modal = () => page.evaluate(() => { const s = window.__SAKE_GAME__.scene.getScene('menu'); return { start: !!s.startDialog, growth: s.growthDialog?.page ?? null, selected: s.growthDialog?.selected, source: s.growthDialog?.source } })
const open = async (stage, equip = 'none') => {
  if (mode === 'mobile') { await tap(stage === 1 ? 258 : 382, 143); await tap(320, 334) }
  else { await key(stage === 1 ? '1' : '2'); await key('Enter') }
  await page.waitForTimeout(400)
  if ((await modal()).start) {
    if (mode === 'mobile') {
      const labels = await page.evaluate(() => { const d = window.__SAKE_GAME__.scene.getScene('menu').startDialog; return d.choices.map(c => ({text:c.label.text,y:c.label.y})) })
      const row = labels.find(c => c.text.includes(equip === 'carry' ? '帶舊裝備' : '唔帶舊裝備') && (equip !== 'carry' || !c.text.includes('唔帶')))
      assert.ok(row); await tap(320, row.y)
    } else { await key('ArrowUp'); if (equip === 'carry') await key('ArrowUp'); await key('Enter') }
  }
  await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('menu').growthDialog?.page === 'source'); await page.waitForTimeout(350)
}
const choose = async n => {
  for (let i=0;i<n;i++) mode === 'mobile' ? await tap(435,194) : await key('ArrowRight')
  if (mode === 'mobile') await tap(320,242); else await key('Enter')
  await page.waitForFunction(() => window.__SAKE_GAME__.scene.getScene('menu').growthDialog?.page === 'points')
}
const confirm = async () => {
  if (mode === 'mobile') await tap(320,300)
  else { let index = (await modal()).selected; while (index !== 11) { await key('ArrowDown'); index = (index+1)%13 } await key('Enter') }
}
const started = async stage => { await page.waitForFunction(stage => { const g=window.__SAKE_GAME__; return stage===1 ? g.scene.isActive('gacha') : g.scene.isActive('worldmap') }, stage, { timeout: 20000 }) }
try {
  await page.goto(base+'?c2=1'); await waitMenu(); await screen('menu')
  await open(1); await screen('source-fresh')
  if (mode === 'mobile') await tap(320,287); else await key('Escape')
  assert.equal(await raw(), null); checks.push('normal menu -> fresh source cancel preserves absent run')
  await page.waitForTimeout(350); await open(1); await choose(0)
  if (mode === 'mobile') { await tap(278,101); await tap(514,101); await tap(514,101) }
  else { await key('ArrowRight'); for(let i=0;i<5;i++) await key('ArrowDown'); await key('ArrowRight'); await key('ArrowRight') }
  await screen('points-both'); await confirm(); await started(1)
  let run = await state(), first = run.runId
  assert.equal(run.eligible,true); assert.equal(run.growth.branches[0].heroes.boy.allocation.hp,1); assert.equal(run.growth.branches[0].heroes.girl.allocation.hp,2)
  checks.push('normal start: both heroes allocated independently, fresh 5 each and ranking eligible')
  // Fixture: call real modules for 5 clear events and purchase gear, not natural gameplay.
  const injected = await page.evaluate(async () => {
    const r=await import('/src/game/run.ts'), g=await import('/src/game/gear.ts'), p=await import('/src/game/progress.ts')
    const st={coins:10,purse:{boy:10},hp:{boy:3},friends:[]}
    for(let i=1;i<=5;i++) if (!r.saveClear(i,st,i===3?'S':i===5?'A':'C')) throw Error('fixture clear '+i)
    g.buy('boy','gun'); p.unlockStage(6)
    return {run:r.getRun(),eligible:r.scoreEligible()}
  })
  assert.equal(injected.run.growth.branches[0].heroes.boy.earned,10); assert.equal(injected.run.gear.boy.gun,1)
  checks.push('INJECTED fixture: 5 clear events (3=S,5=A), gun purchase, unlock6; not natural play')
  await reloadMenu(); let before=await raw()
  // Legacy callers must still be blocked; compare bytes.
  const blocked = await page.evaluate(async()=>{const r=await import('/src/game/run.ts');return r.startNewRun(1,false,'1p','boy',window.__SAKE_GAME__.registry)})
  assert.equal(blocked,false); assert.equal(await raw(),before); checks.push('legacy restart without explicit selection remains blocked; original bytes unchanged')
  await open(6); await choose(0); await screen('no-carry'); await confirm(); await started(6)
  run=await state(); const second=run.runId
  assert.equal(run.gear.boy.gun,0); assert.equal(run.eligible,true); assert.equal(run.growth.branches[1].heroes.boy.earned,5); assert.equal(run.growth.branches[0].heroes.boy.earned,10)
  checks.push('stage6 no equipment/no growth: new 5, old10 retained, eligible')
  await reloadMenu(); before=await raw(); await open(1); await choose(1)
  await screen('old-source-points')
  if(mode==='mobile') { await tap(278,132); await tap(514,132) } else { await key('ArrowDown'); await key('ArrowRight'); for(let i=0;i<5;i++)await key('ArrowDown'); await key('ArrowRight') }
  if(mode==='mobile') await tap(466,300); else await key('Escape')
  assert.equal(await raw(),before); checks.push('cancel after editing both heroes preserves all source bytes')
  await page.waitForTimeout(400); await open(1); await choose(1); await confirm(); await started(1)
  run=await state(); assert.equal(run.growth.branches.at(-1).sourceId,first); assert.equal(run.growth.branches.at(-1).heroes.boy.earned,10); assert.equal(run.eligible,false)
  assert.equal(run.growth.branches[1].id,second); checks.push('select original old10: exactly 10 not 15; nonzero growth excludes leaderboard')
  await reloadMenu(); await open(6); await choose(2); await confirm(); await started(6)
  run=await state(); assert.equal(run.growth.branches.at(-1).sourceId,second); assert.equal(run.growth.branches.at(-1).heroes.boy.earned,5); assert.equal(run.growth.branches[0].heroes.boy.earned,10)
  assert.equal(run.eligible,false); checks.push('select second saved branch independently: 5, not merged with 10; carry excludes leaderboard')
  // Stage 2 side trip selected from the ordinary menu, not by scene injection.
  await reloadMenu(); before=await raw()
  if (mode === 'mobile') { await tap(258,143); await tap(320,112); await tap(320,334) }
  else { await key('1'); await key('ArrowDown'); await key('Enter') }
  await started(6) // stage 2 and 6 both go via worldmap
  const side = await page.evaluate(async () => {
    const r=await import('/src/game/run.ts'), g=await import('/src/game/gear.ts')
    const isSide=r.isSideTrip(), eligible=r.scoreEligible()
    g.buy('girl','sword')
    const wrote=r.saveClear(2,{coins:999,purse:{girl:999},hp:{girl:1},friends:['fixture']},'S')
    return {isSide,eligible,wrote}
  })
  assert.equal(side.isSide,true); assert.equal(side.eligible,true); assert.equal(side.wrote,false); assert.equal(await raw(),before)
  checks.push('normal menu stage2 side trip is ranking eligible; INJECTED purchase and clear cannot change main-run bytes')
  // Inject a purchased gun into the active main run, then use the original gear-carry menu.
  await reloadMenu()
  await page.evaluate(async()=>{const r=await import('/src/game/run.ts'),g=await import('/src/game/gear.ts');r.resumeMain(window.__SAKE_GAME__.registry);g.buy('boy','gun')})
  await reloadMenu(); await open(1,'carry'); await choose(0); await confirm(); await started(1)
  run=await state(); assert.equal(run.gear.boy.gun,1); assert.equal(run.growth.branches.at(-1).sourceId,null); assert.equal(run.growth.branches.at(-1).heroes.boy.earned,5); assert.equal(run.eligible,false)
  checks.push('INJECTED main purchase then normal menu carry equipment / no growth: gun retained, 5 fresh points and ranking ineligible')
  // Inject quota failure while the real modal is open; no branch is written until retry.
  await reloadMenu(); before=await raw(); await open(1); await choose(0)
  await page.evaluate(() => { window.__origSet=Storage.prototype.setItem; Storage.prototype.setItem=function(k,v){if(k==='sake-kuma-run-v1')throw Error('injected quota');return window.__origSet.call(this,k,v)} })
  await confirm(); assert.equal(await raw(),before); assert.equal((await modal()).growth,'points'); await screen('quota-failure')
  assert.match(await page.locator('#save-warning').innerText(),/儲存失敗/)
  await page.evaluate(()=>{Storage.prototype.setItem=window.__origSet}); await confirm(); await started(1)
  checks.push('INJECTED quota error: confirmation blocked, exact bytes retained; retry through UI succeeds')
  // Corruption fixture before normal navigation: UI cannot overwrite.
  await page.evaluate(()=>localStorage.setItem('sake-kuma-run-v1','{bad injected fixture'))
  await reloadMenu(); before=await raw(); await open(1); await choose(0); await confirm()
  assert.equal(await raw(),before); assert.equal((await modal()).growth,'points'); await screen('corrupt-blocked')
  checks.push('INJECTED corrupt save: normal UI confirmation refused; original bytes retained')
  assert.deepEqual(errors,[]); passed=true
  console.log('PASS',mode,JSON.stringify(checks,null,2))
} catch(e) { console.error('FAIL', mode, e.stack ?? e); await screen('failure').catch(()=>{}) }
finally { fs.writeFileSync(`${out}/${mode}-ui.json`,JSON.stringify({mode,checks,errors,passed},null,2)+'\n'); await browser.close() }
if(!passed) process.exitCode=1
