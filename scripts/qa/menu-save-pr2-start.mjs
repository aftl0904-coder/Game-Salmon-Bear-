// Isolated browser contexts and injected map/checkpoint states; no full playthrough.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const BASE=process.env.QA_BASE_URL??'http://127.0.0.1:47322/'
const OUT=process.env.QA_OUT??'docs/qa-menu-save-pr2'
const MODE=process.env.QA_MODE??'mobile'
fs.mkdirSync(OUT,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const errors=[],report={mode:MODE,checks:[],errors,passed:false}
async function setup(){
 const context=await browser.newContext(MODE==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
 await page.goto(BASE+'?c2=1');await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000});await page.waitForTimeout(1400)
 return {page,context}
}
async function tap(page,x,y){const b=await page.locator('canvas').boundingBox();assert.ok(b);await page.touchscreen.tap(b.x+b.width*x/640,b.y+b.height*y/360);await page.waitForTimeout(300)}
async function launch(page,scene,data,progress){
 await page.evaluate(async({scene,data,progress})=>{
  const game=window.__SAKE_GAME__,r=await import('/src/game/run.ts')
  game.registry.set('playMode','1p');game.registry.set('soloCast','boy')
  if(progress){r.startNewRun(1,false,'1p','boy',game.registry);for(let i=1;i<=2;i++)r.saveClear(i,{coins:10,purse:{boy:10},hp:{boy:3},friends:[]})}
  for(const s of game.scene.getScenes(true))game.scene.stop(s.scene.key)
  game.scene.start(scene,data)
 },{scene,data,progress})
 await page.waitForFunction(scene=>window.__SAKE_GAME__?.scene.isActive(scene),scene,{timeout:15000});await page.waitForTimeout(850)
}
async function selectMain(page,stage){if(MODE==='mobile')await tap(page,stage===1?258:382,143);else await page.keyboard.press(stage===1?'1':'2')}
async function confirmMain(page){if(MODE==='mobile')await tap(page,320,334);else await page.keyboard.press('Enter')}
async function selectMap(page,stage){if(MODE==='mobile')await tap(page,stage===1?150:187.5,stage===1?221:191);else{await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter')}}
async function dialog(page,scene){return page.evaluate(scene=>{const d=window.__SAKE_GAME__.scene.getScene(scene).startDialog;return d&&{selected:d.selected??d.index,labels:d.choices?d.choices.map(x=>x.label.text):d.labels.map(x=>x.text),texts:d.root.list.filter(x=>typeof x.text==='string').map(x=>x.text)}},scene)}
try{
 for(const stage of [1,6]){
  const {page,context}=await setup();await launch(page,'menu',undefined,false);await selectMain(page,stage);await confirmMain(page)
  await page.waitForFunction(stage=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('menu');return !s.startDialog&&(stage===1?g.scene.isActive('gacha'):g.scene.isActive('worldmap'))},stage,{timeout:15000})
  const run=await page.evaluate(()=>JSON.parse(localStorage.getItem('sake-kuma-run-v1')))
  assert.equal(run.startStage,stage);assert.equal(run.eligible,true);assert.equal(run.gear.boy.gun,0)
  report.checks.push(`fresh menu stage ${stage} starts baseline directly`);await context.close()
 }
 for(const stage of [1,6]){
  const {page,context}=await setup();const to=stage===1?2:7
  await launch(page,'worldmap',{from:to,to,next:'play',pick:true,stageNo:to},false)
  await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('worldmap').picking)
  await selectMap(page,stage)
  await page.waitForFunction(stage=>{const g=window.__SAKE_GAME__,s=g.scene.getScene('worldmap');return !s.startDialog&&(stage===1?g.scene.isActive('gacha'):!s.picking)},stage,{timeout:15000})
  const run=await page.evaluate(()=>JSON.parse(localStorage.getItem('sake-kuma-run-v1')))
  assert.equal(run.startStage,stage);assert.equal(run.eligible,true)
  report.checks.push(`fresh map stage ${stage} starts baseline directly`);await context.close()
 }
 for(const [scene,stage] of [['menu',1],['menu',6],['worldmap',6]]){
  const {page,context}=await setup();const to=stage===1?2:7
  await launch(page,scene,scene==='worldmap'?{from:to,to,next:'play',pick:true,stageNo:to}:undefined,true)
  const before=await page.evaluate(()=>localStorage.getItem('sake-kuma-run-v1'))
  if(scene==='menu'){await selectMain(page,stage);await confirmMain(page)}else await selectMap(page,stage)
  await page.waitForFunction(scene=>!!window.__SAKE_GAME__.scene.getScene(scene).startDialog,scene)
  const d=await dialog(page,scene)
  assert.equal(d.labels[d.selected],'取消');assert.ok(d.texts.includes('會取代目前本局（已打到第2關）'))
  await page.screenshot({path:`${OUT}/${MODE}-${scene}-warning-s${stage}.png`,scale:'css'})
  if(MODE==='mobile')await tap(page,320,scene==='menu'?202:207);else{await page.waitForTimeout(350);await page.keyboard.press('Enter')}
  await page.waitForFunction(scene=>!window.__SAKE_GAME__.scene.getScene(scene).startDialog,scene)
  assert.equal(await page.evaluate(()=>localStorage.getItem('sake-kuma-run-v1')),before,'cancel cannot replace run')
  report.checks.push(`${scene} stage ${stage}: warning visible, cancel default and preserves save`);await context.close()
 }
 assert.deepEqual(errors,[]);report.passed=true;console.log(`PASS ${MODE} start`,JSON.stringify(report.checks))
}catch(e){report.error=e.stack??String(e);console.error(report.error)}
finally{fs.writeFileSync(`${OUT}/${MODE}-start.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
if(!report.passed)process.exitCode=1
