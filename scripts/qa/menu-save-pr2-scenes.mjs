// Injected checkpoints/wins exercise real scene transitions; this is not a playthrough.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const BASE=process.env.QA_BASE_URL??'http://127.0.0.1:47322/'
const OUT=process.env.QA_OUT??'docs/qa-menu-save-pr2'
const MODE=process.env.QA_MODE??'mobile'
fs.mkdirSync(OUT,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const context=await browser.newContext(MODE==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
const page=await context.newPage(), errors=[], report={mode:MODE, checks:[], errors, passed:false}
page.on('pageerror',e=>errors.push(e.message))
const active=async n=>page.waitForFunction(n=>window.__SAKE_GAME__?.scene.isActive(n),n,{timeout:30000})
const tap=async(x,y)=>{const b=await page.locator('canvas').boundingBox(); assert.ok(b); await page.touchscreen.tap(b.x+b.width*x/640,b.y+b.height*y/360); await page.waitForTimeout(300)}
const press=async(x=320,y=180)=>{if(MODE==='mobile')await tap(x,y);else {await page.keyboard.press('Enter');await page.waitForTimeout(300)}}
const shot=async name=>page.screenshot({path:`${OUT}/${MODE}-scene-${name}.png`,scale:'css'})
const readyPlay=async stage=>{await active('play');await page.waitForTimeout(3500);if(MODE==='mobile')await tap(615,14);else await page.keyboard.press('Enter');await page.waitForFunction(stage=>{const s=window.__SAKE_GAME__?.scene.getScene('play');return s?.stageNo===stage&&s.started&&!s.storyIntro},stage,{timeout:20000})}
const clear=async()=>{await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').win());await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').tallyDone,null,{timeout:15000})}
const button=async id=>{
 if(MODE==='mobile') { const p=await page.evaluate(id=>{const s=window.__SAKE_GAME__.scene.getScene('play'),b=s.clearBtns.find(x=>x.id===id);return b&&{x:s.clearOverlay.x+b.bg.x,y:s.clearOverlay.y+b.bg.y,on:b.on}},id);assert.ok(p?.on);await tap(p.x,p.y) }
 else {for(let i=0;i<8;i++){const selected=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.clearBtns[s.clearSel]?.id});if(selected===id)break;await page.keyboard.press('ArrowLeft')}const selected=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.clearBtns[s.clearSel]?.id});assert.equal(selected,id);await page.keyboard.press('Enter')}
}
try {
 await page.goto(BASE+'?c2=1'); await active('logo'); await page.waitForTimeout(1800)
 await page.evaluate(async()=>{
   const r=await import('/src/game/run.ts'),g=await import('/src/game/gear.ts'),game=window.__SAKE_GAME__
   game.registry.set('difficulty','normal');game.registry.set('stageRound',1)
   r.startNewRun(1,false,'1p','boy',game.registry);g.buy('boy','gun')
   r.saveClear(1,{coins:35,purse:{boy:35},hp:{boy:3},friends:['huihui']})
   r.resumeMain(game.registry)
   for(const s of game.scene.getScenes(true))game.scene.stop(s.scene.key)
   game.scene.start('play')
 })
 await readyPlay(2)
 assert.equal(await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').coinStock),35)
 await clear();await button('shop');await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').clearModal)
 if(MODE==='mobile')await tap(245,160);else await page.keyboard.press('f')
 const purchase=await page.evaluate(()=>JSON.parse(localStorage.getItem('sake-kuma-run-v1')))
 assert.equal(purchase.gear.boy.heart,1);assert.equal(purchase.coins,23);assert.equal(purchase.purse.boy,23)
 if(MODE==='mobile')await tap(592,343);else await page.keyboard.press('Enter')
 await page.waitForFunction(()=>!window.__SAKE_GAME__.scene.getScene('play').clearModal)
 await button('gamble');await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').clearModal)
 if(MODE==='mobile')await tap(254,234);else await page.keyboard.press('f')
 const placed=await page.evaluate(()=>JSON.parse(localStorage.getItem('sake-kuma-run-v1')))
 assert.equal(placed.purse.boy,3,'the stake is saved before the animation ends')
 await page.waitForTimeout(1800)
 const settled=await page.evaluate(()=>({saved:JSON.parse(localStorage.getItem('sake-kuma-run-v1')),actual:window.__SAKE_GAME__.scene.getScene('play').purse.boy}))
 assert.ok(settled.actual===3||settled.actual===43);assert.equal(settled.saved.purse.boy,settled.actual,'result is saved before leaving gamble')
 if(MODE==='mobile')await tap(386,234);else await page.keyboard.press('Escape')
 await page.waitForFunction(()=>!window.__SAKE_GAME__.scene.getScene('play').clearModal)
 await button('next');await active('worldmap')
 await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('worldmap').picking,null,{timeout:12000})
 const mainBefore=await page.evaluate(()=>({run:localStorage.getItem('sake-kuma-run-v1'),gear:localStorage.getItem('sake-kuma-gear-v1')}))
 assert.equal(JSON.parse(mainBefore.run).nextStage,3)
 await shot('map')
 if(MODE==='mobile')await tap(235,117);else {await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter')}
 await page.waitForFunction(()=>!window.__SAKE_GAME__.scene.getScene('worldmap').picking,null,{timeout:10000})
 for(let i=0;i<4;i++){if(await page.evaluate(()=>window.__SAKE_GAME__.scene.isActive('play')))break;await press();await page.waitForTimeout(700)}
 await readyPlay(2)
 const side=await page.evaluate(async()=>{const r=await import('/src/game/run.ts'),g=await import('/src/game/gear.ts'),s=window.__SAKE_GAME__.scene.getScene('play');return {side:r.isSideTrip(),gear:g.activeGear(),coins:s.coinStock,hp:s.boy.hp,eligible:r.scoreEligible()}})
 assert.equal(side.side,true);assert.equal(side.gear.boy.gun,0);assert.equal(side.coins,5);assert.equal(side.eligible,true)
 await page.evaluate(async()=>{const g=await import('/src/game/gear.ts'),s=window.__SAKE_GAME__.scene.getScene('play');g.buy('boy','gun');s.addCoins('boy',20);s.boy.hp=2})
 await clear();await shot('side-clear');await button('next');await active('worldmap')
 const mainAfter=await page.evaluate(()=>({run:localStorage.getItem('sake-kuma-run-v1'),gear:localStorage.getItem('sake-kuma-gear-v1'),stage:window.__SAKE_GAME__.registry.get('stageNo'),coins:window.__SAKE_GAME__.registry.get('carryCoins')}))
 assert.equal(mainAfter.run,mainBefore.run,'side clear cannot change main checkpoint')
 assert.equal(mainAfter.gear,mainBefore.gear,'side purchases cannot change persisted gear')
 assert.equal(mainAfter.stage,3);assert.equal(mainAfter.coins,JSON.parse(mainBefore.run).coins)
 report.checks.push('shop and gamble save each outcome before exit; replay side returns to stage3 without changing main save')
 // Re-enter the actual picking map to start a new C1 run from stage 1.
 await page.evaluate(()=>{const game=window.__SAKE_GAME__;for(const s of game.scene.getScenes(true))game.scene.stop(s.scene.key);game.registry.set('stageNo',3);game.scene.start('worldmap',{from:2,to:3,next:'bike',pick:true,stageNo:3})})
 await active('worldmap');await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('worldmap').picking)
 if(MODE==='mobile')await tap(150,221)
 else {
   await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft')
   await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter')
   assert.ok(await page.evaluate(()=>!!window.__SAKE_GAME__.scene.getScene('worldmap').startDialog),'repeat Enter must not confirm')
   assert.equal(await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('worldmap').startDialog.index),2,'cancel is the default')
   await page.keyboard.press('ArrowUp')
   assert.equal(await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('worldmap').startDialog.index),1,'up selects baseline')
 }
 await page.waitForFunction(()=>!!window.__SAKE_GAME__.scene.getScene('worldmap').startDialog)
 const mapDialog=await page.evaluate(()=>{const d=window.__SAKE_GAME__.scene.getScene('worldmap').startDialog;return{index:d.index,texts:d.root.list.filter(x=>typeof x.text==='string').map(x=>x.text)}})
 if(MODE==='mobile')assert.equal(mapDialog.index,2,'cancel is the default')
 assert.ok(mapDialog.texts.some(t=>t.includes('會取代目前本局（已打到第2關）')))
 await shot('restart-warning')
 if(MODE==='mobile')await tap(320,176);else await page.keyboard.press('Enter')
 await active('gacha')
 assert.equal(await page.evaluate(()=>window.__SAKE_GAME__.registry.get('stageNo')),1,'map restart must enter stage 1')
 report.checks.push('map restart warns about stage 2 and defaults to cancel; keyboard repeat cannot auto-confirm')
 // A separately injected sequential stage-5 checkpoint exercises the genuine credits UI.
 await page.evaluate(async()=>{
   const r=await import('/src/game/run.ts'),game=window.__SAKE_GAME__
   r.startNewRun(1,false,'1p','boy',game.registry)
   for(let i=1;i<5;i++)r.saveClear(i,{coins:25,purse:{boy:25},hp:{boy:3},friends:[]})
   r.resumeMain(game.registry)
   for(const s of game.scene.getScenes(true))game.scene.stop(s.scene.key)
   game.scene.start('play')
 })
 await readyPlay(5);await clear()
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sake-kuma-run-v1')).nextStage),6)
 await button('credits');await active('worldmap');await press();await active('credits');await page.waitForTimeout(1800)
 await press();await page.waitForTimeout(850)
 const options=await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('credits').children.list.filter(x=>typeof x.text==='string').map(x=>x.text))
 assert.ok(options.some(x=>x.includes('前往大陸2')))
 await shot('credits-c2')
 if(MODE==='mobile')await tap(320,313);else await page.keyboard.press('2')
 await active('worldmap')
 const c2=await page.evaluate(()=>({stage:window.__SAKE_GAME__.registry.get('stageNo'),cleared:localStorage.getItem('sake-kuma-c2-cleared-v1'),coins:window.__SAKE_GAME__.registry.get('carryCoins')}))
 assert.equal(c2.stage,6);assert.equal(c2.cleared,null);assert.equal(c2.coins,25)
 report.checks.push('injected stage5 win → normal credits → C2 entry via touch/key → stage6, without setting C2-cleared flag')
 await page.evaluate(async()=>{
   history.replaceState(null,'','/?c2=0');localStorage.removeItem('sake-kuma-c2-v1')
   const r=await import('/src/game/run.ts'),game=window.__SAKE_GAME__
   r.startSideTrip(game.registry);game.registry.set('stageNo',2)
   for(const s of game.scene.getScenes(true))game.scene.stop(s.scene.key)
   game.scene.start('play')
 })
 await readyPlay(2);await clear();await button('next');await active('menu')
 assert.equal(await page.evaluate(()=>localStorage.getItem('sake-kuma-c2-v1')),null)
 assert.notEqual(await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('menu').stageSel),6)
 report.checks.push('closed C2 gate returns side-trip completion to menu, not stage6')
 assert.deepEqual(errors,[]);report.passed=true;console.log(`PASS ${MODE}`,JSON.stringify(report.checks))
} catch(e){report.error=e.stack??String(e);console.error(report.error);await shot('failure').catch(()=>{})}
finally{fs.writeFileSync(`${OUT}/${MODE}-scenes.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
if(!report.passed)process.exitCode=1
