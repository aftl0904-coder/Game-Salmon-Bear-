import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const base=process.env.QA_BASE_URL||'http://127.0.0.1:4777/'
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const reports=[]
for(const mode of ['desktop','mobile']){
 const context=await browser.newContext(mode==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const report={mode,setup:'stage 1 selected via debug scene injection; no enemy/state or velocity injection; input is real keyboard / CDP touch. Not full playthrough or physical device.',errors}
 try{
  await page.goto(base);await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000});await page.waitForTimeout(800)
  await page.evaluate(()=>{const g=window.__SAKE_GAME__;g.registry.set('stageNo',1);g.registry.set('difficulty','normal');g.registry.set('playMode','1p');g.registry.set('soloCast','boy');g.registry.set('stageRound',1);for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('play')})
  await page.waitForTimeout(3500)
  const cdp=mode==='mobile'?await context.newCDPSession(page):null
  const touch=async(type,x,y)=>{const b=await page.locator('canvas').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:b.x+b.width*x/640,y:b.y+b.height*y/360,id:0}]})}
  if(mode==='mobile'){await touch('touchStart',615,14);await touch('touchEnd')}else await page.keyboard.press('Enter')
  await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:15000})
  const state=()=>page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {x:s.boy.x,y:s.boy.y,stageNo:s.stageNo}})
  report.before=await state()
  if(mode==='mobile')await touch('touchStart',92,324);else await page.keyboard.down('d')
  await page.waitForTimeout(1100)
  if(mode==='mobile')await touch('touchEnd');else await page.keyboard.up('d')
  report.after=await state();assert.ok(report.after.x>report.before.x+10,'input moves hero right')
  assert.equal(errors.length,0,'no uncaught page errors')
  await page.screenshot({path:`docs/qa-trailer/smoke-${mode}.png`}); report.passed=true
 }catch(e){report.passed=false;report.error=e.stack;await page.screenshot({path:`docs/qa-trailer/smoke-${mode}-failure.png`}).catch(()=>{})}
 console.log(JSON.stringify(report,null,2));reports.push(report);await context.close()
}
await browser.close();fs.writeFileSync('docs/qa-trailer/smoke-results.json',JSON.stringify(reports,null,2)+'\n');if(reports.some(r=>!r.passed))process.exitCode=1
