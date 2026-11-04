// Injected production scene and win state; checks real score writers, not a natural playthrough.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const base=process.env.QA_BASE_URL??'http://127.0.0.1:47951/'
const out=process.env.QA_OUT??'docs/qa-first-release-growth/ui-20261104/score'
fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const page=await browser.newPage({viewport:{width:1280,height:720}}), errors=[]
page.on('pageerror',e=>errors.push(e.message))
let passed=false, result
try {
 await page.goto(base); await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:45000})
 await page.evaluate(async()=>{const r=await import('/src/game/run.ts'),game=window.__SAKE_GAME__; game.registry.set('difficulty','normal');game.registry.set('stageRound',1);if(!r.startNewRun(1,false,'1p','boy',game.registry))throw Error('setup');for(const s of game.scene.getScenes(true))game.scene.stop(s.scene.key);game.scene.start('play')})
 await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('play'),null,{timeout:45000}); await page.waitForTimeout(3500)
 const box=await page.locator('canvas').boundingBox(); await page.mouse.click(box.x+box.width*0.94,box.y+box.height*0.045)
 await page.waitForFunction(()=>{const s=window.__SAKE_GAME__?.scene.getScene('play');return s?.scene.isActive()&&s.boy&&s.started&&!s.storyIntro},null,{timeout:45000})
 result=await page.evaluate(async()=>{
  const r=await import('/src/game/run.ts'), game=window.__SAKE_GAME__, s=game.scene.getScene('play'), key='sake-kuma-scores-v1'
  const zero={hp:0,atk:0,def:0,stam:0,sp:0}, source=r.getRun().runId
  const setup=sourceId=>({sourceId,allocations:{boy:{...zero},girl:{...zero}}})
  const count=()=>JSON.parse(localStorage.getItem(key)??'[]').length
  const prepare=()=>{s.ended=false;s.started=true;s.bossOn=true;s.boyGoal=true;s.girlGoal=true;for(const e of s.enemies.getChildren())if(e.boss)e.active=false}
  const check=(sourceId)=>{
    if(!r.startNewRun(1,false,'1p','boy',game.registry,setup(sourceId)))throw Error('setup restart failed')
    localStorage.removeItem(key);s.ended=false;s.queenDefeated();const queen=count()
    prepare();s.checkWin();const both=count()
    return {eligible:r.getRun().eligible,queen,both}
  }
  return {carried:check(source),baseline:check(null)}
 })
 assert.deepEqual(result.carried,{eligible:false,queen:0,both:0})
 assert.deepEqual(result.baseline,{eligible:true,queen:1,both:2})
 assert.deepEqual(errors,[]);await page.screenshot({path:`${out}/injected-score-writers.png`,scale:'css'});passed=true
 console.log('PASS injected GameScene score writers',JSON.stringify(result))
}catch(e){console.error('FAIL',e.stack??e);await page.screenshot({path:`${out}/failure.png`,scale:'css'}).catch(()=>{})}
finally{fs.writeFileSync(`${out}/score.json`,JSON.stringify({scope:'injected scene, starts and clear triggers; not natural gameplay',passed,result,errors},null,2)+'\n');await browser.close()}
if(!passed)process.exitCode=1
