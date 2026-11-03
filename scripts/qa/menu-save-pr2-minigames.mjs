// Injected minigame results validate persistence hooks, not full playthroughs.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const BASE=process.env.QA_BASE_URL??'http://127.0.0.1:47322/'
const OUT=process.env.QA_OUT??'docs/qa-menu-save-pr2'
fs.mkdirSync(OUT,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[]
page.on('pageerror',e=>errors.push(e.message))
const report={checks:[],errors,passed:false}
try {
 await page.goto(BASE);await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000});await page.waitForTimeout(1800)
 await page.evaluate(async()=>{
   const r=await import('/src/game/run.ts'),game=window.__SAKE_GAME__
   r.startNewRun(1,false,'1p','boy',game.registry);r.saveClear(1,{coins:5,purse:{boy:5},hp:{boy:3},friends:[]})
   game.registry.set('carryCoins',5);for(const s of game.scene.getScenes(true))game.scene.stop(s.scene.key);game.scene.start('bike',{to:2})
 })
 await page.waitForFunction(()=>window.__SAKE_GAME__.scene.isActive('bike'))
 await page.evaluate(()=>{const b=window.__SAKE_GAME__.scene.getScene('bike');b.coins=7;b.finish(true)})
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sake-kuma-run-v1')).coins),12)
 await page.evaluate(async()=>{
   const r=await import('/src/game/run.ts'),game=window.__SAKE_GAME__
   r.startNewRun(1,false,'1p','boy',game.registry)
   for(let i=1;i<=2;i++)r.saveClear(i,{coins:5,purse:{boy:5},hp:{boy:3},friends:[]})
   game.registry.set('carryCoins',5);for(const s of game.scene.getScenes(true))game.scene.stop(s.scene.key);game.scene.start('claw',{to:3})
 })
 await page.waitForFunction(()=>window.__SAKE_GAME__.scene.isActive('claw'))
 await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('claw').leave({coins:8,caught:1,drops:1}))
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sake-kuma-run-v1')).coins),13)
 await page.reload();await page.waitForLoadState('domcontentloaded')
 const resumed=await page.evaluate(async()=>{const r=await import('/src/game/run.ts'),reg={data:{},set(k,v){this.data[k]=v}};r.resumeMain(reg);return reg.data.carryCoins})
 assert.equal(resumed,13);assert.deepEqual(errors,[])
 report.checks.push('injected bike and claw results update the main checkpoint; bonus survives reload')
 report.passed=true;console.log('PASS minigames',JSON.stringify(report.checks))
}catch(e){report.error=e.stack??String(e);console.error(report.error)}
finally{fs.writeFileSync(`${OUT}/minigames.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
if(!report.passed)process.exitCode=1
