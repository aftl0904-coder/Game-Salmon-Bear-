// Inject stage/positions and isolate threats, then observe actual update/tween and player input.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const mode=process.env.QA_MODE||'desktop',out='docs/qa-c2s2';fs.mkdirSync(out,{recursive:true})
assert.ok(['mobile','desktop'].includes(mode))
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const ctx=await browser.newContext(mode==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
const page=await ctx.newPage(),cdp=mode==='mobile'?await ctx.newCDPSession(page):null,report={mode,description:'Stage, enemy and player positions injected; other enemies removed. Enemy chase/pit-hop uses normal scene updates; player falls use only touch or keyboard. Not a full playthrough.',checks:[],errors:[],passed:false}
page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text())})
const touch=async(type,coords=[])=>{const b=await page.locator('canvas').boundingBox();assert.ok(b);await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:coords.map(([x,y],id)=>({x:b.x+b.width*x/640,y:b.y+b.height*y/360,id}))})}
try{
 await page.goto(process.env.QA_URL||'http://127.0.0.1:47417/?c2=1');await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000});await page.waitForTimeout(800)
 await page.evaluate(()=>{const g=window.__SAKE_GAME__;g.registry.set('stageNo',7);g.registry.set('difficulty','normal');g.registry.set('playMode','1p');g.registry.set('soloCast','boy');g.registry.set('stageRound',1);for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('play')})
 await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:30000})
 await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.coffeeDone=true;s.s2Pending=[];for(const e of [...s.enemies.getChildren()])e.destroy();s.boy.grace=s.time.now+120000})
 for(const p of [{x:2320,w:56},{x:2780,w:64}]){
  const init=await page.evaluate(async p=>{const s=window.__SAKE_GAME__.scene.getScene('play'),{ProductZombie}=await import('/src/game/enemies/ProductZombie.ts');for(const e of [...s.enemies.getChildren()])e.destroy();s.s2Pending=[];const h=s.boy;h.setPosition(p.x+p.w+100,285);h.body.reset(h.x,h.y);h.grace=s.time.now+120000;const e=s.addS2Enemy(new ProductZombie(s,p.x-40,s.s2Hooks()));e.body.reset(e.x,e.y);s.cameras.main.centerOn(p.x+35,180);window.__pitEnemy=e;window.__pitEnemyTrace=[];clearInterval(window.__pitEnemyTimer);window.__pitEnemyTimer=setInterval(()=>window.__pitEnemyTrace.push({x:e.x,y:e.y,leaping:!!e.getData('leaping'),fsm:e.fsm}),25);return {enemyX:e.x,heroX:h.x}},p)
  await page.waitForFunction(()=>window.__pitEnemyTrace.some(t=>t.leaping),null,{timeout:12000,polling:50});await page.screenshot({path:`${out}/pit-${p.x}-${mode}-enemy-hop.png`})
  await page.waitForFunction(p=>window.__pitEnemyTrace.some(t=>t.leaping)&&window.__pitEnemy.x>p.x+p.w&&!window.__pitEnemy.getData('leaping'),p,{timeout:12000,polling:50})
  const trace=await page.evaluate(()=>{clearInterval(window.__pitEnemyTimer);return window.__pitEnemyTrace});assert.ok(trace.some(t=>t.leaping));assert.ok(trace.some(t=>t.x>p.x+p.w&&!t.leaping));report.checks.push({name:'enemy chase hops across pit',pit:p,init,trace})
 }
 for(const p of [{x:2320,w:56},{x:2780,w:64}]){
  await page.evaluate(p=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const e of [...s.enemies.getChildren()])e.destroy();s.s2Pending=[];s.lastCheckpointX=p.x-160;const h=s.boy;h.setPosition(p.x-42,285);h.body.reset(h.x,h.y);h.laneJumping=false;h.jumpConsumed=false;h.prevFeetY=285;h.hp=6;h.grace=0;h.hurtCd=0;s.cameras.main.centerOn(p.x+35,180);window.__pitPlayerTrace=[];clearInterval(window.__pitPlayerTimer);window.__pitPlayerTimer=setInterval(()=>window.__pitPlayerTrace.push({x:h.x,y:h.y,hp:h.hp}),25)},p)
  await page.waitForTimeout(250);if(mode==='mobile')await touch('touchStart',[[92,324]]);else await page.keyboard.down('d')
  await page.waitForFunction(p=>window.__pitPlayerTrace.some(t=>t.x>=p.x&&t.x<=p.x+p.w&&t.y>300),p,{timeout:12000,polling:30})
  if(mode==='mobile')await touch('touchEnd');else await page.keyboard.up('d')
  await page.waitForFunction(p=>window.__pitPlayerTrace.some(t=>t.y>300)&&window.__SAKE_GAME__.scene.getScene('play').boy.x<p.x-35&&window.__SAKE_GAME__.scene.getScene('play').boy.y<=288,p,{timeout:12000,polling:50})
  const trace=await page.evaluate(()=>{clearInterval(window.__pitPlayerTimer);return window.__pitPlayerTrace});report.checks.push({name:'player walks into pit and respawns',pit:p,trace});await page.screenshot({path:`${out}/pit-${p.x}-${mode}-respawn.png`})
 }
 assert.deepEqual(report.errors,[]);report.passed=true
}catch(e){report.failure=e.stack??String(e);console.error(report.failure);await page.screenshot({path:`${out}/pit-${mode}-failure.png`}).catch(()=>{})}
fs.writeFileSync(`${out}/pit-${mode}-current.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.map(x=>x.name),failure:report.failure,errors:report.errors}));await browser.close();if(!report.passed)process.exitCode=1
