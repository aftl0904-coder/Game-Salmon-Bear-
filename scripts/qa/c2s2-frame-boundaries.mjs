// Baseline only. Full Boot, then direct stage/mode/phase/position injection; NOT a playthrough.
// One browser at a time. Mobile uses touchscreen only for UI, but mode/stage/boss/positions are injected.
// Records Phaser render callbacks, not actual display scanout/presentation; no proof of physical visibility.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import assert from 'node:assert/strict'
const label=process.env.RUN_LABEL || 'boundary-baseline'
const file=`docs/qa-c2s2/${label}.json`
if(fs.existsSync(file))throw Error(`refusing to overwrite ${file}`)
const report={label,description:'Full Boot then injected stage/mode/boss phase/position and isolated enemies. Touch-only mobile UI; not natural play, a real phone, or display scanout measurement. Hidden is a real Chromium tab switch if observed; scene pause is synthetic.',environment:{timestamp:new Date().toISOString(),loadavg:os.loadavg(),cpus:os.availableParallelism(),node:process.version},runs:[],passed:false}
const gear={heart:0,sword:0,gun:0,armour:0,boots:0,charm:0}
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
try {
 for(const [mobile,mode] of [[false,'1p'],[false,'2p'],[true,'1p'],[true,'2p']]){
  if(process.env.QA_ONLY && process.env.QA_ONLY!==`${mobile?'mobile':'desktop'}-${mode}`)continue
  const kind=`${mobile?'mobile':'desktop'}-${mode}`
  const ctx=await browser.newContext(mobile?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
  await ctx.addInitScript(({gear,mode})=>{localStorage.setItem('sake-kuma-progress-v1',JSON.stringify({maxStage:7}));localStorage.setItem('sake-kuma-run-v1',JSON.stringify({version:1,runId:'qa-boundary',startStage:6,lastCleared:6,nextStage:7,gear:{boy:gear,girl:gear},growth:{},eligible:true,coins:100,purse:{boy:50,girl:50},hp:{boy:5,girl:5},friends:[],charm:null,mode,solo:'boy',puffLeft:false}))},{gear,mode})
  const p=await ctx.newPage(), run={kind,entry:'injected stage/mode after Boot',cases:[],errors:[],passed:false};report.runs.push(run)
  p.on('pageerror',e=>run.errors.push('pageerror: '+e.stack));p.on('console',m=>{if(m.type()==='error')run.errors.push('console: '+m.text())})
  const tap=async(x,y)=>{const b=await p.locator('canvas').boundingBox();assert.ok(b);await p.touchscreen.tap(b.x+b.width*x/640,b.y+b.height*y/360);await p.waitForTimeout(250)}
  const skip=async()=>{if(mobile)await tap(320,180);else{await p.keyboard.press('Enter');await p.waitForTimeout(250)}}
  try{
   await p.goto('http://127.0.0.1:47429/')
   if(mobile){await p.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:35000});await p.waitForTimeout(700);await tap(242,330);await p.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('difficulty'),null,{timeout:15000});await p.waitForTimeout(500);await tap(320,190)}
   else for(let i=0;i<24;i++){if(await p.evaluate(()=>window.__SAKE_GAME__?.scene.isActive('menu')))break;await skip();await p.waitForTimeout(400)}
   await p.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('menu'),null,{timeout:30000})
   await p.evaluate(mode=>{const g=window.__SAKE_GAME__;g.registry.set('stageNo',7);g.registry.set('playMode',mode);g.scene.stop('menu');g.scene.start('play')},mode)
   await p.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('play'),null,{timeout:20000})
   for(let i=0;i<25;i++){if(await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro}))break;await skip();await p.waitForTimeout(300)}
   await p.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro},null,{timeout:20000})
   assert.deepEqual(await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return [s.stageNo,s.mode]}),[7,mode])
   await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');s.coffeeDone=true;s.s2Pending=[];for(const e of s.enemies.getChildren())e.setActive(false);for(const h of [s.boy,s.girl])if(h){h.setPosition(4700,285);h.body.reset(4700,285);h.setVelocity(0,0)}s.startQueenFight()})
   for(let i=0;i<25;i++){if(await p.evaluate(()=>!!window.__SAKE_GAME__.scene.getScene('play').queen))break;await skip();await p.waitForTimeout(300)}
   await p.waitForFunction(()=>!!window.__SAKE_GAME__.scene.getScene('play').queen,null,{timeout:25000})
   await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');for(const e of s.enemies.getChildren())e.setActive(false)})
   await p.waitForTimeout(3000)
   for(const variant of ['normal','pause-warning','hidden-active']){
    const test={variant};run.cases.push(test)
    await p.evaluate(({variant})=>{
     const g=window.__SAKE_GAME__,s=g.scene.getScene('play')
     for(const e of s.enemies.getChildren())e.setActive(false)
     for(const o of [...s.enemyShots.getChildren()])o.destroy()
     s.queen.hp=35;s.queen.updatePhase()
     for(const [h,x] of [[s.boy,5000],[s.girl,4800]])if(h){h.setPosition(x,285);h.body.reset(x,285);h.hp=6;h.grace=0;h.graceUntil=0;h.hurtCd=0;h.setVelocity(0,0)}
     s.cameras.main.centerOn(4900,180)
     const t=window.__boundary={variant,frames:[],events:[],renders:[],hits:[],states:[],startHp:{boy:s.boy.hp,girl:s.girl?.hp??null},actualPhase:s.queen.qphase,settings:{smoothStep:g.loop.smoothStep,minFps:g.loop.minFps}}
     const oldPush=s.stage7Events.push.bind(s.stage7Events),oldHit=s.hitByFishBullet.bind(s)
     let warning,net,shot
     s.stage7Events.push=function(...items){for(const e of items)if(e.kind.startsWith('chain-')){
      if(e.kind==='chain-warn')warning=s.children.list.filter(o=>o.type==='Rectangle').at(-1)
      if(e.kind==='chain-active'){net=s.children.list.filter(o=>o.type==='Graphics').at(-1);shot=s.enemyShots.getChildren().find(o=>o.getData('persistentNet'))}
      t.events.push({kind:e.kind,scene:e.at,perf:performance.now(),frame:g.loop.frame,hp:s.boy.hp})
     }return oldPush(...items)}
     s.hitByFishBullet=function(h,sh){if(sh.getData('persistentNet')){const before=h.hp;oldHit(h,sh);t.hits.push({perf:performance.now(),frame:g.loop.frame,before,after:h.hp,hero:h===s.boy?'boy':'girl',renderedActive:t.renders.some(r=>r.net)})}else oldHit(h,sh)}
     const pre=(time,delta)=>t.frames.push({point:'pre',scene:time,perf:performance.now(),delta,raw:g.loop.rawDelta,frame:g.loop.frame,paused:s.physics.world.isPaused,hp:s.boy.hp,hidden:document.hidden})
     const post=(time,delta)=>t.frames.push({point:'post',scene:time,perf:performance.now(),delta,raw:g.loop.rawDelta,frame:g.loop.frame,paused:s.physics.world.isPaused,hp:s.boy.hp,hidden:document.hidden,warning:!!warning?.active,net:!!net?.active,shot:!!shot?.active})
     const render=()=>t.renders.push({perf:performance.now(),frame:g.loop.frame,warning:!!(warning?.active&&warning.visible),net:!!(net?.active&&net.visible),shot:!!shot?.active,camX:s.cameras.main.scrollX,hp:s.boy.hp,hidden:document.hidden})
     const state=(name)=>t.states.push({name,perf:performance.now(),frame:g.loop.frame,hidden:document.hidden,hp:s.boy.hp})
     const vis=()=>state('visibilitychange'),pa=()=>state('scene-pause'),re=()=>state('scene-resume')
     document.addEventListener('visibilitychange',vis);s.events.on('pause',pa);s.events.on('resume',re);s.events.on('preupdate',pre);s.events.on('postupdate',post);s.events.on('render',render)
     s.events.once('postupdate',()=>{s.trainerChain(4640,5280);if(variant==='pause-warning')setTimeout(()=>{state('pause-request');s.scene.pause();setTimeout(()=>{state('resume-request');s.scene.resume()},1000)},250)})
     t.cleanup=()=>{s.stage7Events.push=oldPush;s.hitByFishBullet=oldHit;s.events.off('preupdate',pre);s.events.off('postupdate',post);s.events.off('render',render);s.events.off('pause',pa);s.events.off('resume',re);document.removeEventListener('visibilitychange',vis)}
    },{variant})
    await p.waitForFunction(()=>window.__boundary?.events.some(e=>e.kind==='chain-warn'),null,{timeout:15000})
    if(variant==='normal'){await p.screenshot({path:`docs/qa-c2s2/${label}-${kind}-warning.png`}).catch(()=>{})}
    if(variant==='hidden-active'){
      await p.waitForFunction(()=>window.__boundary?.events.some(e=>e.kind==='chain-active'),null,{timeout:15000})
      const other=await ctx.newPage();await other.goto('about:blank');await other.bringToFront();await other.waitForTimeout(1100);await p.bringToFront();await other.close()
    }
    await p.waitForFunction(()=>window.__boundary?.events.some(e=>e.kind==='chain-end'),null,{timeout:20000})
    test.trace=await p.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),t=window.__boundary;t.endHp={boy:s.boy.hp,girl:s.girl?.hp??null};t.endPosition={boy:s.boy.x,girl:s.girl?.x??null};t.cleanup();delete t.cleanup;return t})
    const t=test.trace,e=t.events;assert.equal(t.actualPhase,2);assert.deepEqual(e.map(x=>x.kind),['chain-warn','chain-active','chain-end'])
    const wr=t.renders.find(r=>r.warning), ar=t.renders.find(r=>r.net), last=t.renders.filter(r=>r.net).at(-1), end=t.renders.find(r=>r.frame>=e[2].frame&&!r.net)
    test.summary={wallEventMs:[e[1].perf-e[0].perf,e[2].perf-e[1].perf],sceneMs:[e[1].scene-e[0].scene,e[2].scene-e[1].scene],firstWarningRender:wr,firstActiveRender:ar,lastActiveRender:last,firstEndRender:end,hits:t.hits,startHp:t.startHp,endHp:t.endHp,visibilityEvents:t.states,maxRaw:Math.max(...t.frames.map(x=>x.raw))}
    test.hitPass=t.endHp.boy<t.startHp.boy;test.safePass=mode==='2p'?t.endHp.girl===t.startHp.girl:null
    test.invisibleFirstHit=t.hits.some(h=>h.after<h.before&&!h.renderedActive)
    test.oldStrictPass=test.summary.sceneMs[0]>=790&&test.summary.sceneMs[0]<=900&&test.summary.sceneMs[1]>=1490&&test.summary.sceneMs[1]<=1600
    test.hiddenObserved=variant==='hidden-active'?t.states.some(x=>x.name==='visibilitychange'&&x.hidden):null
    console.log(JSON.stringify({kind,variant,summary:test.summary,oldStrictPass:test.oldStrictPass,invisibleFirstHit:test.invisibleFirstHit,safePass:test.safePass}))
    await p.waitForTimeout(300)
   }
   // A pause contains deliberate non-game time, so the old continuous-time bounds do not apply.
   // Merely opening a tab is not a valid background test unless a hidden event was observed.
   run.passed=run.cases.length===3 && run.cases.every(c=>c.hitPass&&(c.safePass??true)&&!c.invisibleFirstHit&&(c.variant!=='normal'||c.oldStrictPass)&&(c.variant!=='hidden-active'||c.hiddenObserved))&&!run.errors.length
  }catch(e){run.failure=e.stack||String(e);console.error(kind,run.failure);await p.screenshot({path:`docs/qa-c2s2/${label}-${kind}-failure.png`,timeout:4000}).catch(()=>{})}
  await ctx.close()
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n')
 }
 report.passed=report.runs.length===(process.env.QA_ONLY?1:4)&&report.runs.every(r=>r.passed)
}catch(e){report.fatal=e.stack||String(e)}finally{fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({file,passed:report.passed}));await browser.close()}
if(!report.passed)process.exitCode=1
