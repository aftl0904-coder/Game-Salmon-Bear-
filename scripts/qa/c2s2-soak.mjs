import { chromium } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const out='docs/qa-c2s2';fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const context=await browser.newContext({viewport:{width:1280,height:720}})
const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
await context.addInitScript(({gear})=>{if(!sessionStorage.getItem('c2s2-soak-seeded')){localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}));localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-soak',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:100,purse:{boy:100,girl:0},hp:{boy:5},friends:[],charm:null,mode:'1p',solo:'boy',puffLeft:false}));sessionStorage.setItem('c2s2-soak-seeded','1')}},{gear})
const page=await context.newPage(),log={description:'1P automated keyboard operation in stage 7 from seeded stage-6 checkpoint; no teleport, HP editing, forced victory, or manual play. Patrols initial section only; not a full playthrough.',start:new Date().toISOString(),samples:[],errors:[],passed:false,completed:false}
page.on('pageerror',e=>log.errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')log.errors.push('console: '+m.text())})
const state=()=>page.evaluate(()=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('play');return {active:g.scene.getScenes(true).map(x=>x.scene.key),stage:s?.stageNo,mode:s?.mode,started:s?.started,ended:s?.ended,intro:!!s?.storyIntro,continued:s?.awaitingContinue,x:s?.boy&&Math.round(s.boy.x),hp:s?.boy?.hp,win:g.registry.get('winScreenShown')===true,now:s?.time?.now}})
let key=null,start=0,activeMs=0,previous=null
try{
 await page.goto(process.env.QA_URL||'http://127.0.0.1:47417/?c2=1');await page.waitForTimeout(4000)
 for(let i=0;i<25;i++){const s=await state();if(s.active.includes('play')&&s.stage===7&&s.started&&!s.intro)break;await page.keyboard.press('Enter');await page.waitForTimeout(1200)}
 let s=await state();assert.equal(s.stage,7);assert.equal(s.mode,'1p');assert.ok(s.started&&!s.intro)
 start=Date.now();let last=0,loop=0;const requiredMs=Number(process.env.QA_ACTIVE_MS||600000),maxWallMs=Number(process.env.QA_WALL_MS||720000)
 while(activeMs<requiredMs&&Date.now()-start<maxWallMs){
  loop++;const now=Date.now();s=await state();assert.equal(s.stage,7,'left stage 7: stop immediately');assert.equal(s.win,false,'stage cleared: stop immediately')
  const playing=s.active.includes('play')&&s.started&&!s.ended&&!s.intro
  if(previous?.playing&&playing)activeMs+=Math.min(now-previous.now,1000) // no credit for long unobserved gaps
  previous={now,playing}
  if(playing){
   const next=s.x>=650?'a':s.x<=240?'d':key||'d'
   if(key!==next){if(key)await page.keyboard.up(key);await page.keyboard.down(next);key=next}
   await page.keyboard.press('f');if(loop%5===0)await page.keyboard.press('g')
  }else{
   if(key){await page.keyboard.up(key);key=null}
   if(s.continued)await page.keyboard.press('Space') // normal continue, not time credited as play
  }
  if(now-last>=10000){last=now;log.samples.push({wallSec:Math.round((now-start)/1000),activeSec:Math.round(activeMs/1000),...s});fs.writeFileSync(`${out}/soak-1p-current.json`,JSON.stringify(log,null,2)+'\n');console.log('1p',JSON.stringify({wallSec:Math.round((now-start)/1000),activeSec:Math.round(activeMs/1000),stage:s.stage,x:s.x,hp:s.hp,playing,continued:s.continued}))}
  if(log.errors.length)throw new Error('browser error during soak')
  await page.waitForTimeout(300)
 }
 assert.ok(activeMs>=requiredMs,`insufficient stage-7 active time ${activeMs}ms`);assert.deepEqual(log.errors,[]);log.completed=true;log.passed=true
}catch(e){log.failure=e.stack??String(e);console.error(log.failure)}
if(key)await page.keyboard.up(key);log.activeSec=Math.round(activeMs/1000);log.wallSec=start?Math.round((Date.now()-start)/1000):0;log.final=await state().catch(()=>null);log.end=new Date().toISOString();await page.screenshot({path:`${out}/soak-1p-current-final.png`}).catch(()=>{});fs.writeFileSync(`${out}/soak-1p-current.json`,JSON.stringify(log,null,2)+'\n');console.log('1p result',JSON.stringify({passed:log.passed,activeSec:log.activeSec,wallSec:log.wallSec,failure:log.failure}));await browser.close();if(!log.passed)process.exitCode=1
