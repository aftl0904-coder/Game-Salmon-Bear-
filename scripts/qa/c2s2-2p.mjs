import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const out='docs/qa-c2s2'; fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const ctx=await browser.newContext({viewport:{width:1280,height:720}})
const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
await ctx.addInitScript(({gear})=>{
 if (!sessionStorage.getItem('c2s2-2p-seeded')) {
  localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}))
  localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-2p',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:100,purse:{boy:50,girl:50},hp:{boy:5,girl:5},friends:[],charm:null,mode:'2p',solo:'boy',puffLeft:false}))
  sessionStorage.setItem('c2s2-2p-seeded','1')
 }
 // Observe actual storage writes, without altering game state.
 const original=Storage.prototype.setItem; window.__qaRunWrites=[]
 Storage.prototype.setItem=function(k,v){if(this===localStorage&&k==='sake-kuma-run-v1') window.__qaRunWrites.push({at:performance.now(),value:JSON.parse(v)});return original.call(this,k,v)}
},{gear})
const page=await ctx.newPage(),log={description:'2P keyboard bot via ordinary menu with seeded stage-6 checkpoint; no teleport, HP edit or forced win; automated, not human',samples:[],errors:[],passed:false,start:new Date().toISOString()}
page.on('pageerror',e=>log.errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')log.errors.push('console: '+m.text())})
const state=()=>page.evaluate(()=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('play');return {active:g.scene.getScenes(true).map(a=>a.scene.key),stage:s?.stageNo,mode:s?.mode,started:s?.started,ended:s?.ended,continued:s?.awaitingContinue,intro:!!s?.storyIntro,x1:s?.boy&&Math.round(s.boy.x),x2:s?.girl&&Math.round(s.girl.x),hp1:s?.boy?.hp,hp2:s?.girl?.hp,phase:s?.queen?.qphase,win:g.registry.get('winScreenShown')===true,events:s?.stage7Events,run:JSON.parse(localStorage.getItem('sake-kuma-run-v1')||'null'),writes:window.__qaRunWrites}})
let held=false,start=0
try {
 await page.goto(process.env.QA_URL||'http://127.0.0.1:47417/?c2=1');await page.waitForTimeout(4000)
 for(let i=0;i<25;i++){const s=await state();if(s.active.includes('play')&&s.stage===7&&s.started&&!s.intro)break;await page.keyboard.press('Enter');await page.waitForTimeout(1200)}
 let s=await state();assert.equal(s.mode,'2p');assert.equal(s.stage,7);assert.equal(s.started,true)
 let last=0,loops=0;start=Date.now();const timeoutMs=Number(process.env.QA_TIMEOUT_MS||360000)
 while(Date.now()-start<timeoutMs){
  loops++;s=await state()
  if(s.win) break
  if(s.active.includes('play')&&s.stage===7&&s.started&&!s.ended&&!s.intro){
   if(!held){await page.keyboard.down('d');await page.keyboard.down('ArrowRight');held=true}
   await page.keyboard.press('f');await page.keyboard.press(',');if(loops%3===0){await page.keyboard.press('g');await page.keyboard.press('.')}
   if(loops%24===0){await page.keyboard.press('t');await page.keyboard.press(';')}
  }else{
   if(held){await page.keyboard.up('d');await page.keyboard.up('ArrowRight');held=false}
   if(s.stage!==7) throw new Error(`left stage 7 before clear: ${s.stage}`)
   await page.keyboard.press(s.continued?'Space':'Enter')
  }
  if(Date.now()-last>10000){last=Date.now();log.samples.push({elapsed:Math.round((last-start)/1000),...s,writes:undefined,events:undefined});fs.writeFileSync(`${out}/2p-bot-current.json`,JSON.stringify(log,null,2)+'\n');console.log('2p',Math.round((last-start)/1000),JSON.stringify({stage:s.stage,x1:s.x1,x2:s.x2,phase:s.phase,hp1:s.hp1,hp2:s.hp2,ended:s.ended,continued:s.continued}))}
  await page.waitForTimeout(300)
 }
 // Always inspect after the final tick; a win exactly at timeout must not be lost.
 s=await state();log.final=s
 assert.equal(s.win,true,'timed out before clear card');assert.equal(s.stage,7);assert.equal(s.mode,'2p')
 assert.equal(s.run.lastCleared,7);assert.equal(s.run.nextStage,8);assert.equal(s.run.puffLeft,true)
 const ev=s.events||[];assert.equal(ev.filter(e=>e.kind==='reaction').length,1);assert.equal(ev.filter(e=>e.kind==='departure').length,1)
 const defeat=ev.findIndex(e=>e.kind==='defeat'),departure=ev.findIndex(e=>e.kind==='departure');assert.ok(defeat>=0&&departure>defeat,'boss defeat must precede departure')
 const writes=s.writes.filter(w=>w.value.runId==='qa-2p');const transition=writes.filter(w=>w.value.lastCleared===7||w.value.puffLeft===true)
 assert.ok(transition.length>=1);assert.ok(transition.every(w=>w.value.lastCleared===7&&w.value.nextStage===8&&w.value.puffLeft===true),'clear and departure must share a run snapshot')
 assert.deepEqual(log.errors,[]);log.passed=true
}catch(e){log.failure=e.stack??String(e);console.error(log.failure)}
if(held){await page.keyboard.up('d');await page.keyboard.up('ArrowRight')}
log.durationSec=start?Math.round((Date.now()-start)/1000):0;log.end=new Date().toISOString();log.final=await state().catch(()=>log.final);await page.screenshot({path:`${out}/2p-bot-current-final.png`}).catch(()=>{})
fs.writeFileSync(`${out}/2p-bot-current.json`,JSON.stringify(log,null,2)+'\n');console.log('2p result',JSON.stringify({passed:log.passed,durationSec:log.durationSec,failure:log.failure,errors:log.errors}));await browser.close();if(!log.passed)process.exitCode=1
