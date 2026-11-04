import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const c=await b.newContext({viewport:{width:1280,height:720}})
await c.addInitScript(({gear})=>{localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}));localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-side',startStage:6,lastCleared:7,nextStage:8,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:50,purse:{boy:20,girl:20},hp:{boy:5,girl:5},friends:[],charm:null,mode:'2p',solo:'boy',puffLeft:true}))},{gear})
const p=await c.newPage(),r={description:'Seeded main run next=8 and puffLeft=true; normal keyboard 2P menu entry into stage-7 side trip after Boot; defeat and clear are injected, not a real fight.',checks:[],errors:[],passed:false}
p.on('pageerror',e=>r.errors.push(e.stack));p.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())})
const state=()=>p.evaluate(()=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('play');return {active:g.scene.getScenes(true).map(x=>x.scene.key),stage:s?.stageNo,mode:s?.mode,started:s?.started,intro:!!s?.storyIntro,pet:!!s?.pet,events:s?.stage7Events,run:localStorage.getItem('sake-kuma-run-v1'),ending:localStorage.getItem('sake-kuma-c2-cleared-v1')}})
try {
 await p.goto('http://127.0.0.1:47420/')
 for(let i=0;i<35;i++){if(await p.evaluate(()=>window.__SAKE_GAME__?.scene.isActive('menu')))break;await p.keyboard.press('Enter');await p.waitForTimeout(1000)}
 await p.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('menu'),null,{timeout:30000});await p.waitForTimeout(700)
 const before=await p.evaluate(()=>({run:localStorage.getItem('sake-kuma-run-v1'),selected:window.__SAKE_GAME__.scene.getScene('menu').stageSel}));assert.equal(before.selected,7)
 await p.keyboard.press('ArrowRight');await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter')
 for(let i=0;i<35;i++){const s=await state();if(s.active.includes('play')&&s.started&&!s.intro)break;await p.keyboard.press('Enter');await p.waitForTimeout(1000)}
 await p.waitForFunction(()=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('play');return g.scene.isActive('play')&&s.started&&!s.storyIntro},null,{timeout:30000})
 const entry=await state();assert.equal(entry.stage,7);assert.equal(entry.mode,'2p');assert.equal(entry.pet,true);r.checks.push({name:'normal side entry after full Boot, original companion present',entry});await p.screenshot({path:'docs/qa-c2s2/dialogue-side-2p-entry.png'})
 await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.trainerDefeated();s.trainerDefeated()})
 await p.waitForFunction(()=>window.__SAKE_GAME__.registry.get('winScreenShown')===true,null,{timeout:30000})
 const done=await state();assert.equal(done.pet,false);assert.equal(done.events.filter(e=>e.kind==='departure').length,1);assert.equal(done.run,before.run);assert.notEqual(done.ending,'1');r.checks.push({name:'injected defeat, side departure once and main snapshot byte-identical',done})
 await p.keyboard.press('Enter');await p.waitForTimeout(300);await p.keyboard.press('Enter');await p.waitForFunction(()=>window.__SAKE_GAME__.scene.isActive('worldmap'),null,{timeout:30000});const map=await p.evaluate(()=>{const m=window.__SAKE_GAME__.scene.getScene('worldmap');return {picking:m.picking,open:m.openStages,to:m.data_.to}});assert.deepEqual(map,{picking:true,open:[6,7],to:7});assert.equal((await state()).run,before.run);r.checks.push({name:'side returns to held mainline map without starting stage 8',map});await p.screenshot({path:'docs/qa-c2s2/dialogue-side-2p-return-map.png'});assert.deepEqual(r.errors,[]);r.passed=true
}catch(e){r.failure=e.stack;await p.screenshot({path:'docs/qa-c2s2/dialogue-side-2p-failure.png'}).catch(()=>{})}
fs.writeFileSync('docs/qa-c2s2/dialogue-side-2p.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({passed:r.passed,checks:r.checks.map(x=>x.name),failure:r.failure,errors:r.errors}));await b.close();if(!r.passed)process.exitCode=1
