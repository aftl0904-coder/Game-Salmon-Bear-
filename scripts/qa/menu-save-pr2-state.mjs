import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const BASE = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47322/'
const OUT = process.env.QA_OUT ?? 'docs/qa-menu-save-pr2'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
const report = { checks: [], errors: [], passed: false }
try {
  const makePage = async initial => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await context.newPage()
    page.on('pageerror', e => report.errors.push(e.message))
    await page.goto(BASE)
    if (initial) await page.evaluate(v => { for (const [k, value] of Object.entries(v)) localStorage.setItem(k, value) }, initial)
    await page.reload()
    return { page, context }
  }
  const evaluate = (p, fn) => p.evaluate(fn)
  {
    const gear = { boy: { gun: 2 }, girl: { sword: 1 } }
    const { page, context } = await makePage({ 'sake-kuma-progress-v1': JSON.stringify({ maxStage: 4 }), 'sake-kuma-gear-v1': JSON.stringify(gear), 'sake-kuma-c2-cleared-v1': '1' })
    const result = await evaluate(page, async () => {
      const r = await import('/src/game/run.ts'), g = await import('/src/game/gear.ts')
      const reg = { data: { playMode: '2p', soloCast: 'girl' }, set(k,v) { this.data[k]=v }, get(k) { return this.data[k] } }
      const old = localStorage.getItem('sake-kuma-gear-v1')
      const migrated = structuredClone(r.getRun())
      r.resumeMain(reg)
      r.saveClear(4, { coins: 33, purse: { boy: 30, girl: 3 }, hp: { boy: 2, girl: 3 }, friends: ['huihui'] })
      const mainBefore = localStorage.getItem('sake-kuma-run-v1')
      const gearBefore = localStorage.getItem('sake-kuma-gear-v1')
      r.startSideTrip(reg)
      const baseline = structuredClone(g.activeGear())
      const sideEligible = r.scoreEligible()
      const bought = g.buy('boy', 'gun')
      const loss = g.dropOnDeath('boy')
      r.saveClear(2, { coins: 1, purse: { boy: 1 }, hp: { boy: 1 }, friends: ['side'] })
      const sideRun = localStorage.getItem('sake-kuma-run-v1')
      const sideGear = localStorage.getItem('sake-kuma-gear-v1')
      const restored = structuredClone(r.resumeMain(reg))
      return { migrated, old, mainBefore, gearBefore, baseline, sideEligible, bought, loss, sideRun, sideGear, restored, reg: reg.data, flag: localStorage.getItem('sake-kuma-c2-cleared-v1') }
    })
    assert.equal(result.migrated.lastCleared, 3); assert.equal(result.migrated.nextStage, 4)
    assert.equal(result.migrated.gear.boy.gun, 2); assert.equal(result.migrated.eligible, false)
    assert.equal(result.gearBefore, result.old); assert.equal(result.baseline.boy.gun, 0)
    assert.equal(result.sideEligible, true); assert.equal(result.bought, true); assert.equal(result.loss[0].from, 1)
    assert.equal(result.mainBefore, result.sideRun, 'side clear must not write main run')
    assert.equal(result.gearBefore, result.sideGear, 'side buy/death must not touch legacy gear')
    assert.equal(result.restored.nextStage, 5); assert.equal(result.reg.carryCoins, 33)
    assert.equal(result.reg.playMode, '2p'); assert.equal(result.reg.soloCast, 'girl')
    assert.equal(result.reg.carryHp.boy, 2); assert.equal(result.reg.carryPurse.girl, 3)
    assert.deepEqual(result.reg.runFriends, ['huihui']); assert.equal(result.flag, '1')
    report.checks.push('legacy maxStage−1; nonzero gear; isolated side buy/death; main HP/coins/friends restored')
    await context.close()
  }
  {
    const gear = { boy: { gun: 1 }, girl: {} }
    const { page, context } = await makePage({ 'sake-kuma-gear-v1': JSON.stringify(gear) })
    const result = await evaluate(page, async () => {
      const r = await import('/src/game/run.ts'), g = await import('/src/game/gear.ts')
      const reg = { set() {} }
      r.startNewRun(1, true, '1p', 'boy', reg)
      const carried = { eligible: r.scoreEligible(), gun: g.activeGear().boy.gun }
      r.startNewRun(6, false, '1p', 'girl', reg)
      const baseline = { eligible: r.scoreEligible(), gun: g.activeGear().boy.gun }
      g.buy('girl', 'sword')
      const laterGear = { eligible: r.scoreEligible(), sword: g.activeGear().girl.sword }
      r.startNewRun(1, false, '1p', 'boy', reg)
      r.startNewRun(6, true, '1p', 'boy', reg)
      return { carried, baseline, laterGear, zeroCarried: r.scoreEligible(), zero: g.activeGear().boy.gun }
    })
    assert.deepEqual(result.carried, { eligible: false, gun: 1 })
    assert.deepEqual(result.baseline, { eligible: true, gun: 0 })
    assert.deepEqual(result.laterGear, { eligible: true, sword: 1 })
    assert.equal(result.zeroCarried, true); assert.equal(result.zero, 0)
    report.checks.push('stage 1/6 start: nonzero carry ineligible; baseline eligible; new gear preserves eligibility; zero carry eligible')
    await context.close()
  }
  {
    const { page, context } = await makePage({ 'sake-kuma-c2-cleared-v1': '1' })
    await evaluate(page, async () => {
      const r = await import('/src/game/run.ts'), g = await import('/src/game/gear.ts'), c = await import('/src/game/charms.ts')
      const reg = { set() {} }
      r.startNewRun(1, false, '1p', 'boy', reg)
      c.setActiveCharm('speed'); g.buy('boy', 'gun')
      for (let i=1; i<=5; i++) r.saveClear(i, { coins: 20+i, purse: { boy: 20+i }, hp: { boy: 5-i }, friends: ['huihui'] })
    })
    await page.reload()
    const result = await evaluate(page, async () => {
      const r = await import('/src/game/run.ts'), g = await import('/src/game/gear.ts'), c = await import('/src/game/charms.ts')
      const reg = { data: {}, set(k,v) { this.data[k]=v } }
      const restored = r.resumeMain(reg)
      return { restored, reg: reg.data, gear: g.activeGear(), charm: c.activeCharm(), eligible: r.scoreEligible(), flag: localStorage.getItem('sake-kuma-c2-cleared-v1') }
    })
    assert.equal(result.restored.nextStage, 6); assert.equal(result.restored.lastCleared, 5)
    assert.equal(result.reg.stageNo, 6); assert.equal(result.reg.carryCoins, 25)
    assert.equal(result.reg.carryHp.boy, 0); assert.equal(result.gear.boy.gun, 1)
    assert.equal(result.charm, 'speed'); assert.equal(result.eligible, true); assert.equal(result.flag, '1')
    report.checks.push('injected stage 1→5 checkpoints persist across reload; stage 6 restores gear, HP, coins, charm and eligibility')
    await context.close()
  }
  {
    const { page, context } = await makePage({ 'sake-kuma-run-v1': '{bad', 'sake-kuma-gear-v1': '{bad', 'sake-kuma-progress-v1': '{bad' })
    const result = await evaluate(page, async () => {
      const r = await import('/src/game/run.ts'), g = await import('/src/game/gear.ts'), s = await import('/src/game/score.ts')
      const initial = r.getRun(), unchanged = localStorage.getItem('sake-kuma-run-v1')
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function() { throw new Error('storage blocked') }
      let threw = false
      try {
        r.startNewRun(1, false, '1p', 'boy', { set() {} })
        g.buy('boy','gun')
        s.saveScore({ score: 10, timeSec: 1, honey: 0, mode: '1p', at: 1 })
      } catch { threw = true }
      Storage.prototype.setItem = original
      return { initial, unchanged, threw, canSave: r.canSaveRun() }
    })
    assert.equal(result.initial, null); assert.equal(result.unchanged, '{bad'); assert.equal(result.threw, false); assert.equal(result.canSave, false)
    report.checks.push('corrupt JSON is not silently overwritten; blocked storage does not crash')
    await context.close()
  }
  {
    const { page, context } = await makePage()
    const result = await evaluate(page, async () => {
      const r = await import('/src/game/run.ts'), g = await import('/src/game/gear.ts'), p = await import('/src/game/progress.ts')
      const reg = { data: {}, set(k,v) { this.data[k]=v } }
      r.startSideTrip(reg); g.buy('boy','gun'); p.unlockStage(3)
      const marker = localStorage.getItem('sake-kuma-run-v1')
      r.startNewRun(1,true,'1p','boy',reg)
      return { marker, gear: g.activeGear(), eligible: r.scoreEligible(), stage: reg.data.stageNo }
    })
    assert.equal(JSON.parse(result.marker).noMain, true)
    assert.equal(result.gear.boy.gun, 0, 'side gear must not be carried into a new main run')
    assert.equal(result.eligible,true); assert.equal(result.stage,1)
    await context.close()
    const isolated = await makePage()
    await evaluate(isolated.page, async () => {
      const r=await import('/src/game/run.ts'),p=await import('/src/game/progress.ts')
      r.startSideTrip({set(){}});p.unlockStage(3)
    })
    await isolated.page.reload()
    const afterReload=await evaluate(isolated.page,async()=> (await import('/src/game/run.ts')).getRun())
    assert.equal(afterReload,null,'a side-only clear must not migrate into a phantom main run')
    report.checks.push('side-only progress is not migrated as a main run; temporary gear cannot leak into a new run')
    await isolated.context.close()
  }
  {
    const { page, context }=await makePage()
    await evaluate(page,async()=>{const r=await import('/src/game/run.ts');r.startNewRun(1,false,'1p','boy',{set(){}})})
    const other=await context.newPage();await other.goto(BASE);await other.evaluate(async()=>{(await import('/src/game/run.ts')).getRun()})
    await evaluate(page,async()=>{const r=await import('/src/game/run.ts');r.saveClear(1,{coins:9,purse:{boy:9},hp:{boy:3},friends:[]})})
    const result=await evaluate(other,async()=>{
      const r=await import('/src/game/run.ts'),g=await import('/src/game/gear.ts')
      r.resumeMain({set(){}});g.buy('boy','gun')
      return {saved:JSON.parse(localStorage.getItem('sake-kuma-run-v1')),legacy:localStorage.getItem('sake-kuma-gear-v1'),warning:document.getElementById('save-warning')?.textContent}
    })
    assert.equal(result.saved.nextStage,2);assert.equal(result.saved.gear.boy.gun,0);assert.equal(result.legacy,null)
    assert.match(result.warning,/另一個分頁/)
    report.checks.push('stale browser tab warns and cannot overwrite newer main checkpoint or legacy gear')
    await context.close()
  }
  {
    const { page, context }=await makePage()
    const result=await evaluate(page,async()=>{
      const r=await import('/src/game/run.ts'),g=await import('/src/game/gear.ts')
      r.startNewRun(1,false,'1p','boy',{set(){}});g.buy('boy','gun')
      const beforeRun=localStorage.getItem('sake-kuma-run-v1'), beforeGear=localStorage.getItem('sake-kuma-gear-v1')
      const original=Storage.prototype.setItem
      Storage.prototype.setItem=function(key,value){if(key==='sake-kuma-run-v1')throw Error('blocked');return original.call(this,key,value)}
      g.dropOnDeath('boy')
      Storage.prototype.setItem=original
      return {beforeRun,beforeGear,afterRun:localStorage.getItem('sake-kuma-run-v1'),afterGear:localStorage.getItem('sake-kuma-gear-v1'),warning:document.getElementById('save-warning')?.textContent}
    })
    assert.equal(result.afterRun,result.beforeRun);assert.equal(result.afterGear,result.beforeGear)
    assert.match(result.warning,/儲存失敗/)
    report.checks.push('failed canonical save warns and does not partially overwrite old gear key')
    await context.close()
  }
  {
    const bad={version:1,startStage:1,lastCleared:1,nextStage:2,gear:{},growth:{},eligible:true}
    const {page,context}=await makePage({'sake-kuma-run-v1':JSON.stringify(bad),'sake-kuma-gear-v1':JSON.stringify({boy:{gun:2},girl:{}})})
    const result=await evaluate(page,async()=>({run:(await import('/src/game/run.ts')).getRun(),gear:(await import('/src/game/gear.ts')).storedGear(),warning:document.getElementById('save-warning')?.textContent}))
    assert.equal(result.run,null);assert.equal(result.gear.boy.gun,2);assert.match(result.warning,/存檔損壞/)
    report.checks.push('structurally invalid run is rejected without wiping intact legacy gear')
    await context.close()
  }
  {
    const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
    const bad={version:1,startStage:1,lastCleared:1,nextStage:2,gear:{boy:{...gear,gun:'bad'},girl:{...gear}},growth:{},eligible:true}
    const {page,context}=await makePage({'sake-kuma-run-v1':JSON.stringify(bad),'sake-kuma-gear-v1':JSON.stringify({boy:{gun:3},girl:{}})})
    const result=await evaluate(page,async()=>({run:(await import('/src/game/run.ts')).getRun(),gear:(await import('/src/game/gear.ts')).storedGear(),warning:document.getElementById('save-warning')?.textContent}))
    assert.equal(result.run,null);assert.equal(result.gear.boy.gun,3);assert.match(result.warning,/存檔損壞/)
    report.checks.push('invalid non-numeric equipment is rejected without wiping old gear')
    await context.close()
  }
  {
    const {page,context}=await makePage()
    await evaluate(page,async()=>{
      const r=await import('/src/game/run.ts')
      r.startNewRun(1,false,'1p','boy',{set(){}})
      r.saveClear(1,{coins:5,purse:{boy:5},hp:{boy:3},friends:[]})
      r.saveTransitionCoins(2,15)
      r.startSideTrip({set(){}});r.saveTransitionCoins(2,99)
    })
    await page.reload()
    const result=await evaluate(page,async()=>{
      const r=await import('/src/game/run.ts'),reg={data:{},set(k,v){this.data[k]=v}}
      r.resumeMain(reg);return reg.data.carryCoins
    })
    assert.equal(result,15)
    report.checks.push('transition bonus survives reload; side transition cannot modify main coins')
    await context.close()
  }
  {
    const {page,context}=await makePage()
    await evaluate(page,async()=>{
      const r=await import('/src/game/run.ts'),c=await import('/src/game/charms.ts')
      r.startNewRun(1,false,'1p','boy',{set(){}});c.setActiveCharm('speed');r.rememberCharm('speed')
    })
    await page.reload()
    const restored=await evaluate(page,async()=>{
      const r=await import('/src/game/run.ts'),c=await import('/src/game/charms.ts')
      r.resumeMain({set(){}});return c.activeCharm()
    })
    assert.equal(restored,'speed')
    report.checks.push('gacha charm is restored after reload before the first clear')
    await context.close()
  }
  assert.deepEqual(report.errors, [])
  report.passed = true
  console.log('PASS state', JSON.stringify(report.checks))
} catch (e) { report.error = e.stack ?? String(e); console.error(report.error) }
finally { fs.writeFileSync(`${OUT}/state.json`, JSON.stringify(report, null, 2)+'\n'); await browser.close() }
if (!report.passed) process.exitCode = 1
