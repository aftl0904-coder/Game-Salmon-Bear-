// Focused injected-scenario diagnostic; native CDP touch / keyboard only after setup.
// It is not a human, real-device, or full-playthrough test. Existing evidence is never overwritten.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const out = process.env.QA_OUTPUT ?? 'docs/qa-c1-boss/mobile-2p-focused-20261104.json'
assert.ok(!fs.existsSync(out), `Refusing to overwrite existing evidence: ${out}`)
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47327/'
const cases = [
  { id: 'mobile-boy', cast: 'boy', start: [3388], target: [3285], expectedDamage: [0] },
  { id: 'mobile-girl', cast: 'girl', start: [3588], target: [3490], expectedDamage: [0] },
  // P1 uses on-screen touch; the actual game has no separate on-screen P2 pad, so P2 uses keyboard.
  { id: 'mobile-2p', cast: '2p', start: [3388, 3588], target: [3285, 3490], expectedDamage: [0, 0] },
  { id: 'mobile-2p-hit-control', cast: '2p', start: [3340, 3490], target: [3340, 3490], expectedDamage: [1, 0] },
].filter(c => !process.env.QA_FILTER || c.id.includes(process.env.QA_FILTER))
const results = { setup: 'Injected stage 5, boss, phase and initial positions; camera centred as if following the injected duo. No HP, invulnerability, damage or physics manipulation. After setup use real CDP touch and P2 keyboard. Browser emulation; not human, real device or full run.', cases: [], errors: [] }
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  for (const c of cases) {
    const context = await browser.newContext({ ...devices['Pixel 7 landscape'] })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    const cdp = await context.newCDPSession(page)
    let box
    const touch = async (down, x=12, y=324) => cdp.send('Input.dispatchTouchEvent', { type: down ? 'touchStart' : 'touchEnd', touchPoints: down ? [{ x: box.x + box.width*x/640, y: box.y + box.height*y/360, id: 0 }] : [] })
    const keys = c.start.map((x,i) => c.target[i] > x ? (i ? 'ArrowRight' : 'd') : (i ? 'ArrowLeft' : 'a'))
    const moving = c.start.map((x,i) => Math.abs(x-c.target[i]) > 3)
    const releasePromises = []
    await page.exposeFunction('__qaRelease', i => {
      const promise = i === 0 ? touch(false) : page.keyboard.up(keys[i])
      releasePromises.push(promise)
      return promise
    })
    try {
      await page.goto(base)
      await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, {timeout:30000})
      await page.waitForTimeout(700)
      await page.evaluate(c => { const g=window.__SAKE_GAME__; g.registry.set('stageNo',5); g.registry.set('difficulty','normal'); g.registry.set('playMode',c.cast==='2p'?'2p':'1p'); g.registry.set('soloCast',c.cast==='girl'?'girl':'boy'); g.registry.set('stageRound',1); for(const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') },c)
      await page.waitForTimeout(3500)
      box=await page.locator('canvas').boundingBox(); assert.ok(box)
      await touch(true,615,14); await touch(false)
      await page.waitForFunction(() => { const s=window.__SAKE_GAME__.scene.getScene('play'); return s.started&&!s.storyIntro },null,{timeout:20000})
      await page.evaluate(async c => {
        const s=window.__SAKE_GAME__.scene.getScene('play')
        s.s2Pending=[]; s.coffeeDone=true
        for(const e of [...s.enemies.getChildren()]) { e.disableBody?.(true,true); e.destroy() }
        s.bossFight=true
        // Put the camera at the natural shared view before assigning the specified initial positions.
        s.cameras.main.setBounds(3100,0,700,360)
        s.cameras.main.centerOn((c.start[0]+(c.start[1]??c.start[0]))/2,180)
        for(const [i,h] of [s.boy,s.girl].filter(Boolean).entries()) { h.setPosition(c.start[i],285); h.body.reset(c.start[i],285); h.laneJumping=false; h.jumpConsumed=false; h.prevFeetY=285 }
        const hs=()=>[s.boy,s.girl].filter(Boolean)
        const snapshot=()=>({t:+s.time.now.toFixed(1),wall:+performance.now().toFixed(1),h:hs().map(h=>({x:+h.x.toFixed(2),y:+h.y.toFixed(2),hp:h.hp,vx:+h.body.velocity.x.toFixed(2),grace:h.grace,hurtCd:h.hurtCd}))})
        const f=window.__focused={trace:[],events:[],arrivals:Array(c.start.length).fill(null),hits:[],warn:null,firstShots:null,incoming:{},landings:{},requested:Array(c.start.length).fill(false),active:Array(c.start.length).fill(false)}
        const record=(type,i,extra={})=>f.events.push({type,player:i,...snapshot(),...extra})
        const canvas=s.game.canvas
        for(const type of ['pointerdown','pointerup','pointercancel']) canvas.addEventListener(type,e=>{ if(type==='pointerdown') f.active[0]=true; if(type==='pointerup'||type==='pointercancel') f.active[0]=false; record(type,0,{pointerType:e.pointerType}) },true)
        for(const type of ['keydown','keyup']) window.addEventListener(type,e=>{ if(e.key==='ArrowLeft'||e.key==='ArrowRight'){f.active[1]=type==='keydown';record(type,1,{key:e.key})} },true)
        const oldBullet=s.hitByFishBullet.bind(s)
        s.hitByFishBullet=(h,shot)=>{ const row={kind:'projectile',player:hs().indexOf(h),...snapshot(),shot:{x:shot.x,y:shot.y,bodyX:shot.body.center.x,bodyY:shot.body.center.y,mark:shot.getData('triFeatherX')}}; const r=oldBullet(h,shot); row.hpAfter=h.hp; f.hits.push(row); return r }
        const oldHazard=s.hazardHit.bind(s)
        s.hazardHit=(h,opts)=>{ const row={kind:'hazard',player:hs().indexOf(h),...snapshot(),label:opts?.label}; const r=oldHazard(h,opts);row.hpAfter=h.hp;f.hits.push(row);return r }
        const oldEnemy=s.hurtHero.bind(s)
        s.hurtHero=(h,e)=>{ const row={kind:'enemy-contact',player:hs().indexOf(h),...snapshot(),species:e.species};const r=oldEnemy(h,e);row.hpAfter=h.hp;f.hits.push(row);return r }
        const {TriBoss}=await import('/src/game/enemies/Stage5Enemies.ts')
        const q=new TriBoss(s,3650,3100,3800,s.triHooks()); s.addS2Enemy(q);s.queen=q;q.qphase=2;q.act='proj2';q.t=0
        s.events.on('postupdate',()=>{
          const heroes=hs(), shadows=s.children.list.filter(o=>o.getData?.('triFeatherShadowX')!==undefined).map(o=>o.getData('triFeatherShadowX'))
          const shots=s.enemyShots.getChildren().filter(o=>o.getData?.('triFeatherX')!==undefined)
          if(!f.warn && shadows.length) f.warn={...snapshot(),xs:shadows,cam:{scrollX:s.cameras.main.scrollX,width:s.cameras.main.displayWidth}}
          if(!f.firstShots && shots.length) f.firstShots={...snapshot(),shots:shots.map(o=>({x:o.x,y:o.y,bodyX:o.body.center.x,bodyW:o.body.width,mark:o.getData('triFeatherX')}))}
          for(const o of shots){const mark=o.getData('triFeatherX'), sample={...snapshot(),shot:{x:o.x,y:o.y,bodyX:o.body.center.x,bodyY:o.body.center.y,mark}};if(o.y>=200&&o.y<260)f.incoming[mark]=sample;if(o.y>=260)f.landings[mark]=sample}
          if(!f.warn)return
          const sample=snapshot();f.trace.push(sample)
          heroes.forEach((h,i)=>{
            if(!f.arrivals[i]&&Math.abs(h.x-c.target[i])<=25)f.arrivals[i]=sample
            const toward=c.target[i]>c.start[i]?h.x>=c.target[i]-18:h.x<=c.target[i]+18
            if(f.active[i]&&!f.requested[i]&&toward){f.requested[i]=true;record('release-request',i);window.__qaRelease(i)}
          })
        })
      },c)
      await page.waitForFunction(()=>window.__focused?.warn,null,{timeout:8000,polling:20})
      // Reaction delay after the observed warning. Native control events are not fabricated in page code.
      await page.waitForTimeout(350)
      if(moving[0]) await touch(true,c.target[0]>c.start[0]?92:12)
      if(moving[1]) await page.keyboard.down(keys[1])
      await page.waitForFunction(moving=>moving.every((m,i)=>!m||window.__focused.requested[i]),moving,{timeout:8000,polling:20})
      await Promise.all(releasePromises)
      await page.waitForFunction(()=>window.__focused.warn&&window.__SAKE_GAME__.scene.getScene('play').time.now-window.__focused.warn.t>=4100,null,{timeout:12000,polling:20})
      const data=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'); return {fair:window.__focused,end:[s.boy,s.girl].filter(Boolean).map(h=>({x:h.x,y:h.y,hp:h.hp,vx:h.body.velocity.x,grace:h.grace})),act:s.queen.act}})
      const {fair,end}=data, {warn,firstShots,trace,hits,arrivals,incoming,landings,events}=fair
      const damage=end.map((h,i)=>warn.h[i].hp-h.hp)
      results.cases.push({id:c.id,start:c.start,target:c.target,damage,...data,pageErrors:errors})
      console.log('CASE',c.id,JSON.stringify({warn:warn.h,events:events.map(({type,player,t,h})=>({type,player,t,x:h.map(v=>v.x)})),arrivals:arrivals.map(a=>a&&({t:a.t,x:a.h.map(h=>h.x)})),end,damage,hits:hits.map(v=>({kind:v.kind,player:v.player,t:v.t,shot:v.shot,hpAfter:v.hpAfter})),warningMs:firstShots&&Math.round(firstShots.t-warn.t)}))
      assert.ok(warn.xs.length>5)
      assert.ok(warn.h.every((h,i)=>Math.abs(h.x-c.start[i])<=10&&h.y<=286),`${c.id}: initial position changed by game`)
      assert.ok(warn.h.every(h=>h.grace<=warn.t&&h.hurtCd<=0),`${c.id}: active invulnerability at warning`)
      assert.ok(firstShots,`${c.id}: no feather launch`)
      assert.deepEqual(firstShots.shots.map(o=>o.mark).sort((a,b)=>a-b),[...warn.xs].sort((a,b)=>a-b),`${c.id}: warning/feather mismatch`)
      assert.ok(firstShots.t-warn.t>=2250,`${c.id}: warning too short`)
      for(const o of firstShots.shots){assert.equal(o.x,o.mark);assert.ok(Math.abs(o.bodyX-o.mark)<=1)}
      assert.ok(Object.keys(incoming).length>=5&&Object.keys(landings).length>=5,`${c.id}: missing incoming/landing samples`)
      for(const samples of [incoming,landings])for(const [mark,v] of Object.entries(samples)){assert.equal(v.shot.x,Number(mark));assert.ok(Math.abs(v.shot.bodyX-Number(mark))<=1)}
      for(let i=0;i<c.start.length;i++){
        assert.ok(arrivals[i],`${c.id}: player ${i+1} never reached target region`)
        if(moving[i]) {assert.ok(events.some(e=>e.player===i&&e.type===(i?'keydown':'pointerdown')),`${c.id}: no actual down`);assert.ok(events.some(e=>e.player===i&&e.type===(i?'keyup':'pointerup')),`${c.id}: no actual up`)}
        const until=hits.find(h=>h.player===i)?.t??Infinity
        const stopped=trace.filter(t=>t.t>=arrivals[i].t&&t.t<until&&Math.abs(t.h[i].vx)<0.1&&Math.abs(t.h[i].x-c.target[i])<=25)
        assert.ok(stopped.length>=2,`${c.id}: player ${i+1} did not actually stop in the target region before contact`)
        const during=trace.filter(t=>t.t>=firstShots.t&&t.t<until)
        assert.ok(during.length>=2&&during.every(t=>Math.abs(t.h[i].x-c.target[i])<=25&&Math.abs(t.h[i].vx)<0.1&&t.h[i].y<=286),`${c.id}: player ${i+1} did not stay stopped on target floor during feather approach`)
        if(c.expectedDamage[i]===0)assert.ok(end[i].y<=286&&Math.abs(end[i].x-c.target[i])<=25,`${c.id}: player ${i+1} did not remain on safe floor`)
      }
      assert.deepEqual(damage,c.expectedDamage,`${c.id}: HP mismatch`)
      for(let i=0;i<c.expectedDamage.length;i++){
        const featherHits=hits.filter(h=>h.player===i&&h.kind==='projectile'&&h.shot.mark!==undefined&&h.hpAfter<h.h[i].hp)
        if(c.expectedDamage[i]) assert.ok(featherHits.some(h=>h.shot.mark===3340&&Math.abs(h.shot.bodyX-3340)<=1),`${c.id}: expected real feather collision absent`)
        else assert.equal(featherHits.length,0,`${c.id}: unexpected damaging feather collision`)
      }
      assert.ok(trace.every(t=>t.h.every(h=>h.grace<=t.t)),`${c.id}: unexpected invulnerability`)
      assert.deepEqual(errors,[])
      console.log('PASS',c.id)
    } catch(e) {
      const state=await page.evaluate(()=>window.__focused??null).catch(()=>null)
      results.errors.push({id:c.id,message:String(e),stack:e.stack,pageErrors:errors,state})
      console.error('FAIL',c.id,e.stack)
    } finally { await context.close() }
  }
} finally { fs.writeFileSync(out,JSON.stringify(results,null,2)+'\n',{flag:'wx'}); await browser.close() }
if(results.errors.length) process.exitCode=1
