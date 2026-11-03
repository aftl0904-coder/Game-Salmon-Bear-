// Uses an injected clear state, not a full boss fight.
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
try{
 await page.goto(BASE);await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000});await page.waitForTimeout(1800)
 await page.evaluate(async()=>{
   localStorage.setItem('sake-kuma-gear-v1',JSON.stringify({boy:{gun:1},girl:{}}))
   const r=await import('/src/game/run.ts'),game=window.__SAKE_GAME__
   game.registry.set('difficulty','normal');game.registry.set('stageRound',1)
   r.startNewRun(1,true,'1p','boy',game.registry)
   for(const s of game.scene.getScenes(true))game.scene.stop(s.scene.key)
   game.scene.start('play')
 })
 await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('play'))
 await page.waitForTimeout(3500);await page.keyboard.press('Enter')
 await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:20000})
 const result=await page.evaluate(async()=>{
   const r=await import('/src/game/run.ts'),g=await import('/src/game/gear.ts'),scores=await import('/src/game/score.ts'),game=window.__SAKE_GAME__,s=game.scene.getScene('play')
   localStorage.setItem('sake-kuma-scores-v1',JSON.stringify([{score:42},{score:99,timeSec:12}]))
   const validScores=scores.loadScores()
   const count=()=>JSON.parse(localStorage.getItem('sake-kuma-scores-v1')??'[]').length
   const reset=()=>localStorage.removeItem('sake-kuma-scores-v1')
   const prepare=()=>{s.ended=false;s.started=true;s.bossOn=true;s.boyGoal=true;s.girlGoal=true;for(const e of s.enemies.getChildren())if(e.boss)e.active=false}
   const rank=s.clearRank(3,6)
   reset();s.queenDefeated();prepare();s.checkWin();const ineligible=count(),rankIneligible=s.clearRank(3,6)
   r.startNewRun(1,false,'1p','boy',game.registry);reset();s.ended=false;s.queenDefeated();prepare();s.checkWin();const baseline=count()
   r.startNewRun(6,true,'1p','boy',game.registry);reset();s.ended=false;s.queenDefeated();const zeroCarry=count()
   g.buy('boy','gun');s.ended=false;s.queenDefeated();const laterGear=count()
   r.startNewRun(6,true,'1p','boy',game.registry);reset();s.ended=false;s.queenDefeated();prepare();s.checkWin();const c2Nonzero=count()
   return{rank,rankIneligible,ineligible,baseline,zeroCarry,laterGear,c2Nonzero,validScores}
 })
 assert.equal(result.ineligible,0);assert.equal(result.baseline,2);assert.equal(result.zeroCarry,1);assert.equal(result.laterGear,2);assert.equal(result.c2Nonzero,0);assert.equal(result.rank,result.rankIneligible)
 assert.equal(result.validScores.length,1);assert.equal(result.validScores[0].timeSec,12)
 assert.deepEqual(errors,[]);report.checks.push('both clear score writers enforce nonzero carry, baseline and zero carry; later gear preserves eligibility; clearRank remains visible')
 report.result=result;report.passed=true;console.log('PASS score',JSON.stringify(result))
}catch(e){report.error=e.stack??String(e);console.error(report.error)}
finally{fs.writeFileSync(`${OUT}/score.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
if(!report.passed)process.exitCode=1
