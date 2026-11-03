// Actual 2P regression. Setup injects the stage and initial positions only;
// subsequent movement uses desktop keys or phone touch. Phone touch controls P1
// only; P2 stays present but idle (no false claim of mobile P2 touch support).
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const OUT=process.env.QA_OUT??'docs/qa-2p-landing'
const BASE=process.env.QA_BASE_URL??'http://127.0.0.1:47316/'
const MODE=process.env.QA_MODE??'desktop'
assert.ok(['desktop','mobile'].includes(MODE))
fs.mkdirSync(OUT,{recursive:true})
const all=[
  {stage:1,x:1040,height:56,kind:'platform',boyOffset:12,girlOffset:32},
  {stage:2,x:1100,height:24,kind:'step',boyOffset:25,girlOffset:60},
  {stage:3,x:820,height:16,kind:'step',boyOffset:20,girlOffset:60},
  {stage:4,x:3690,height:54,kind:'platform',boyOffset:18,girlOffset:55},
  {stage:5,x:1780,height:32,kind:'step',boyOffset:20,girlOffset:60},
]
const cases=process.env.QA_STAGE?all.filter(c=>c.stage===Number(process.env.QA_STAGE)):all
assert.ok(cases.length,'at least one stage selected')
const report={mode:MODE,setup:'2p; stage and initial positions injected; enemies and boss isolated',inputs:MODE==='desktop'?'P1 keyboard + P2 keyboard':'P1 touch only; P2 present and idle',cases:[],errors:[]}
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
try {
  for(const c of cases) {
    const context=await browser.newContext(MODE==='mobile'?{...devices['Pixel 7 landscape']}:{viewport:{width:1280,height:720}})
    const page=await context.newPage()
    page.on('pageerror',e=>report.errors.push({stage:c.stage,message:e.message}))
    const cdp=MODE==='mobile'?await context.newCDPSession(page):null
    const touch=async(type,coords=[])=>{
      const box=await page.locator('canvas').boundingBox();assert.ok(box,'canvas visible')
      await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:coords.map(([x,y],id)=>({x:box.x+box.width*x/640,y:box.y+box.height*y/360,id}))})
    }
    const tap=async(x,y)=>{await touch('touchStart',[[x,y]]);await touch('touchEnd')}
    const state=()=>page.evaluate(()=>{
      const s=window.__SAKE_GAME__.scene.getScene('play')
      const out=h=>({x:h.x,y:h.y,vx:h.body.velocity.x,vy:h.body.velocity.y,bodyBottom:h.body.bottom,jumping:h.laneJumping})
      return {mode:s.mode,boy:out(s.boy),girl:out(s.girl)}
    })
    try {
      await page.goto(BASE)
      await page.waitForFunction(()=>window.__SAKE_GAME__?.scene.isActive('logo'),null,{timeout:30000})
      await page.waitForTimeout(800)
      await page.evaluate(stage=>{
        const g=window.__SAKE_GAME__
        g.registry.set('stageNo',stage);g.registry.set('difficulty','normal');g.registry.set('playMode','2p');g.registry.set('stageRound',1)
        for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key)
        g.scene.start('play')
      },c.stage)
      await page.waitForTimeout(3500)
      if(MODE==='mobile')await tap(615,14);else await page.keyboard.press('Enter')
      await page.waitForFunction(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&!s.storyIntro&&s.mode==='2p'&&!!s.girl},null,{timeout:15000})
      const floor=await page.evaluate(()=>window.__SAKE_TERRAIN__.terrainSolids().find(s=>s.kind==='ground').top)
      const target=await page.evaluate(({x,kind})=>window.__SAKE_TERRAIN__.terrainSolids().find(s=>s.kind===kind&&s.x0===x),c)
      assert.ok(target&&target.top===floor-c.height,`stage ${c.stage}: upper surface exists`)
      await page.evaluate(({c,floor})=>{
        const s=window.__SAKE_GAME__.scene.getScene('play')
        s.coffeeDone=true;s.lastCheckpointX=10000;s.s2Pending=[]
        if(c.stage===4){s.bossOn=true;s.bossFight=true;if(s.s4world?.bus)s.s4world.bus.state='done'}
        for(const e of [...s.enemies.getChildren()]){e.disableBody?.(true,true);e.destroy()}
        window.__twoP={}
        for(const [id,h,offset] of [['boy',s.boy,c.boyOffset],['girl',s.girl,c.girlOffset]]){
          h.setPosition(c.x+offset,floor-c.height);h.body.reset(h.x,h.y)
          h.laneJumping=false;h.jumpConsumed=false;h.prevFeetY=h.y;h.hp=99;h.graceUntil=s.time.now+60000
          const original=h.resolveLaneJumpLanding.bind(h)
          const trace=window.__twoP[id]={peak:h.y,landings:[]}
          h.resolveLaneJumpLanding=body=>{
            trace.peak=Math.min(trace.peak,h.y)
            const prior={y:h.y,vx:body.velocity.x,jumping:h.laneJumping}
            original(body)
            if(prior.jumping&&!h.laneJumping)trace.landings.push({prior,y:h.y,vx:body.velocity.x,bodyBottom:body.bottom,at:performance.now()})
          }
        }
        const center=c.x+(c.boyOffset+c.girlOffset)/2
        s.camTarget?.setPosition(center,180);s.cameras.main.centerOn(center,180)
      },{c,floor})
      await page.waitForTimeout(500)
      const start=await state()
      for(const id of ['boy','girl'])assert.ok(Math.abs(start[id].y-target.top)<3,`stage ${c.stage}: ${id} starts on platform`)
      if(MODE==='mobile')await touch('touchStart',[[584,320]])
      else {await page.keyboard.down('g');await page.keyboard.down('.')}
      const active=MODE==='desktop'?['boy','girl']:['boy']
      await page.waitForFunction(({top,active})=>active.every(id=>window.__twoP[id].landings.some(v=>Math.abs(v.y-top)<2)),{top:target.top,active},{timeout:10000,polling:30})
      if(MODE==='mobile')await touch('touchEnd');else {await page.keyboard.up('g');await page.keyboard.up('.')}
      await page.waitForTimeout(200)
      const upper=await state(),afterJump=await page.evaluate(()=>window.__twoP)
      for(const id of active){
        const t=afterJump[id],land=t.landings.find(v=>Math.abs(v.y-target.top)<2)
        assert.ok(target.top-t.peak>10,`stage ${c.stage}: ${id} genuinely jumped`)
        assert.ok(Math.abs(upper[id].y-target.top)<3&&!upper[id].jumping,`stage ${c.stage}: ${id} remains on platform`)
        assert.ok(Math.abs(land.bodyBottom-(land.y-2))<4,`stage ${c.stage}: ${id} body aligned in upper landing frame`)
        assert.ok(Math.abs(upper[id].bodyBottom-(upper[id].y-2))<4,`stage ${c.stage}: ${id} body remains aligned`)
      }
      if(MODE==='mobile')assert.ok(Math.abs(upper.girl.x-start.girl.x)<3&&Math.abs(upper.girl.y-start.girl.y)<3&&!upper.girl.jumping,'P2 remains idle during P1 touch jump')
      if(MODE==='mobile')await touch('touchStart',[[12,324]])
      else {await page.keyboard.down('a');await page.keyboard.down('ArrowLeft')}
      await page.waitForFunction(({floor,active})=>active.every(id=>window.__twoP[id].landings.some(v=>Math.abs(v.y-floor)<2)),{floor,active},{timeout:10000,polling:30})
      if(MODE==='mobile')await touch('touchEnd');else {await page.keyboard.up('a');await page.keyboard.up('ArrowLeft')}
      await page.waitForTimeout(180)
      const lower=await state(),traces=await page.evaluate(()=>window.__twoP)
      for(const id of active){
        const land=traces[id].landings.find(v=>Math.abs(v.y-floor)<2)
        assert.ok(Math.abs(lower[id].y-floor)<3&&!lower[id].jumping,`stage ${c.stage}: ${id} lands on lower floor`)
        assert.ok(Math.abs(land.bodyBottom-(land.y-2))<4,`stage ${c.stage}: ${id} body aligned in lower landing frame`)
        assert.ok(Math.abs(lower[id].bodyBottom-(lower[id].y-2))<4,`stage ${c.stage}: ${id} body remains aligned after descent`)
        assert.ok(land.prior.vx< -10&&Math.abs(land.vx-land.prior.vx)<0.01,`stage ${c.stage}: ${id} horizontal speed preserved`)
      }
      if(MODE==='mobile')assert.ok(Math.abs(lower.girl.x-start.girl.x)<3&&Math.abs(lower.girl.y-start.girl.y)<3,'P2 remains idle during P1 touch movement')
      await page.screenshot({path:`${OUT}/${MODE}-stage${c.stage}.png`,scale:'css'})
      const result={stage:c.stage,kind:c.kind,start,upper,lower,traces,passed:true}
      report.cases.push(result);console.log('PASS',MODE,JSON.stringify(result))
    }catch(e){
      const diagnostic=await state().catch(()=>null)
      const traces=await page.evaluate(()=>window.__twoP).catch(()=>null)
      report.cases.push({stage:c.stage,passed:false,error:e.stack??String(e),diagnostic,traces})
      await page.screenshot({path:`${OUT}/${MODE}-stage${c.stage}-failure.png`,scale:'css'}).catch(()=>{})
      console.error('FAIL',MODE,c.stage,e.stack??String(e),JSON.stringify(diagnostic))
    }finally{await context.close()}
  }
}finally{
  report.passed=report.cases.length===cases.length&&report.cases.every(c=>c.passed)&&!report.errors.length
  fs.writeFileSync(`${OUT}/${MODE}.json`,JSON.stringify(report,null,2)+'\n')
  await browser.close()
}
if(!report.passed)process.exitCode=1
