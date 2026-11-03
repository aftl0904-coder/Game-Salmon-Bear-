// Stage 6 regression: inject the starting scene/position, then use real input.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const mode=process.env.QA_MODE??'mobile',out=process.env.QA_OUT??'docs/qa-pit-visibility'
const base=process.env.QA_BASE_URL??'http://127.0.0.1:47318/'
assert.ok(['mobile','desktop'].includes(mode));fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const context=await browser.newContext(mode==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
const cdp=mode==='mobile'?await context.newCDPSession(page):null
const touch=async(type,coords=[])=>{const b=await page.locator('canvas').boundingBox();assert.ok(b);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:coords.map(([x,y],id)=>({x:b.x+b.width*x/640,y:b.y+b.height*y/360,id}))})}
let result={mode,setup:'stage and start injected; fall driven only by touch or keyboard'}
try{
 await page.goto(base);await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000});await page.waitForTimeout(800)
 await page.evaluate(()=>{const g=window.__SAKE_GAME__;g.registry.set('stageNo',6);g.registry.set('difficulty','normal');g.registry.set('playMode','1p');g.registry.set('soloCast','boy');g.registry.set('stageRound',1);for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('play')})
 await page.waitForTimeout(3500)
 if(mode==='mobile'){await touch('touchStart',[[615,14]]);await touch('touchEnd')}else await page.keyboard.press('Enter')
 await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:15000})
 await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),h=s.boy;s.coffeeDone=true;s.lastCheckpointX=220;s.s2Pending=[];for(const e of [...s.enemies.getChildren()]){e.disableBody?.(true,true);e.destroy()}h.setPosition(1850,285);h.body.reset(1850,285);h.laneJumping=false;h.jumpConsumed=false;h.prevFeetY=285;h.hp=6;h.graceUntil=0;window.__pitTrace=[];window.__pitTimer=setInterval(()=>window.__pitTrace.push({x:h.x,y:h.y,hp:h.hp}),25)})
 await page.waitForTimeout(200)
 if(mode==='mobile')await touch('touchStart',[[92,324]]);else await page.keyboard.down('d')
 await page.waitForFunction(()=>window.__SAKE_GAME__.scene.getScene('play').boy.x>=1900,null,{timeout:6000,polling:20})
 if(mode==='mobile')await touch('touchEnd');else await page.keyboard.up('d')
 await page.waitForFunction(()=>window.__pitTrace.some(t=>t.y>300),null,{timeout:6000,polling:20})
 await page.waitForFunction(()=>{const h=window.__SAKE_GAME__.scene.getScene('play').boy;return h.x<1870&&h.y<=288},null,{timeout:10000,polling:50})
 const trace=await page.evaluate(()=>{clearInterval(window.__pitTimer);return window.__pitTrace})
 assert.ok(trace.some(t=>t.x>=1885&&t.x<=1932&&t.y>300),'fell inside the true pit')
 assert.equal(errors.length,0)
 result={...result,passed:true,inputs:mode==='mobile'?'touch right':'keyboard D',pit:{x0:1880,x1:1932},trace}
 console.log('PASS stage 6',mode,'real input fell and respawned','maxY',Math.max(...trace.map(t=>t.y)))
 await page.screenshot({path:`${out}/stage6-fall-${mode}.png`,scale:'css'})
}catch(e){result={...result,passed:false,error:e.stack??String(e),errors};console.error('FAIL stage 6',mode,e.stack??e);await page.screenshot({path:`${out}/stage6-fall-${mode}-failure.png`,scale:'css'}).catch(()=>{})}
finally{fs.writeFileSync(`${out}/stage6-fall-${mode}.json`,JSON.stringify(result,null,2)+'\n');await context.close();await browser.close()}
if(!result.passed)process.exitCode=1
