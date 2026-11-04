// Focused instrumented QA only; stage/initial position/phase are injected.
// Inputs are real keyboard or CDP touch; not a natural playthrough or real device.
import { chromium, devices } from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const mode = process.env.MODE || 'desktop'
const out = 'docs/qa-c2-mall-scrubber'
const report = { mode, setup: '1P boy (105px/s); injected stage 6, initial position and boss trigger; P2/P3 HP/receiveHit and moveCount injected; wall case additionally teleports boss and hero. Dodge and attack use keyboard or simulated native touch, not natural play, human or device.', errors: [], rounds: [], events: [], samples: [] }
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] })
const context = await browser.newContext(mode === 'mobile' ? { ...devices['Pixel 7 landscape'] } : { viewport:{width:1280,height:720} })
const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message))
let cdp
async function input(button, down) {
  if (mode === 'desktop') { const key={left:'KeyA',right:'KeyD',attack:'KeyF'}[button]; return down ? page.keyboard.down(key) : page.keyboard.up(key) }
  const box = await page.locator('canvas').boundingBox()
  const pos={left:[12,324],right:[84,324],attack:[532,312]}[button]
  cdp ||= await context.newCDPSession(page)
  return cdp.send('Input.dispatchTouchEvent',{type:down?'touchStart':'touchEnd',touchPoints:down?[{x:box.x+box.width*pos[0]/640,y:box.y+box.height*pos[1]/360}]:[]})
}
const state = () => page.evaluate(() => window.__qaSample?.() || null)
async function wait(pred, label, ms=35000) {
  const start=Date.now()
  while(Date.now()-start<ms) { const s=await state(); if(s && pred(s)) return s; await page.waitForTimeout(35) }
  throw Error(`timeout ${label}: ${JSON.stringify(await state())}`)
}
async function shot(label) { await page.screenshot({path:`${out}/focus-${mode}-${label}.png`}) }
try {
  await page.goto('http://127.0.0.1:47431/?c2=1')
  await page.waitForFunction(() => window.__SAKE_GAME__?.scene?.getScene('play') && window.__SAKE_GAME__.scene.getScenes(true).length, null,{timeout:30000})
  await page.evaluate(() => { const g=window.__SAKE_GAME__; g.registry.set('stageNo',6);g.registry.set('difficulty','normal');g.registry.set('playMode','1p');g.registry.set('soloCast','boy');g.registry.set('stageRound',1);for(const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key);g.scene.start('play') })
  await page.waitForFunction(() => {const s=window.__SAKE_GAME__.scene.getScene('play');return s.started&&s.mallStorySeen.has(0)&&!s.storyIntro},null,{timeout:45000})
  await page.evaluate(() => {
    const s=window.__SAKE_GAME__.scene.getScene('play'); window.__qaEvents=[];window.__qaFrames=[]
    const rect=b=>b?{x:+b.x.toFixed(2),y:+b.y.toFixed(2),w:+b.width.toFixed(2),h:+b.height.toFixed(2),enabled:b.enable}:null
    window.__qaSample=()=>{const q=s.queen,h=s.boy;if(!q)return null;return {now:Math.round(s.time.now), act:q.act,phase:q.qphase,elapsed:Math.round(q.elapsed),move:q.move,warningId:q.moveCount,hero:{x:+h.x.toFixed(2),y:+h.y.toFixed(2),hp:h.hp,alive:h.alive,body:rect(h.body),attack:rect(h.attackHitbox?.body),attackActive:h.attackHitbox?.active, speed:h.moveSpeed}, boss:{x:+q.x.toFixed(2),y:+q.y.toFixed(2),hp:q.hp,body:rect(q.body)},warning:{x0:q.warning.x0,x1:q.warning.x1,y0:q.y-64,y1:q.y,visible:q.marker.visible},canHurt:q.canHurtPlayer(),enemies:s.enemies.getChildren().filter(e=>e!==q).map(e=>({texture:e.texture?.key,active:e.active,body:e.body?.enable})),sushi:s.sushiPickups.getChildren().filter(e=>e.active).map(e=>({x:e.x,y:e.y}))}}
    for(const name of ['hurtHero','hazardHit','hitByFishBullet','takeSushi','knockOut']) { const orig=s[name]; if(typeof orig!=='function') continue; s[name]=function(...args){const before=s.boy.hp;const source=args[1];const info={name,now:Math.round(s.time.now),before,source:source?.species||source?.texture?.key||source?.label||null};const result=orig.apply(this,args);info.after=s.boy.hp;if(info.after!==before||name==='knockOut')window.__qaEvents.push(info);return result} }
    s.events.on('postupdate',()=>{const v=window.__qaSample();if(v)window.__qaFrames.push(v)})
    window.__qaPreArena=s.enemies.getChildren().map(e=>({texture:e.texture?.key,active:e.active,body:e.body?.enable}))
    s.mallStorySeen=new Set([0,1,2,3,4]);s.coffeeDone=true;s.s2Pending=[]
    s.boy.setPosition(5025,285);s.boy.body.reset(5025,285);s.startQueenFight()
  })
  await page.waitForFunction(()=>!!window.__SAKE_GAME__.scene.getScene('play').queen,null,{timeout:45000})
  report.preArena = await page.evaluate(()=>window.__qaPreArena)
  async function dodge(phase, move) {
    const warn=await wait(s=>s.phase===phase&&s.act==='warn'&&s.move===move,`P${phase} ${move} warning`)
    assert.equal(warn.warning.visible,true);assert.equal(warn.canHurt,false)
    await input('left',true)
    const escaped=await wait(s=>s.hero.body.x+s.hero.body.w < s.warning.x0-4 || s.act!== 'warn','escape or warning ended')
    await input('left',false)
    await shot(`p${phase}-${move}-warning-or-later`)
    const active=escaped.act===move?escaped:await wait(s=>s.phase===phase&&s.act===move,`P${phase} active`)
    await shot(`p${phase}-${move}-active-or-later`)
    const recover=await wait(s=>s.phase===phase&&s.act==='recover',`P${phase} recover`)
    await shot(`p${phase}-${move}-recover`)
    report.rounds.push({warn,escaped,active,recover})
    assert.equal(active.canHurt,true);assert.equal(recover.canHurt,false)
    assert.equal(recover.hero.hp,warn.hero.hp,`P${phase} unchanged HP for this dodge`)
    return recover
  }
  await dodge(1,'charge')
  // Facing right then real attack. No forced damage; record if recovery actually lasts.
  const preCounter=await state();await input('right',true);await page.waitForTimeout(150);await input('right',false);await input('attack',true);await page.waitForTimeout(80);await input('attack',false);await page.waitForTimeout(650)
  report.counterattack={before:preCounter,after:await state()}
  assert.equal(preCounter.act,'recover','counterattack starts during recovery')
  assert.ok(report.counterattack.after.boss.hp < preCounter.boss.hp,'actual attack damages boss')
  // Inject only state setup between trials. Hero is not moved during a trial.
  await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),q=s.queen,h=s.boy;q.hp=Math.floor(q.maxHp*.60);q.lastHitAt=-1000;q.receiveHit(1,1);q.moveCount=1;h.setPosition(q.x-40,h.y);h.body.reset(h.x,h.y);h.setVelocity(0,0)})
  await dodge(2,'brush')
  await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),q=s.queen,h=s.boy;q.hp=Math.floor(q.maxHp*.20);q.lastHitAt=-1000;q.receiveHit(1,1);q.moveCount=0;h.setPosition(q.x-40,h.y);h.body.reset(h.x,h.y);h.setVelocity(0,0)})
  await dodge(3,'charge')
  // Intentionally trapped against left wall, close to boss. Boss must not attack
  // until a real exit is available; it may reposition harmlessly first.
  await page.evaluate(()=>{const s=window.__SAKE_GAME__.scene.getScene('play'),q=s.queen,h=s.boy;q.setPosition(q.arenaX0+85,q.y);q.syncBody();h.setPosition(q.arenaX0+14,h.y);h.body.reset(h.x,h.y);h.setVelocity(0,0);q.moveCount=0;q.setAct('scan');q.elapsed=650})
  const wallWarn=await wait(s=>s.phase===3&&s.act==='warn','wall warning')
  await input('right',true)
  const wallEscaped=await wait(s=>s.hero.body.x > s.warning.x1+4 || s.act!=='warn','wall escape or warning ended')
  await input('right',false)
  // Observe the same warning's attack before capturing: screenshots can take
  // longer than a complete mobile attack/recovery and otherwise cross trials.
  const wallActive=await wait(s=>s.act==='charge'&&s.warningId===wallWarn.warningId,'wall active from same warning')
  const wallRecover=await wait(s=>s.act==='recover'&&s.warningId===wallWarn.warningId,'wall recover from same warning')
  await shot('wall-recover')
  report.wall={warn:wallWarn,escaped:wallEscaped,active:wallActive,recover:wallRecover}
  assert.ok(wallEscaped.hero.body.x > wallEscaped.warning.x1,'wall exit reached during warning')
  assert.equal(wallRecover.hero.hp,wallWarn.hero.hp,'wall unchanged HP after moving out of warning')
  assert.deepEqual(report.errors,[])
  report.passed=true
} catch(e) { report.passed=false;report.error=e.stack||String(e);await shot('failure').catch(()=>{}) }
finally {
  try { const debug=await page.evaluate(()=>({events:window.__qaEvents||[],samples:window.__qaFrames||[]}));report.events=debug.events;report.samples=debug.samples } catch {}
  const active=report.samples.filter(s=>s.canHurt)
  const outside=active.filter(s=>{const b=s.boss.body,w=s.warning;return b.x<w.x0-0.02 || b.x+b.w>w.x1+0.02 || b.y<w.y0-0.02 || b.y+b.h>w.y1+0.02})
  const enemies=report.samples.filter(s=>s.enemies.some(e=>e.active||e.body))
  const trials=[...report.rounds, ...(report.wall?[report.wall]:[])]
  const damageDuringTrials=trials.flatMap(r=>report.events.filter(e=>e.now>=r.warn.now && e.now<=r.recover.now && e.after<e.before))
  const c=report.counterattack
  const counterFrames=c?report.samples.filter(s=>s.now>=c.before.now&&s.now<=c.after.now&&s.boss.hp<c.before.boss.hp):[]
  const hitInRecovery=counterFrames.length>0 && counterFrames[0].act==='recover'
  report.frameChecks={activeCount:active.length,outsideCount:outside.length,activeEnemiesCount:enemies.length,damageDuringTrials,hitInRecovery}
  if(report.passed && (!active.length || outside.length || enemies.length || damageDuringTrials.length || !hitInRecovery)) {
    report.passed=false;report.error='Frame/event check failed: outside warning, unexpected enemy/damage, no active frames, or counter hit not in recovery'
  }
  fs.writeFileSync(`${out}/focus-${mode}.json`,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({mode,passed:report.passed,error:report.error,events:report.events,rounds:report.rounds.length,frames:report.samples.length,counterattack:report.counterattack,wall:report.wall},null,2))
  await browser.close()
}
if(!report.passed)process.exitCode=1
