import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out='docs/qa-c2s2'; fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const report={description:'INJECTED inspection: positions, phase and HP are set programmatically; screenshots and checks do not establish a full playthrough', checks:[],failures:[],errors:[],passed:false}
const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
const ctx=await browser.newContext({viewport:{width:1280,height:720}})
await ctx.addInitScript(({gear})=>{if(!sessionStorage.getItem('c2s2-inspect-seeded')){localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}));localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-inspect',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:100,purse:{boy:50,girl:50},hp:{boy:5,girl:5},friends:[],charm:null,mode:'2p',solo:'boy',puffLeft:false}));sessionStorage.setItem('c2s2-inspect-seeded','1')} const original=Storage.prototype.setItem;window.__qaWrites=[];Storage.prototype.setItem=function(k,v){if(this===localStorage&&k==='sake-kuma-run-v1')window.__qaWrites.push(JSON.parse(v));return original.call(this,k,v)}},{gear})
const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text())})
const evaluate=(fn,arg)=>page.evaluate(fn,arg)
const shot=async(name)=>page.screenshot({path:`${out}/${name}.png`})
function timing(name,e,ret) {
 const valid=e.length===3&&e.map(x=>x.kind).join(',')==='chain-warn,chain-active,chain-end'
 const warning=valid?e[1].at-e[0].at:null,life=valid?e[2].at-e[1].at:null
 const passed=valid&&warning>=790&&warning<=900&&life>=1490&&life<=1600&&(name!=='P3'||ret===2990)
 report.checks.push({name:`${name} net timing (isolated injected invocation)`,passed,warnToActive:warning,activeToEnd:life,bossClockReturn:ret,events:e})
 if(!passed)report.failures.push(`${name} isolated net timing outside 790–900 / 1490–1600 ms`)
}
try{
 await page.goto('http://127.0.0.1:47417/?c2=1');await page.waitForTimeout(3500)
 const state=()=>evaluate(()=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('play');return {active:g.scene.getScenes(true).map(x=>x.scene.key),stage:s?.stageNo,mode:s?.mode,started:s?.started,intro:!!s?.storyIntro}})
 for(let i=0;i<25;i++){const s=await state();if(s.active.includes('play')&&s.stage===7&&s.started&&!s.intro)break;await page.keyboard.press('Enter');await page.waitForTimeout(1000)}
 let state0=await state();assert.equal(state0.stage,7);assert.equal(state0.mode,'2p');assert.equal(state0.started,true)
 await evaluate(()=>{window.__SAKE_GAME__.scene.getScene('play').coffeeDone=true})
 const staticInfo=()=>evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').children.list.filter(o=>o.getData?.('stage7-static')).map(o=>({name:o.name,type:o.type,x:o.x,y:o.y,body:!!o.body})))
 const before=await staticInfo();assert.ok(before.length>10);assert.ok(before.every(x=>!x.body))
 async function tp(x){await evaluate(x=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const h of [s.boy,s.girl])if(h){h.x=x;h.y=285;h.hp=6;h.graceUntil=s.time.now+120000;h.setVelocity(0,0)}s.cameras.main.centerOn(x+100,180)},x);await page.waitForTimeout(800)}
 for(const [name,x] of [['A',350],['B',1300],['C',2500],['D',3800],['D-reaction',4400]]){await tp(x);await shot(`current-injected-${name}`)}
 let after=await staticInfo();assert.deepEqual(after,before);report.checks.push({name:'2P static scenery positions, counts and no bodies',count:before.length,unchanged:true})
 let ev=await evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').stage7Events);assert.equal(ev.filter(e=>e.kind==='reaction').length,1);report.checks.push({name:'D reaction once in this scene (injected positions)',events:ev})
 await tp(4700)
 for(let i=0;i<18;i++){if(await evaluate(()=>!!window.__SAKE_GAME__.scene.getScene('play').queen))break;await page.keyboard.press('f');await page.waitForTimeout(800)}
 let boss=await evaluate(()=>{const q=window.__SAKE_GAME__.scene.getScene('play').queen;return q?{hp:q.hp,max:q.maxHp,phase:q.qphase,act:q.act,species:q.species}:null})
 assert.ok(boss);assert.equal(boss.max,55);assert.equal(boss.phase,1);await shot('current-injected-E');await shot('current-injected-boss-p1');report.checks.push({name:'Boss P1 and HP',boss})
 await page.waitForTimeout(6000)
 const summons=await evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {events:s.stage7Events,live:s.enemies.getChildren().filter(e=>e.active&&e.getData('trainer-summon')&&e.fsm!=='DEAD').length}})
 assert.ok(summons.live<=2);report.checks.push({name:'P1 summon cap observation',...summons})
 await evaluate(()=>{const q=window.__SAKE_GAME__.scene.getScene('play').queen;q.hp=35;q.updatePhase()});await page.waitForTimeout(800);await shot('current-injected-boss-p2')
 // Freeze natural boss/minion attacks, THEN drain any already-scheduled warning and
 // lifetime timers. Each injected invocation below is the only live chain event.
 await evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const o of s.enemies.getChildren())o.setActive(false)})
 await page.waitForTimeout(3500)
 await evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const o of [...s.enemyShots.getChildren()])o.destroy();for(const [h,x] of [[s.boy,5000],[s.girl,4800]]){h.setPosition(x,285);h.body.reset(x,285);h.hp=6;h.grace=0;h.hurtCd=0;h.setVelocity(0,0)}s.cameras.main.centerOn(4900,180)})
 const startEvents=await evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');const n=s.stage7Events.length;const ret=s.trainerChain(4640,5280);return {n,ret,boyHp:s.boy.hp,girlHp:s.girl.hp}})
 await page.waitForTimeout(1050);await shot('current-injected-boss-net');await page.waitForTimeout(1700)
 let result=await evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {events:s.stage7Events,boyHp:s.boy.hp,girlHp:s.girl.hp}})
 let e=result.events.slice(startEvents.n)
 console.log('ISOLATED_NET_EVENTS',JSON.stringify({e,startEvents,result}));timing('P2',e,startEvents.ret)
 assert.ok(result.boyHp<startEvents.boyHp,'hero in targeted net must take damage');assert.equal(result.girlHp,startEvents.girlHp,'hero outside targeted net stays safe')
 report.checks.push({name:'P2 net inside damaged and safe standing position unaffected (injected positions)',before:{boy:startEvents.boyHp,girl:startEvents.girlHp},after:{boy:result.boyHp,girl:result.girlHp},positions:{target:5000,safe:4800}})
 await evaluate(()=>{const q=window.__SAKE_GAME__.scene.getScene('play').queen;q.hp=16;q.updatePhase()});await page.waitForTimeout(800);await shot('current-injected-boss-p3')
 boss=await evaluate(()=>{const q=window.__SAKE_GAME__.scene.getScene('play').queen;return {hp:q.hp,max:q.maxHp,phase:q.qphase}});assert.equal(boss.phase,3)
 report.checks.push({name:'P3 threshold via injected HP',boss})
 const p3=await evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');const n=s.stage7Events.length;return {n,ret:s.trainerChain(4640,5280)}});await page.waitForTimeout(2800)
 const p3e=(await evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').stage7Events)).slice(p3.n);console.log('P3_NET_EVENTS',JSON.stringify(p3e));timing('P3',p3e,p3.ret)
 // Local event twice, then clear: validates one scene trigger and atomic snapshot only, not a real win.
 const flag=await evaluate(async()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),r=await import('/src/game/run.ts');window.__qaWrites=[];s.trainerDefeated();s.trainerDefeated();const pre=JSON.parse(localStorage.getItem('sake-kuma-run-v1'));const beforeWrites=window.__qaWrites.length;s.saveCurrentClear();const post=JSON.parse(localStorage.getItem('sake-kuma-run-v1'));return {pre,post,beforeWrites,writes:window.__qaWrites,events:s.stage7Events,pet:!!s.pet,side:r.isSideTrip()}})
 assert.equal(flag.pre.puffLeft,false);assert.equal(flag.beforeWrites,0);assert.equal(flag.post.puffLeft,true);assert.equal(flag.post.lastCleared,7);assert.equal(flag.post.nextStage,8);assert.equal(flag.writes.length,1);assert.equal(flag.events.filter(e=>e.kind==='departure').length,1);report.checks.push({name:'departure once; one atomic run write at injected clear',pre:{puffLeft:flag.pre.puffLeft,lastCleared:flag.pre.lastCleared},post:{puffLeft:flag.post.puffLeft,lastCleared:flag.post.lastCleared,nextStage:flag.post.nextStage},writes:flag.writes.length,departures:1,pet:flag.pet})
 await page.reload();await page.waitForTimeout(1500)
 const persisted=await evaluate(async()=>{const r=await import('/src/game/run.ts');return r.getRun()?.puffLeft});assert.equal(persisted,true);report.checks.push({name:'reload keeps puffLeft',persisted})
 const sideBefore=await evaluate(async()=>{const g=window.__SAKE_GAME__,r=await import('/src/game/run.ts'),before=localStorage.getItem('sake-kuma-run-v1');r.startSideTrip(g.registry);g.registry.set('stageNo',7);g.registry.set('playMode','2p');g.registry.set('soloCast','boy');for(const sc of g.scene.getScenes(true))g.scene.stop(sc.scene.key);g.scene.start('play');return {before,away:r.puffAway()}})
 await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s?.started&&!s.storyIntro},null,{timeout:30000})
 const side=await evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');const petBefore=!!s.pet;s.trainerDefeated();s.trainerDefeated();s.saveCurrentClear();return {petBefore,petAfter:!!s.pet,events:s.stage7Events,after:localStorage.getItem('sake-kuma-run-v1')}})
 assert.equal(sideBefore.away,false);assert.equal(side.petBefore,true);assert.equal(side.petAfter,false);assert.equal(side.events.filter(e=>e.kind==='departure').length,1);assert.equal(side.after,sideBefore.before);report.checks.push({name:'side scene plays departure once with baseline pet; main run unchanged (injected defeat)',petBefore:side.petBefore,petAfter:side.petAfter,events:side.events,unchanged:true})
 const reset=await evaluate(async()=>{const r=await import('/src/game/run.ts');r.startNewRun(6,false,'1p','girl',{set(){}});return r.getRun()?.puffLeft});assert.equal(reset,false);report.checks.push({name:'fresh run resets flag',reset})
 const old=await browser.newContext({viewport:{width:800,height:600}});await old.addInitScript(({gear})=>{if(!sessionStorage.getItem('old-seeded')){const run={version:1,runId:'qa-old',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,friends:[],charm:null,mode:'1p',solo:'boy'};localStorage.setItem('sake-kuma-run-v1',JSON.stringify(run));sessionStorage.setItem('old-seeded','1')}},{gear});const oldPage=await old.newPage();await oldPage.goto('http://127.0.0.1:47417/?c2=1');const legacy=await oldPage.evaluate(async()=>{const before=localStorage.getItem('sake-kuma-run-v1'),r=await import('/src/game/run.ts');return {puffLeft:r.getRun()?.puffLeft,before,after:localStorage.getItem('sake-kuma-run-v1')}});assert.equal(legacy.puffLeft,false);assert.equal(legacy.before,legacy.after);await old.close();report.checks.push({name:'legacy run without field defaults false without rewriting on read',puffLeft:legacy.puffLeft,unchanged:true})
 assert.deepEqual(report.errors,[]);report.passed=report.failures.length===0
}catch(e){report.failure=e.stack??String(e);await shot('current-injected-failure').catch(()=>{});console.error(report.failure)}
fs.writeFileSync(`${out}/injected-inspection-current.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.map(c=>c.name),errors:report.errors}));await browser.close();if(!report.passed)process.exit(1)
