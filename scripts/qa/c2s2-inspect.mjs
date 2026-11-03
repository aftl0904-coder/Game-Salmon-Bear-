import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out='docs/qa-c2s2'; fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const report={description:'INJECTED inspection: positions, phase and HP are set programmatically; screenshots and checks do not establish a full playthrough', checks:[],errors:[],passed:false}
const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
const ctx=await browser.newContext({viewport:{width:1280,height:720}})
await ctx.addInitScript(({gear})=>{localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}));localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-inspect',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:100,purse:{boy:50,girl:50},hp:{boy:5,girl:5},friends:[],charm:null,mode:'2p',solo:'boy',puffLeft:false}))},{gear})
const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text())})
const evaluate=(fn,arg)=>page.evaluate(fn,arg)
const shot=async(name)=>page.screenshot({path:`${out}/${name}.png`})
try{
 await page.goto('http://127.0.0.1:47417/?c2=1');await page.waitForTimeout(3500)
 const state=()=>evaluate(()=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('play');return {active:g.scene.getScenes(true).map(x=>x.scene.key),stage:s?.stageNo,mode:s?.mode,started:s?.started,intro:!!s?.storyIntro}})
 for(let i=0;i<25;i++){const s=await state();if(s.active.includes('play')&&s.stage===7&&s.started&&!s.intro)break;await page.keyboard.press('Enter');await page.waitForTimeout(1000)}
 let state0=await state();assert.equal(state0.stage,7);assert.equal(state0.mode,'2p');assert.equal(state0.started,true)
 await evaluate(()=>{window.__SAKE_GAME__.scene.getScene('play').coffeeDone=true})
 const staticInfo=()=>evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').children.list.filter(o=>o.getData?.('stage7-static')).map(o=>({name:o.name,type:o.type,x:o.x,y:o.y,body:!!o.body})))
 const before=await staticInfo();assert.ok(before.length>10);assert.ok(before.every(x=>!x.body))
 async function tp(x){await evaluate(x=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const h of [s.boy,s.girl])if(h){h.x=x;h.y=285;h.hp=6;h.graceUntil=s.time.now+120000;h.setVelocity(0,0)}s.cameras.main.centerOn(x+100,180)},x);await page.waitForTimeout(800)}
 for(const [name,x] of [['A',350],['B',1300],['C',2500],['D',3800],['D-reaction',4400]]){await tp(x);await shot(`injected-${name}`)}
 let after=await staticInfo();assert.deepEqual(after,before);report.checks.push({name:'2P static scenery positions, counts and no bodies',count:before.length,unchanged:true})
 let ev=await evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').stage7Events);assert.equal(ev.filter(e=>e.kind==='reaction').length,1);report.checks.push({name:'D reaction once in this scene (injected positions)',events:ev})
 await tp(4700)
 for(let i=0;i<18;i++){if(await evaluate(()=>!!window.__SAKE_GAME__.scene.getScene('play').queen))break;await page.keyboard.press('f');await page.waitForTimeout(800)}
 let boss=await evaluate(()=>{const q=window.__SAKE_GAME__.scene.getScene('play').queen;return q?{hp:q.hp,max:q.maxHp,phase:q.qphase,act:q.act,species:q.species}:null})
 assert.ok(boss);assert.equal(boss.max,55);assert.equal(boss.phase,1);await shot('injected-E');await shot('injected-boss-p1');report.checks.push({name:'Boss P1 and HP',boss})
 await page.waitForTimeout(6000)
 const summons=await evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {events:s.stage7Events,live:s.enemies.getChildren().filter(e=>e.active&&e.getData('trainer-summon')&&e.fsm!=='DEAD').length}})
 assert.ok(summons.live<=2);report.checks.push({name:'P1 summon cap observation',...summons})
 await evaluate(()=>{const q=window.__SAKE_GAME__.scene.getScene('play').queen;q.hp=35;q.updatePhase()});await page.waitForTimeout(800);await shot('injected-boss-p2')
 // Explicit method call isolates warning/lifetime; not an organic battle.
 const startEvents=await evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.queen.setActive(false);const n=s.stage7Events.length;s.trainerChain(4640,5280);return n});await page.waitForTimeout(1000);await shot('injected-boss-net');await page.waitForTimeout(1600)
 let e=(await evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').stage7Events)).slice(startEvents)
 const w=e.find(x=>x.kind==='chain-warn'),a=e.find(x=>x.kind==='chain-active'),end=e.find(x=>x.kind==='chain-end');assert.ok(w&&a&&end);console.log('NET_EVENTS',JSON.stringify(e));assert.ok(a.at-w.at>=760&&a.at-w.at<=900);assert.ok(end.at-a.at>=1450&&end.at-a.at<=1600)
 report.checks.push({name:'P2 net timing (injected invocation)',warnToActive:a.at-w.at,activeToEnd:end.at-a.at,events:e})
 await evaluate(()=>{const q=window.__SAKE_GAME__.scene.getScene('play').queen;q.setActive(true);q.hp=16;q.updatePhase()});await page.waitForTimeout(800);await shot('injected-boss-p3')
 boss=await evaluate(()=>{const q=window.__SAKE_GAME__.scene.getScene('play').queen;return {hp:q.hp,max:q.maxHp,phase:q.qphase}});assert.equal(boss.phase,3)
 report.checks.push({name:'P3 threshold via injected HP',boss})
 // Local event twice, then clear: validates one scene trigger and atomic snapshot only, not a real win.
 const flag=await evaluate(async()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),r=await import('/src/game/run.ts');s.trainerDefeated();s.trainerDefeated();const pre=JSON.parse(localStorage.getItem('sake-kuma-run-v1'));s.saveCurrentClear();const post=JSON.parse(localStorage.getItem('sake-kuma-run-v1'));return {pre,post,events:s.stage7Events,pet:!!s.pet,side:r.isSideTrip()}})
 assert.equal(flag.pre.puffLeft,false);assert.equal(flag.post.puffLeft,true);assert.equal(flag.post.lastCleared,7);assert.equal(flag.events.filter(e=>e.kind==='departure').length,1);report.checks.push({name:'departure once; flag and stage update together (injected clear)',pre:{puffLeft:flag.pre.puffLeft,lastCleared:flag.pre.lastCleared},post:{puffLeft:flag.post.puffLeft,lastCleared:flag.post.lastCleared},departures:1,pet:flag.pet})
 await page.reload();await page.waitForTimeout(1500)
 const persisted=await evaluate(async()=>{const r=await import('/src/game/run.ts');return r.getRun()?.puffLeft});assert.equal(persisted,true);report.checks.push({name:'reload keeps puffLeft',persisted})
 const side=await evaluate(async()=>{const r=await import('/src/game/run.ts');const reg={set(){}};const before=localStorage.getItem('sake-kuma-run-v1');r.startSideTrip(reg);const away=r.puffAway();r.saveClear(7,{coins:1,purse:{},hp:{},friends:[],puffLeft:true});return {away,before,after:localStorage.getItem('sake-kuma-run-v1')}});assert.equal(side.away,false);assert.equal(side.after,side.before);report.checks.push({name:'side baseline party and unchanged main run',away:side.away,unchanged:true})
 const reset=await evaluate(async()=>{const r=await import('/src/game/run.ts');r.startNewRun(6,false,'1p','girl',{set(){}});return r.getRun()?.puffLeft});assert.equal(reset,false);report.checks.push({name:'fresh run resets flag',reset})
 assert.deepEqual(report.errors,[]);report.passed=true
}catch(e){report.failure=e.stack??String(e);await shot('injected-failure').catch(()=>{});console.error(report.failure)}
fs.writeFileSync(`${out}/injected-inspection.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.map(c=>c.name),errors:report.errors}));await browser.close();if(!report.passed)process.exit(1)
