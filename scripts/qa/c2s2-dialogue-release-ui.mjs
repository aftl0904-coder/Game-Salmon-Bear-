import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const out='docs/qa-c2s2';const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
let all=true
for (const mobile of [false,true]) for (const stage of [6,7]) {
 const name=`dialogue-release-${mobile?'mobile-touch':'desktop-keyboard'}-stage${stage}`
 if(process.env.QA_FILTER&&!name.includes(process.env.QA_FILTER))continue
 const ctx=await browser.newContext(mobile?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
 if(stage===7)await ctx.addInitScript(({gear})=>{localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}));localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-release',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:50,purse:{boy:20},hp:{boy:5},friends:[],charm:null,mode:'1p',solo:'boy',puffLeft:false}))},{gear})
 const page=await ctx.newPage(),report={name,description:'Automated ordinary entry without c2 query; stage 7 uses a seeded stage-6-cleared save. End test invokes trainerDefeated directly; no real Boss fight or full playthrough. Simulated mobile is not a physical device.',checks:[],errors:[],passed:false}
 page.on('pageerror',e=>report.errors.push('pageerror: '+e.stack));page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text())})
 const active=key=>page.waitForFunction(k=>window.__SAKE_GAME__?.scene.isActive(k),key,{timeout:30000})
 const tap=async(x,y)=>{const b=await page.locator('canvas').boundingBox();assert.ok(b);await page.touchscreen.tap(b.x+b.width*x/640,b.y+b.height*y/360);await page.waitForTimeout(400)}
 const state=()=>page.evaluate(()=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('play');return {active:g.scene.getScenes(true).map(a=>a.scene.key),stage:s?.stageNo,started:s?.started,intro:!!s?.storyIntro,win:g.registry.get('winScreenShown'),events:s?.stage7Events,run:JSON.parse(localStorage.getItem('sake-kuma-run-v1')||'null'),ending:localStorage.getItem('sake-kuma-c2-cleared-v1')}})
 try {
  await page.goto('http://127.0.0.1:47420/')
  if(mobile){await active('logo');await page.waitForTimeout(1000);await tap(242,330);await active('difficulty');await page.waitForTimeout(700);await tap(320,190);await active('menu');await page.waitForTimeout(1000)}
  else {for(let i=0;i<25;i++){if(await page.evaluate(()=>window.__SAKE_GAME__?.scene.isActive('menu')))break;await page.keyboard.press('Enter');await page.waitForTimeout(1000)}await active('menu');await page.waitForTimeout(700)}
  const menu=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('menu');return {stage:s.stageSel,buttons:s.continentButtons.map(b=>b.stage)}});assert.ok(menu.buttons.includes(6));report.checks.push({name:'public C2 menu visible with no query',menu})
  if(stage===6){if(mobile)await tap(382,143);else await page.keyboard.press('Digit2');await page.waitForTimeout(300)}
  assert.equal(await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('menu').stageSel),stage)
  await page.screenshot({path:`${out}/${name}-menu.png`})
  if(mobile)await tap(148,334);else await page.keyboard.press('Enter')
  await active('worldmap')
  for(let i=0;i<18;i++){if(await page.evaluate(()=>window.__SAKE_GAME__.scene.isActive('play')))break;if(mobile)await tap(320,180);else await page.keyboard.press('Enter');await page.waitForTimeout(700)}
  await active('play')
  for(let i=0;i<20;i++){const s=await state();if(s.started&&!s.intro)break;if(mobile)await tap(320,180);else await page.keyboard.press('Enter');await page.waitForTimeout(700)}
  await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:30000})
  let st=await state();assert.equal(st.stage,stage);report.checks.push({name:'ordinary menu/map entry; no teleport',state:st});await page.screenshot({path:`${out}/${name}-entry.png`})
  if(stage===7){
   const reaction=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.coffeeDone=true;s.s2Pending=[];for(const e of s.enemies.getChildren())e.setActive(false);s.boy.setPosition(4400,285);s.boy.body.reset(4400,285);s.boy.setVelocity(0,0);s.cameras.main.centerOn(4400,180);const before=!!s.pet;s.tickExhibitReaction();return {text:s.children.list.filter(o=>o.text==='待補').map(o=>o.text),beforePet:before,afterPet:!!s.pet,events:s.stage7Events.slice()}})
   assert.deepEqual(reaction.text,['待補']);assert.equal(reaction.afterPet,reaction.beforePet);assert.equal(reaction.events.filter(e=>e.kind==='reaction').length,1);assert.equal(reaction.events.filter(e=>e.kind==='departure').length,0);report.checks.push({name:'injected D reaction placeholder 待補, no departure',reaction});await page.screenshot({path:`${out}/${name}-injected-reaction.png`})
   await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').startQueenFight())
   const wanted=['待補']
   await page.waitForFunction(expected=>{const s=window.__SAKE_GAME__.scene.getScene('play');const walk=o=>[o.text,...(o.list||[]).flatMap(walk)];const a=s.children.list.flatMap(walk);return expected.every(x=>a.includes(x))},wanted,{timeout:30000})
   const card=await page.evaluate(expected=>{const s=window.__SAKE_GAME__.scene.getScene('play');const walk=o=>[...(o.text&&(expected.includes(o.text)||String(o.text).includes('待補'))?[{text:o.text,bounds:{x:o.getBounds().x,y:o.getBounds().y,width:o.getBounds().width,height:o.getBounds().height}}]:[]),...(o.list||[]).flatMap(walk)];return s.children.list.flatMap(walk)},wanted);assert.ok(card.length>=3,'boss card must show 待補 fields');for(const item of card)assert.ok(item.bounds.x>=0&&item.bounds.y>=0&&item.bounds.x+item.bounds.width<=640&&item.bounds.y+item.bounds.height<=360,`card overflow ${JSON.stringify(item)}`);report.checks.push({name:'injected boss reveal renders 待補 card text within screen',card});await page.screenshot({path:`${out}/${name}-injected-boss-card.png`})
   await page.waitForFunction(()=>!!window.__SAKE_GAME__.scene.getScene('play').queen,null,{timeout:30000})
   const departure=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.trainerDefeated();return s.children.list.filter(o=>o.text==='待補').map(o=>o.text)});assert.ok(departure.length>=1);assert.ok(departure.every(t=>t==='待補'));report.checks.push({name:'injected defeat renders placeholder 待補 departure text',departure})
   await page.waitForFunction(()=>window.__SAKE_GAME__.registry.get('winScreenShown')===true,null,{timeout:30000});st=await state();assert.equal(st.events.filter(x=>x.kind==='departure').length,1);assert.equal(st.run.puffLeft,true);assert.equal(st.run.lastCleared,7);assert.equal(st.run.nextStage,8);assert.notEqual(st.ending,'1');report.checks.push({name:'injected defeat → departure once and clear snapshot',state:st});await page.screenshot({path:`${out}/${name}-injected-clear.png`})
   if(mobile){const pos=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),b=s.clearBtns[s.clearSel];return {x:320+b.bg.x,y:180+b.bg.y}});await tap(pos.x,pos.y);await tap(pos.x,pos.y)}else{await page.keyboard.press('Enter');await page.waitForTimeout(500);await page.keyboard.press('Enter')}
   await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').children.list.some(o=>o.list?.some(c=>c.text==='待續'&&c.style?.fontSize==='48px')),null,{timeout:10000});await page.screenshot({path:`${out}/${name}-injected-continued.png`});report.checks.push({name:'distinct visible 待續 after tally (injected defeat)'})
   await page.waitForTimeout(700);if(mobile)await tap(320,265);else await page.keyboard.press('Enter');await active('worldmap');await page.waitForTimeout(1000)
   const map=await page.evaluate(()=>{const g=window.__SAKE_GAME__,m=g.scene.getScene('worldmap');return {picking:m.picking,open:m.openStages,to:m.data_.to,stage:g.registry.get('stageNo'),run:JSON.parse(localStorage.getItem('sake-kuma-run-v1')),ending:localStorage.getItem('sake-kuma-c2-cleared-v1')}});assert.equal(map.picking,true);assert.deepEqual(map.open,[6,7]);assert.equal(map.to,7);assert.equal(map.run.nextStage,8);assert.notEqual(map.ending,'1');report.checks.push({name:'return to holding map; stage 8 unavailable, checkpoint preserved',map});await page.screenshot({path:`${out}/${name}-injected-return-map.png`})
  }
  assert.deepEqual(report.errors,[]);report.passed=true
 }catch(e){report.failure=e.stack||String(e);report.last=await state().catch(()=>null);await page.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{})}
 fs.writeFileSync(`${out}/${name}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({name,passed:report.passed,checks:report.checks.map(x=>x.name),failure:report.failure,errors:report.errors}));all&&=report.passed;await ctx.close()
}
await browser.close();if(!all)process.exitCode=1
