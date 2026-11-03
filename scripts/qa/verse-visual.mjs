// Start the real world-map scene with injected stage state; operate it with
// mobile touch or desktop keyboard, then inspect the visible Phaser text.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const OUT=process.env.QA_OUT??'docs/qa-verse', BASE=process.env.QA_BASE_URL??'http://127.0.0.1:47315/'
const MODE=process.env.QA_MODE??'mobile'
assert.ok(['mobile','desktop'].includes(MODE))
fs.mkdirSync(OUT,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const ctx=await browser.newContext(MODE==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
const page=await ctx.newPage(), errors=[], report={mode:MODE, cases:[], errors}
page.on('pageerror',e=>errors.push(e.message))
const tap=async(x,y)=>{const box=await page.locator('canvas').boundingBox();assert.ok(box);await page.touchscreen.tap(box.x+box.width*x/640,box.y+box.height*y/360)}
try {
  await page.goto(BASE);await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000});await page.waitForTimeout(800)
  const startMap=async(data)=>{await page.evaluate(data=>{const g=window.__SAKE_GAME__;for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('worldmap',data)},data);await page.waitForFunction(()=>window.__SAKE_GAME__.scene.isActive('worldmap'));await page.waitForTimeout(550)}
  const checkLines=(text,ref)=>{const [body]=text.split(`\n— ${ref}`);const lines=body.split('\n');assert.ok(lines.length>0);for(const line of lines.slice(0,-1))assert.match(line,/[，。！？；：、,.!?;:]$/u);return lines}
  await startMap({from:2,to:3,next:'play',pick:true})
  let s=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('worldmap');return{text:s.verseText.text,width:s.verseText.displayWidth,picking:s.picking}})
  assert.ok(s.picking);assert.ok(s.width<=360);checkLines(s.text,'哥林多前書 13:12')
  await page.screenshot({path:`${OUT}/${MODE}-map-stage3.png`,scale:'css'})
  if(MODE==='mobile')await tap(235,117);else await page.keyboard.press('ArrowLeft')
  await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('worldmap').verseText.text.includes('箴言 24:13'),null,{timeout:5000})
  s=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('worldmap');return{text:s.verseText.text,width:s.verseText.displayWidth}})
  assert.ok(s.width<=360);checkLines(s.text,'箴言 24:13');report.cases.push({screen:'map',startStage:3,selectedStage:2,...s})
  await startMap({from:5,to:6,next:'play'})
  s=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('worldmap');const t=s.children.list.find(x=>typeof x.text==='string'&&x.text.includes('加拉太書 5:1'));return t&&{text:t.text,width:t.displayWidth,height:t.displayHeight}})
  assert.ok(s,'stage 6 verse text is present');assert.ok(s.width<=560);assert.ok(s.text.includes('站立得穩'));checkLines(s.text,'加拉太書 5:1')
  await page.screenshot({path:`${OUT}/${MODE}-stage6-card.png`,scale:'css'})
  report.cases.push({screen:'stage6-card',...s})
  if(MODE==='mobile')await tap(320,180);else await page.keyboard.press('Enter')
  await page.waitForFunction(()=>window.__SAKE_GAME__.scene.isActive('play'),null,{timeout:10000})
  assert.deepEqual(errors,[]);report.passed=true;console.log('PASS',JSON.stringify(report))
}catch(e){report.passed=false;report.error=e.stack??String(e);console.error(report.error);await page.screenshot({path:`${OUT}/${MODE}-failure.png`,scale:'css'}).catch(()=>{})}
finally{fs.writeFileSync(`${OUT}/${MODE}.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
if(!report.passed)process.exitCode=1
