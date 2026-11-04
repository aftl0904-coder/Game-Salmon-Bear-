// Controlled fixture: inject run, play scene and clear; all subsequent UI operations are real keyboard or pure touchscreen.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const mode=process.env.QA_MODE??'desktop', out=process.env.QA_OUT??'docs/qa-first-release-growth/shop-map-20261104', base=process.env.QA_BASE_URL??'http://127.0.0.1:47953/'
fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const report={mode,scope:'INJECTED run, game/map scene and clear; actual UI input. No physical device, human or natural clear.',checks:[],errors:[],passed:false}
let page, context
async function setup(){
 context=await browser.newContext(mode==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message))
 await page.goto(base+'?c2=1');await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:45000});await page.waitForTimeout(900)
}
const key=async k=>{await page.keyboard.press(k);await page.waitForTimeout(100)}
const tap=async(x,y)=>{const b=await page.locator('canvas').boundingBox();assert.ok(b);await page.touchscreen.tap(b.x+b.width*x/640,b.y+b.height*y/360);await page.waitForTimeout(160)}
const screen=async name=>page.screenshot({path:`${out}/${mode}-${name}.png`,scale:'css'})
const raw=()=>page.evaluate(()=>localStorage.getItem('sake-kuma-run-v1'))
const state=async()=>JSON.parse(await raw())
const waitText=async text=>page.waitForFunction(t=>{const s=window.__SAKE_GAME__.scene.getScene('play');const walk=o=>o?.text===t||(o?.list||[]).some(walk);return s.children.list.some(walk)},text,{timeout:12000})
async function gameFixture(){
 await page.evaluate(async()=>{const r=await import('/src/game/run.ts'),g=window.__SAKE_GAME__;const z={hp:0,atk:0,def:0,stam:0,sp:0};g.registry.set('difficulty','normal');g.registry.set('stageRound',1);if(!r.startNewRun(1,false,'2p','boy',g.registry,{sourceId:null,allocations:{boy:z,girl:z}}))throw Error('first fixture');if(!r.startNewRun(1,false,'2p','boy',g.registry,{sourceId:null,allocations:{boy:{...z,hp:5},girl:{...z,hp:2}}}))throw Error('second fixture');for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('play')})
 await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('play'),null,{timeout:45000});await page.waitForTimeout(3500)
 if(mode==='mobile')await tap(600,16);else await key('Enter')
 await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro&&s.girl},null,{timeout:45000})
 await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.boy.hp=10;s.girl.hp=2;s.purse={boy:100,girl:100};s.coinStock=200;s.win()})
 await page.waitForTimeout(800)
 if(mode==='mobile')await tap(320,180);else await key('Enter')
 await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').tallyDone,{timeout:12000})
 // Open the actual clear-card shop, not the private shop method.
 if(mode==='mobile'){
  const b=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),b=s.clearBtns.find(x=>x.id==='shop');return {x:b.bg.x+s.clearOverlay.x,y:b.bg.y+s.clearOverlay.y}});await tap(b.x,b.y)
 }else{
  for(let i=0;i<8;i++){const pos=await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('play').clearSel);if(pos===0)break;await key('ArrowLeft')};await key('Enter')
 }
 await waitText('小朋友檔口');await page.waitForTimeout(300);await screen('shop-open')
}
async function openRespec(){if(mode==='mobile')await tap(410,343);else await key('r');await waitText('商店免費重配（兩人各自點數）');await page.waitForTimeout(350)}
async function savePoints(){if(mode==='mobile')await tap(320,300);else{for(let i=0;i<6;i++)await key('ArrowDown');await key('Enter')}}
try{
 if (process.env.QA_ONLY !== 'map') {
 await setup();await gameFixture()
 // Original shop controls and character switch still work.
 if(mode==='mobile'){await tap(110,160);await tap(220,138);await tap(110,160)}else{await key('Space');await key('ArrowRight');await key('Space')}
 let bought=await state();assert.ok(bought.gear.boy.heart>0);assert.ok(bought.gear.girl.heart>0);report.checks.push('Injected win; actual clear-card opening and original buy/switch for both characters')
 const beforeCancel=await raw();await openRespec()
 if(mode==='mobile'){await tap(126,101);await tap(514,101);await screen('cancel-edited-both');await tap(466,300)}else{for(let i=0;i<5;i++)await key('ArrowUp');await key('ArrowLeft');for(let i=0;i<5;i++)await key('ArrowDown');await key('ArrowRight');await screen('cancel-edited-both');await key('Escape')}
 assert.equal(await raw(),beforeCancel);report.checks.push('Cancel edits on both heroes leaves exact snapshot untouched')
 await openRespec()
 // Switch back to boy selection: shop currently selected girl.
 if(mode==='mobile'){
  for(let i=0;i<5;i++)await tap(126,101);await tap(278,132);await tap(278,132);for(let i=0;i<5;i++)await tap(514,101)
 }else{
  for(let i=0;i<5;i++)await key('ArrowUp');for(let i=0;i<5;i++)await key('ArrowLeft');await key('ArrowDown');await key('ArrowRight');await key('ArrowRight');for(let i=0;i<4;i++)await key('ArrowDown');for(let i=0;i<5;i++)await key('ArrowRight')
 }
 await screen('both-edited')
 const old=await state();const oldLive=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return [s.boy.hp,s.girl.hp]})
 await page.evaluate(()=>{window.__save=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sake-kuma-run-v1')throw Error('injected quota');return window.__save.call(this,k,v)}})
 await savePoints();assert.equal(await raw(),JSON.stringify(old));assert.deepEqual(await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return [s.boy.hp,s.girl.hp]}),oldLive);assert.match(await page.locator('#save-warning').innerText(),/儲存失敗/);await screen('quota-failure')
 await page.evaluate(()=>{Storage.prototype.setItem=window.__save})
 // After the failed save, selection remains on the confirmation button.
 if(mode==='mobile')await tap(320,300);else await key('Enter')
 await page.waitForTimeout(350);const saved=await state(),branch=saved.growth.branches.at(-1),arch=saved.growth.branches[0]
 assert.equal(branch.heroes.boy.earned,5);assert.equal(branch.heroes.girl.earned,5);assert.equal(branch.heroes.boy.allocation.hp,0);assert.equal(branch.heroes.boy.allocation.atk,2);assert.equal(branch.heroes.girl.allocation.hp,5);assert.deepEqual(arch,old.growth.branches[0]);assert.deepEqual(saved.purse,old.purse);assert.equal(saved.eligible,old.eligible)
 const live=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {boy:s.boy.hp,girl:s.girl.hp,boyMax:s.heroMaxHp(s.boy),girlMax:s.heroMaxHp(s.girl)}})
 assert.equal(live.boy,live.boyMax);assert.equal(live.girl,oldLive[1]);assert.ok(live.boy>0&&live.boy<oldLive[0]);assert.equal(saved.hp.boy,live.boy);assert.equal(saved.hp.girl,live.girl);await screen('saved')
 report.checks.push(`Injected quota fails atomically, retry saves; no over-allocation, boy has 3 unspent, archived branch/purse/eligibility intact, HP ${JSON.stringify(live)}`)
 // Side mode must expose baseline and cannot write even if entry is tapped.
 await page.evaluate(async()=>{const r=await import('/src/game/run.ts'),s=window.__SAKE_GAME__.scene.getScene('play');r.startSideTrip(s.registry)})
 const sideBefore=await raw();if(mode==='mobile')await tap(410,343);else await key('r');await waitText('支線為基準，不能重配永久成長。');assert.equal(await raw(),sideBefore)
 const refused=await page.evaluate(async()=>{const r=await import('/src/game/run.ts');return {allocation:r.combatGrowth('boy'),saved:r.respecCurrentRun({boy:{hp:1,atk:0,def:0,stam:0,sp:0},girl:{hp:0,atk:0,def:0,stam:0,sp:0}},{boy:1})}});assert.equal(refused.saved,false);assert.equal(refused.allocation.hp,0);assert.equal(await raw(),sideBefore);await screen('side-disabled');report.checks.push('Injected side context: UI and direct API refuse permanent respec; main bytes unchanged')
 await context.close()
 }
 for(const stage of [1,6]){
  await setup();await page.evaluate(async stage=>{const r=await import('/src/game/run.ts'),g=window.__SAKE_GAME__,z={hp:0,atk:0,def:0,stam:0,sp:0};if(!r.startNewRun(stage,false,'2p','boy',g.registry,{sourceId:null,allocations:{boy:{...z,atk:1},girl:{...z,def:1}}}))throw Error('fixture');if(!r.saveClear(stage,{coins:10,purse:{boy:10,girl:10},hp:{boy:2,girl:3},friends:['fixture']},'S'))throw Error('clear fixture');r.resumeMain(g.registry);const to=stage+1;for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('worldmap',{from:to,to,next:'play',pick:true,stageNo:to})},stage)
  await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('worldmap').picking,{timeout:15000});await page.waitForTimeout(900)
  const select=async()=>{if(mode==='mobile')await tap(stage===1?150:187.5,stage===1?221:191);else{const selected=await page.evaluate(()=>window.__SAKE_GAME__.scene.getScene('worldmap').pickIndex);if(selected!==stage)await key('ArrowLeft');await key('Enter')}}
  await select();await page.waitForFunction(()=>!!window.__SAKE_GAME__.scene.getScene('worldmap').startDialog);const before=await raw();const d=await page.evaluate(()=>{const d=window.__SAKE_GAME__.scene.getScene('worldmap').startDialog;return {index:d.index,labels:d.labels.map(x=>x.text),texts:d.root.list.filter(x=>typeof x.text==='string').map(x=>x.text)}});assert.equal(d.labels[d.index],'取消');assert.ok(d.texts.some(t=>t.includes('會取代目前本局')));await screen(`map-s${stage}-warning`)
  if(mode==='mobile')await tap(320,207);else await key('Enter');assert.equal(await raw(),before)
  await select();if(mode==='mobile')await tap(320,176);else{await key('ArrowUp');await key('Enter')}
  await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('worldmap').growthDialog?.page==='source');await page.waitForTimeout(300)
  // Test one old branch and one fresh branch with their true rank eligibility.
  if(stage===1){if(mode==='mobile')await tap(435,194);else await key('ArrowRight')}
  if(mode==='mobile')await tap(320,242);else await key('Enter');await page.waitForTimeout(200);await screen(`map-s${stage}-points`)
  if(mode==='mobile'){await tap(278,132);await tap(320,300)}else{await key('ArrowDown');await key('ArrowRight');for(let i=0;i<10;i++)await key('ArrowDown');await key('Enter')}
  await page.waitForFunction(stage=>{const r=JSON.parse(localStorage.getItem('sake-kuma-run-v1'));return r.startStage===stage&&r.lastCleared===0&&r.growth.branches.length===2},stage,{timeout:12000})
  const run=await state();assert.equal(run.growth.branches[0].heroes.boy.earned,5);assert.equal(run.growth.branches[1].heroes.boy.earned,5);assert.equal(run.eligible,stage===6);assert.equal(run.mode,'2p');report.checks.push(`Injected map s${stage}: warning/cancel preserves snapshot; actual ${stage===1?'old source':'no-carry source'} selection and allocation; ranking and mode preserved`)
  await context.close()
 }
 assert.deepEqual(report.errors,[]);report.passed=true;console.log('PASS',mode,JSON.stringify(report.checks,null,2))
}catch(e){report.error=e.stack??String(e);console.error('FAIL',mode,report.error);await screen('failure').catch(()=>{})}
finally{fs.writeFileSync(`${out}/${mode}.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
if(!report.passed)process.exitCode=1
