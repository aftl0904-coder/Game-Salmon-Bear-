// Injected stage/boss/phase/positions, but normal physics, damage and keyboard/touch input.
// No screenshots during movement: headless GPU screenshots can take several game seconds.
import { chromium, devices } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:47327/'
const out = 'docs/qa-c1-boss'
fs.mkdirSync(out, { recursive: true })
const results = { setup: 'Stage, phase, boss and initial positions injected. No invulnerability. Normal controls, physics and HP. Neither human playthrough nor real device.', cases: [], errors: [] }
const cases = [
  { id: 'desktop-boy-worst', mode: 'desktop', cast: 'boy', start: [3388], target: [3285] },
  { id: 'desktop-girl-worst', mode: 'desktop', cast: 'girl', start: [3588], target: [3490] },
  { id: 'mobile-boy-worst', mode: 'mobile', cast: 'boy', start: [3388], target: [3285] },
  { id: 'mobile-girl-worst', mode: 'mobile', cast: 'girl', start: [3588], target: [3490] },
  { id: 'desktop-2p-separated', mode: 'desktop', cast: '2p', start: [3220, 3588], target: [3285, 3490] },
  { id: 'desktop-left-island', mode: 'desktop', cast: 'boy', start: [3134], target: [3134] },
  { id: 'desktop-right-edge', mode: 'desktop', cast: 'boy', start: [3780], target: [3730] },
  { id: 'desktop-hit-control', mode: 'desktop', cast: 'boy', start: [3340], target: [3340], expectHit: true },
  { id: 'desktop-storm', mode: 'desktop', cast: 'boy', start: [3388], target: [3285], phase: 3 },
].filter(c => !process.env.QA_FILTER || c.id.includes(process.env.QA_FILTER))
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  for (const c of cases) {
    const context = await browser.newContext(c.mode === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport: { width: 1280, height: 720 } })
    const page = await context.newPage(), errors = []
    page.on('pageerror', e => errors.push(e.message))
    const cdp = c.mode === 'mobile' ? await context.newCDPSession(page) : null
    const touch = async (down, x = 12, y = 324) => {
      const box = await page.locator('canvas').boundingBox(); assert.ok(box)
      await cdp.send('Input.dispatchTouchEvent', { type: down ? 'touchStart' : 'touchEnd', touchPoints: down ? [{ x: box.x + box.width * x / 640, y: box.y + box.height * y / 360, id: 0 }] : [] })
    }
    try {
      await page.goto(base)
      await page.waitForFunction(() => window.__SAKE_GAME__?.scene.isActive('logo'), null, { timeout: 30000 })
      await page.waitForTimeout(700)
      await page.evaluate(c => { const g = window.__SAKE_GAME__; g.registry.set('stageNo', 5); g.registry.set('difficulty', 'normal'); g.registry.set('playMode', c.cast === '2p' ? '2p' : '1p'); g.registry.set('soloCast', c.cast === 'girl' ? 'girl' : 'boy'); g.registry.set('stageRound', 1); for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key); g.scene.start('play') }, c)
      await page.waitForTimeout(3500)
      if (c.mode === 'mobile') { await touch(true, 615, 14); await touch(false) } else await page.keyboard.press('Enter')
      await page.waitForFunction(() => { const s = window.__SAKE_GAME__.scene.getScene('play'); return s.started && !s.storyIntro }, null, { timeout: 20000 })
      await page.evaluate(async c => {
        const s = window.__SAKE_GAME__.scene.getScene('play'); s.s2Pending = []; s.coffeeDone = true
        for (const e of [...s.enemies.getChildren()]) { e.disableBody?.(true, true); e.destroy() }
        s.bossFight = true
        for (const [i,h] of [s.boy,s.girl].filter(Boolean).entries()) { h.setPosition(c.start[i],285); h.body.reset(c.start[i],285); h.laneJumping=false; h.jumpConsumed=false; h.prevFeetY=285; h.grace=0; h.hurtCd=0; h.hurtLock=0 }
        window.__fair = { trace: [], hits: [], firstShots: null, warn: null, landings: {} }
        const oldBullet = s.hitByFishBullet.bind(s)
        s.hitByFishBullet = (h, shot) => { window.__fair.hits.push({ kind:'projectile', t:s.time.now, hx:h.x, hp:h.hp, x:shot.x, y:shot.y, feather:shot.getData('triFeatherX') }); return oldBullet(h,shot) }
        const oldHazard = s.hazardHit.bind(s)
        s.hazardHit = (h, opts) => { window.__fair.hits.push({kind:'hazard',t:s.time.now,hx:h.x,hp:h.hp,label:opts?.label}); return oldHazard(h,opts) }
        const oldEnemy = s.hurtHero.bind(s)
        s.hurtHero = (h,e) => { window.__fair.hits.push({kind:'enemy-contact',t:s.time.now,hx:h.x,hp:h.hp,species:e.species}); return oldEnemy(h,e) }
        const { TriBoss } = await import('/src/game/enemies/Stage5Enemies.ts')
        const q = new TriBoss(s,3650,3100,3800,s.triHooks()); s.addS2Enemy(q); s.queen=q; q.qphase=c.phase??2; q.act=c.phase===3?'storm':'proj2'; q.t=0
        s.cameras.main.setBounds(3100,0,700,360)
        window.__fairTimer=setInterval(()=>{
          const f=window.__fair, hs=[s.boy,s.girl].filter(Boolean)
          const shadows=s.children.list.filter(o=>o.getData?.('triFeatherShadowX')!==undefined).map(o=>o.getData('triFeatherShadowX'))
          const shots=s.enemyShots.getChildren().filter(o=>o.getData?.('triFeatherX')!==undefined)
          if (!f.warn && shadows.length) f.warn={time:s.time.now,xs:shadows,hp:hs.map(h=>h.hp),positions:hs.map(h=>({x:h.x,y:h.y}))}
          if (!f.firstShots && shots.length) f.firstShots={time:s.time.now,shots:shots.map(o=>({x:o.x,mark:o.getData('triFeatherX'),bodyX:o.body.center.x,bodyW:o.body.width,y:o.y})),shadows}
          for (const o of shots) if (o.y >= 260) f.landings[o.getData('triFeatherX')] = { x:o.x, bodyX:o.body.center.x, y:o.y }
          f.trace.push({t:Math.round(s.time.now),act:q.act,h:hs.map(h=>({x:+h.x.toFixed(2),y:+h.y.toFixed(2),hp:h.hp,grace:h.grace,hurtCd:h.hurtCd}))})
        },20)
      }, c)
      await page.waitForFunction(() => window.__fair?.warn, null, { timeout: 8000, polling: 20 })
      const warn = await page.evaluate(() => window.__fair.warn)
      assert.ok(warn.xs.length > 5)
      assert.ok(warn.positions.every((h,i)=>Math.abs(h.x-c.start[i])<=10 && h.y<=286), `${c.id}: injected start positions were altered by the game`)
      assert.ok(warn.xs.every(x=>x>=3200 && ![3285,3490,3730].some(g=>Math.abs(x-g)<55)))
      await page.waitForTimeout(350) // human reaction delay AFTER first warning
      const keys=c.start.map((x,i)=>c.target[i]>x?(i===0?'d':'ArrowRight'):(i===0?'a':'ArrowLeft'))
      const moving=c.start.map((x,i)=>Math.abs(c.target[i]-x)>3)
      for(let i=0;i<moving.length;i++) if(moving[i]) { if(c.mode==='mobile') await touch(true,c.target[i]>c.start[i]?92:12); else await page.keyboard.down(keys[i]) }
      const stopAt=Date.now()+4000
      while(moving.some(Boolean)&&Date.now()<stopAt){
        const xs=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');return[s.boy,s.girl].filter(Boolean).map(h=>h.x)})
        for(let i=0;i<moving.length;i++) if(moving[i]&&(c.target[i]>c.start[i]?xs[i]>=c.target[i]-8:xs[i]<=c.target[i]+8)){ if(c.mode==='mobile') await touch(false); else await page.keyboard.up(keys[i]); moving[i]=false }
        await page.waitForTimeout(20)
      }
      assert.ok(!moving.some(Boolean), `${c.id}: did not reach target`)
      await page.waitForFunction(() => window.__fair.warn && window.__SAKE_GAME__.scene.getScene('play').time.now-window.__fair.warn.time>=4100, null, {timeout:10000,polling:20})
      const end=await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play');clearInterval(window.__fairTimer);return {fair:window.__fair,h:[s.boy,s.girl].filter(Boolean).map(h=>({x:h.x,y:h.y,hp:h.hp,grace:h.grace})),act:s.queen.act}})
      const {firstShots,trace,hits,landings}=end.fair
      assert.ok(firstShots, `${c.id}: no feather launch observed`)
      assert.deepEqual(firstShots.shots.map(o=>o.mark).sort((a,b)=>a-b),[...warn.xs].sort((a,b)=>a-b),`${c.id}: mismatch shadows and feathers`)
      for(const o of firstShots.shots) { assert.equal(o.x,o.mark);assert.ok(Math.abs(o.bodyX-o.mark)<=1,JSON.stringify(o)) }
      assert.ok(firstShots.time-warn.time>=2250,`${c.id}: warning too short`)
      assert.ok(Object.keys(landings).length >= 5, `${c.id}: too few landing samples`)
      for (const [mark,o] of Object.entries(landings)) { assert.equal(o.x,Number(mark)); assert.ok(Math.abs(o.bodyX-Number(mark))<=1); assert.ok(o.y>=260) }
      const dmg=end.h.map((h,i)=>warn.hp[i]-h.hp)
      const row={id:c.id,start:c.start,target:c.target,initialHp:warn.hp,end:end.h,damage:dmg,warningMs:Math.round(firstShots.time-warn.time),shadows:warn.xs,firstShots,landings,hits,trace,errors}
      results.cases.push(row)
      console.log('CASE',c.id,JSON.stringify({damage:dmg,endX:end.h.map(h=>Math.round(h.x)),warningMs:row.warningMs,hits,errors}))
      if(c.expectHit) assert.ok(dmg[0]>0,`${c.id}: expected actual collision`)
      else assert.deepEqual(dmg,dmg.map(()=>0),`${c.id}: lost HP`)
      if(!c.expectHit) assert.ok(end.h.every((h,i)=>Math.abs(h.x-c.target[i])<=45 && h.y<=286),`${c.id}: did not remain on the intended safe floor`)
      assert.ok(trace.every(t=>t.h.every(h=>h.grace<=t.t)),`${c.id}: unexpected invulnerability`)
      assert.deepEqual(errors,[])
      console.log('PASS',c.id)
    } catch(e) {
      const state=await page.evaluate(()=>window.__fair??null).catch(()=>null)
      results.errors.push({id:c.id,message:String(e),stack:e.stack,pageErrors:errors,state})
      console.error('FAIL',c.id,e.stack)
    } finally { await context.close() }
  }
} finally { fs.writeFileSync(`${out}/run${process.env.QA_FILTER?'-'+process.env.QA_FILTER:''}.json`,JSON.stringify(results,null,2)+'\n'); await browser.close() }
if(results.errors.length) process.exitCode=1
