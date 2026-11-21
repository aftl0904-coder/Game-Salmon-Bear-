// Local, sequential short diagnostics. Injected stage-7 boss/positions/phase, not a playthrough.
// Records RAF timestamps, performance.now, Phaser smoothed and raw delta, timer elapsed and HP.
// RUN_LABEL must be unique: never overwrite earlier failed evidence.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import assert from 'node:assert/strict'
const label=process.env.RUN_LABEL || 'diagnostic'
const out=`docs/qa-c2s2/clock-${label}.json`
if(fs.existsSync(out)) throw Error(`refusing to overwrite ${out}`)
const report={label,description:'Injected phase/position, isolated natural threats, real Arcade collision/damage; simulated mobile, not a real phone or playthrough. Synthetic 350ms main-thread stall is diagnostic, not a representative phone benchmark.',environment:{time:new Date().toISOString(),loadavg:os.loadavg(),cpus:os.availableParallelism(),node:process.version},runs:[],errors:[],passed:false}
const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
try {
 for (const mobile of [false,true]) {
  if(process.env.QA_DEVICE && process.env.QA_DEVICE!==(mobile?'mobile':'desktop'))continue
  const ctx=await browser.newContext(mobile?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
  await ctx.addInitScript(({gear,mobile})=>{localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}));localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-clock',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:100,purse:{boy:50,girl:50},hp:{boy:5,girl:5},friends:[],charm:null,mode:mobile?'1p':'2p',solo:'boy',puffLeft:false}))},{gear,mobile})
  const p=await ctx.newPage(), run={device:mobile?'mobile-1p-touch':'desktop-2p-keyboard',cases:[],errors:[]};report.runs.push(run)
  p.on('pageerror',e=>run.errors.push('pageerror: '+e.stack));p.on('console',m=>{if(m.type()==='error')run.errors.push('console: '+m.text())})
  const active=key=>p.waitForFunction(k=>window.__SAKE_GAME__?.scene.isActive(k),key,{timeout:30000})
  const tap=async(x,y)=>{const b=await p.locator('canvas').boundingBox();assert.ok(b);await p.touchscreen.tap(b.x+b.width*x/640,b.y+b.height*y/360);await p.waitForTimeout(350)}
  try {
   await p.goto('http://127.0.0.1:47419/')
   if(mobile){await active('logo');await p.waitForTimeout(900);await tap(242,330);await active('difficulty');await p.waitForTimeout(600);await tap(320,190);await active('menu');await p.waitForTimeout(700);await tap(148,334)}
   else await p.waitForTimeout(4000)
   for(let i=0;i<35;i++){if(await p.evaluate(()=>{const g=window.__SAKE_GAME__,s=g?.scene.getScene('play');return g?.scene.isActive('play')&&s?.started&&!s?.storyIntro}))break;if(mobile)await tap(320,180);else {await p.keyboard.press('Enter');await p.waitForTimeout(600)}}
   await p.waitForFunction(()=>{const g=window.__SAKE_GAME__,s=g?.scene.getScene('play');return g?.scene.isActive('play')&&s?.stageNo===7&&s?.started&&!s?.storyIntro},null,{timeout:30000})
   run.entry=await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {stage:s.stageNo,mode:s.mode,started:s.started}})
   assert.equal(run.entry.mode,mobile?'1p':'2p')
   // Teleport then trigger the real Boss reveal. No invulnerability for subsequent collision tests.
   await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.coffeeDone=true;s.s2Pending=[];for(const e of s.enemies.getChildren())e.setActive(false);for(const h of [s.boy,s.girl])if(h){h.setPosition(4700,285);h.body.reset(4700,285);h.setVelocity(0,0)}s.startQueenFight()})
   for(let i=0;i<25;i++){if(await p.evaluate(()=>!!window.__SAKE_GAME__.scene.getScene('play').queen))break;if(mobile)await tap(320,180);else{await p.keyboard.press('f');await p.keyboard.press('Enter');await p.waitForTimeout(600)}}
   await p.waitForFunction(()=>!!window.__SAKE_GAME__.scene.getScene('play').queen,null,{timeout:30000})
   await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const e of s.enemies.getChildren())e.setActive(false)})
   await p.waitForTimeout(3500) // allow any pre-existing timed attacks to drain
   // Two ordinary trials + two controlled stall trials per device, sequentially.
   for(const [phase,stall] of [[2,false],[2,'warning'],[3,false],[3,'active']]) {
    const test={phase,stall};run.cases.push(test)
    await p.evaluate(({phase,stall,mobile})=>{
     const s=window.__SAKE_GAME__.scene.getScene('play'), g=window.__SAKE_GAME__
     for(const e of s.enemies.getChildren())e.setActive(false)
     for(const o of [...s.enemyShots.getChildren()])o.destroy()
     s.queen.hp=phase===2?35:16;s.queen.updatePhase()
     for(const [h,x] of [[s.boy,5000],[s.girl,4800]])if(h){h.setPosition(x,285);h.body.reset(x,285);h.hp=6;h.grace=0;h.graceUntil=0;h.hurtCd=0;h.setVelocity(0,0)}
     s.cameras.main.centerOn(4900,180)
     const trace=window.__clockTrace={frames:[],events:[],timers:[],stall:[],startHp:{boy:s.boy.hp,girl:s.girl?.hp??null},settings:{smoothStep:g.loop.smoothStep,minFps:g.loop.minFps,targetFps:g.loop.targetFps,clockTimeScale:s.time.timeScale,phase:s.queen.qphase}}
     const oldPush=s.stage7Events.push.bind(s.stage7Events)
     s.stage7Events.push=function(...items){for(const e of items)if(e.kind.startsWith('chain-'))trace.events.push({kind:e.kind,scene:e.at,performance:performance.now(),frame:g.loop.frame});return oldPush(...items)}
     const oldCall=s.time.delayedCall.bind(s.time)
     s.time.delayedCall=function(delay,cb,...rest){
      if(delay!==800 && delay!==1500)return oldCall(delay,cb,...rest)
      const rec={delay,created:{scene:s.time.now,performance:performance.now(),frame:g.loop.frame}};trace.timers.push(rec)
      let timer;timer=oldCall(delay,function(...args){rec.fired={scene:s.time.now,performance:performance.now(),frame:g.loop.frame,elapsed:timer.elapsed};const result=cb.apply(this,args);if(delay===800&&stall==='active')setTimeout(block,250);return result},...rest);rec.timer=timer;return timer
     }
     const block=()=>{const a=performance.now();while(performance.now()-a<350){};trace.stall.push({start:a,end:performance.now()})}
     const monitor=(time,delta)=>{trace.frames.push({scene:time,performance:performance.now(),delta,raw:g.loop.rawDelta,frame:g.loop.frame,timers:trace.timers.map(t=>({delay:t.delay,elapsed:t.timer?.elapsed??null}))})}
     s.events.on('postupdate',monitor)
     s.events.once('postupdate',()=>{trace.returned=s.trainerChain(4640,5280);if(stall==='warning')setTimeout(block,250)})
     trace.cleanup=()=>{s.events.off('postupdate',monitor);s.time.delayedCall=oldCall;s.stage7Events.push=oldPush;for(const t of trace.timers)delete t.timer}
    },{phase,stall,mobile})
    await p.waitForFunction(()=>window.__clockTrace?.events.some(e=>e.kind==='chain-end'),null,{timeout:20000})
    test.trace=await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),t=window.__clockTrace;t.endHp={boy:s.boy.hp,girl:s.girl?.hp??null};t.endPosition={boy:s.boy.x,girl:s.girl?.x??null};t.cleanup();delete t.cleanup;return t})
    assert.equal(test.trace.settings.phase,phase,'actual Boss phase must match labelled phase')
    const e=test.trace.events;assert.deepEqual(e.map(x=>x.kind),['chain-warn','chain-active','chain-end'])
    test.sceneMs=[e[1].scene-e[0].scene,e[2].scene-e[1].scene];test.wallMs=[e[1].performance-e[0].performance,e[2].performance-e[1].performance]
    test.oldStrictPass=test.sceneMs[0]>=790&&test.sceneMs[0]<=900&&test.sceneMs[1]>=1490&&test.sceneMs[1]<=1600
    test.hitPass=test.trace.endHp.boy<test.trace.startHp.boy
    test.safePass=mobile?null:test.trace.endHp.girl===test.trace.startHp.girl
    console.log(JSON.stringify({device:run.device,phase,stall,sceneMs:test.sceneMs,wallMs:test.wallMs,strict:test.oldStrictPass,hit:test.hitPass,safe:test.safePass,maxRaw:Math.max(...test.trace.frames.map(f=>f.raw))}))
    await p.waitForTimeout(400)
   }
   // Mobile safe position: lock warning on boy at x=5000, then inject x=4800 before active.
   if(mobile){
    const safe={phase:3,safeOnly:true};run.cases.push(safe)
    await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const e of s.enemies.getChildren())e.setActive(false);for(const o of [...s.enemyShots.getChildren()])o.destroy();s.queen.hp=16;s.queen.updatePhase();const h=s.boy;h.setPosition(5000,285);h.body.reset(5000,285);h.hp=6;h.grace=0;h.graceUntil=0;h.hurtCd=0;h.setVelocity(0,0);window.__safeStart={hp:h.hp,n:s.stage7Events.length,actualPhase:s.queen.qphase};s.trainerChain(4640,5280);h.setPosition(4800,285);h.body.reset(4800,285);h.setVelocity(0,0)})
    await p.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.stage7Events.slice(window.__safeStart.n).some(e=>e.kind==='chain-end')},null,{timeout:20000})
    safe.result=await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return {start:window.__safeStart,endHp:s.boy.hp,x:s.boy.x,events:s.stage7Events.slice(window.__safeStart.n)}});safe.safePass=safe.result.start.actualPhase===3&&safe.result.endHp===safe.result.start.hp
    console.log(JSON.stringify({device:run.device,safeOnly:true,result:safe.result,safePass:safe.safePass}))
   }
  }catch(e){run.failure=e.stack||String(e);console.error(run.failure)}
  await ctx.close()
 }
 report.passed=report.runs.length===(process.env.QA_DEVICE?1:2)&&report.runs.every(r=>!r.failure&&!r.errors.length&&r.cases.length>0&&r.cases.every(c=>c.safeOnly?c.safePass:c.oldStrictPass&&c.hitPass&&(c.safePass??true)))
}catch(e){report.fatal=e.stack||String(e);console.error(report.fatal)}
finally{fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,passed:report.passed}));await browser.close()}
if(!report.passed)process.exitCode=1
