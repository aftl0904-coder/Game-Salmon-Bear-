// Based on scripts/qa/mobile.mjs: real CDP touch (or desktop keyboard).
// Stage/starting position and enemy isolation are injected for repeatability.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const OUT=process.env.QA_OUT??'docs/qa-fan'
const BASE=process.env.QA_BASE_URL??'http://127.0.0.1:47317/'
const MODE=process.env.QA_MODE??'mobile'
assert.ok(['mobile','desktop'].includes(MODE))
fs.mkdirSync(OUT,{recursive:true})
const report={mode:MODE==='mobile'?'Pixel 7 landscape, touch only':'desktop, keyboard only',setup:'stage 2 1P girl, initial position injected; enemies isolated',poses:{},errors:[]}
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const ctx=await browser.newContext(MODE==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message))
const cdp=MODE==='mobile'?await ctx.newCDPSession(page):null
const touch=async(type,points=[])=>{
  const box=await page.locator('canvas').boundingBox();assert.ok(box,'canvas visible')
  await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x:box.x+box.width*x/640,y:box.y+box.height*y/360,id}))})
}
const tap=async(x,y)=>{await touch('touchStart',[[x,y]]);await touch('touchEnd')}
const inputDown=async name=>MODE==='mobile'?touch('touchStart',[name==='right'?[92,324]:[584,320]]):page.keyboard.down(name==='right'?'d':'g')
const inputUp=async name=>MODE==='mobile'?touch('touchEnd'):page.keyboard.up(name==='right'?'d':'g')
const state=()=>page.evaluate(()=>{
  const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy,cam=s.cameras.main
  const box=document.querySelector('canvas').getBoundingClientRect()
  return {role:h.role,anim:h.lastAnim,frame:h.frame?.name,pose:h.pose,x:h.x,y:h.y,vx:h.body.velocity.x,vy:h.body.velocity.y,bodyBottom:h.body.bottom,jumping:h.laneJumping,floating:h.floating,
    support:window.__SAKE_TERRAIN__.supportTopAt(h.x,h.y,4,10),camera:{scrollX:cam.scrollX,scrollY:cam.scrollY},canvas:{x:box.x,y:box.y,w:box.width,h:box.height},
    screen:{x:box.x+(h.x-cam.scrollX)*box.width/640,y:box.y+(h.y-cam.scrollY)*box.height/360}}
})
const snap=async name=>{
  const before=await state();await page.screenshot({path:`${OUT}/${MODE}-${name}.png`,scale:'css',timeout:12000});const after=await state()
  report.poses[name]={before,after};console.log('SNAP',name,JSON.stringify({before,after}))
}
try{
  console.log('Starting',MODE,BASE)
  await page.goto(BASE)
  await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000});await page.waitForTimeout(800)
  await page.evaluate(()=>{const g=window.__SAKE_GAME__;g.registry.set('stageNo',2);g.registry.set('difficulty','normal');g.registry.set('playMode','1p');g.registry.set('soloCast','girl');g.registry.set('stageRound',1);for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('play')})
  await page.waitForTimeout(3500);if(MODE==='mobile')await tap(615,14);else await page.keyboard.press('Enter')
  await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro&&s.boy.role==='girl'},null,{timeout:15000})
  const floor=await page.evaluate(()=>window.__SAKE_TERRAIN__.terrainSolids().find(s=>s.kind==='ground').top)
  await page.evaluate(floor=>{const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy;s.coffeeDone=true;s.lastCheckpointX=10000;s.s2Pending=[];for(const e of [...s.enemies.getChildren()]){e.disableBody?.(true,true);e.destroy()};h.setPosition(180,floor);h.body.reset(h.x,h.y);h.laneJumping=false;h.prevFeetY=h.y;h.graceUntil=s.time.now+60000;s.camTarget?.setPosition(320,180);s.cameras.main.centerOn(320,180)},floor)
  await page.waitForTimeout(800)
  await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').boy.lastAnim==='idle',null,{timeout:8000})
  const idle=await state();assert.ok(Math.abs(idle.y-floor)<3&&!idle.jumping,'idle is grounded')
  await snap('idle')
  await inputDown('right')
  await page.waitForFunction(()=>{const h=window.__SAKE_GAME__.scene.getScene('play').boy;return h.lastAnim==='run'&&h.body.velocity.x>30},null,{timeout:8000})
  await snap('run');await inputUp('right')
  await page.waitForFunction(()=>{const h=window.__SAKE_GAME__.scene.getScene('play').boy;return !h.laneJumping&&Math.abs(h.body.velocity.x)<2},null,{timeout:10000})
  await inputDown('jump')
  await page.waitForFunction(()=>{const h=window.__SAKE_GAME__.scene.getScene('play').boy;return h.laneJumping&&h.body.velocity.y< -70&&h.lastAnim==='jump'},null,{timeout:8000,polling:20})
  await snap('jump');await inputUp('jump')
  await page.waitForFunction(()=>{const h=window.__SAKE_GAME__.scene.getScene('play').boy;return !h.laneJumping},null,{timeout:10000})
  await page.evaluate(floor=>{const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy;h.setPosition(420,floor);h.body.reset(h.x,h.y);h.laneJumping=false;h.jumpConsumed=false;h.prevFeetY=h.y;s.camTarget?.setPosition(420,180);s.cameras.main.centerOn(420,180)},floor)
  await page.waitForTimeout(250);await inputDown('right')
  await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').boy.floating,null,{timeout:8000});await inputUp('right')
  await page.waitForFunction(()=>{const h=window.__SAKE_GAME__.scene.getScene('play').boy;return h.floating&&h.lastAnim==='fan-float'&&h.body.velocity.y>5&&h.y>165&&h.y<225},null,{timeout:20000,polling:20})
  await snap('glide-actual-fan-float')
  const glide=await state();assert.ok(glide.y<floor-5&&glide.floating,'fan float is airborne')
  assert.equal(report.errors.length,0,'no browser page errors')
  report.passed=true
}catch(e){report.passed=false;report.error=e.stack??String(e);report.last=await state().catch(()=>null);console.error(report.error);await page.screenshot({path:`${OUT}/${MODE}-failure.png`,scale:'css'}).catch(()=>{});process.exitCode=1}
finally{fs.writeFileSync(`${OUT}/${MODE}-poses.json`,JSON.stringify(report,null,2)+'\n');await browser.close()}
